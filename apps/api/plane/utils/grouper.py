# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.contrib.postgres.aggregates import ArrayAgg
from django.contrib.postgres.fields import ArrayField
from django.db.models import Q, UUIDField, Value, QuerySet, OuterRef, Subquery, Case, When, F
from django.db.models.functions import Coalesce

# Module imports
from plane.db.models import (
    Cycle,
    Issue,
    Label,
    Module,
    ModuleIssue,
    Project,
    ProjectMember,
    State,
    WorkspaceMember,
    IssueAssignee,
    IssueLabel,
)
from plane.utils.issue_parent import (
    HIERARCHY_LEVEL_DELIVERY,
    HIERARCHY_LEVEL_EPIC,
    HIERARCHY_LEVEL_SUB_TASK,
)
from typing import Optional, Dict, Any, Union, List


def _queryset_is_scrumban(queryset: Optional[QuerySet] = None, project_id: Optional[str] = None) -> bool:
    """Scrumban grouping only when every in-scope project is staged-gate Scrumban."""
    if project_id:
        return Project.objects.filter(id=project_id, workflow_mode="staged_gate_scrumban").exists()
    if queryset is None:
        return False
    modes = list(
        Project.objects.filter(id__in=queryset.values_list("project_id", flat=True).distinct())
        .values_list("workflow_mode", flat=True)
        .distinct()
    )
    return len(modes) == 1 and modes[0] == "staged_gate_scrumban"


def _epic_id_annotation():
    """Scalar epic id for an issue: self (L2), parent (L3), or grandparent (L4)."""
    return Case(
        When(hierarchy_level=HIERARCHY_LEVEL_EPIC, then=F("id")),
        When(hierarchy_level=HIERARCHY_LEVEL_DELIVERY, then=F("parent_id")),
        When(hierarchy_level=HIERARCHY_LEVEL_SUB_TASK, then=F("parent__parent_id")),
        default=None,
        output_field=UUIDField(),
    )


def _delivery_parent_id_annotation():
    """L3 id for board swimlanes: L4 → parent, else null (L3 headers only, cards are L4)."""
    return Case(
        When(hierarchy_level=HIERARCHY_LEVEL_SUB_TASK, then=F("parent_id")),
        default=None,
        output_field=UUIDField(),
    )


def issue_queryset_grouper(
    queryset: QuerySet[Issue],
    group_by: Optional[str],
    sub_group_by: Optional[str],
) -> QuerySet[Issue]:
    FIELD_MAPPER: Dict[str, str] = {
        "label_ids": "labels__id",
        "assignee_ids": "assignees__id",
        "module_ids": "issue_module__module_id",
    }

    GROUP_FILTER_MAPPER: Dict[str, Q] = {
        "assignees__id": Q(issue_assignee__deleted_at__isnull=True),
        "labels__id": Q(label_issue__deleted_at__isnull=True),
        "issue_module__module_id": Q(issue_module__deleted_at__isnull=True),
    }

    is_scrumban = _queryset_is_scrumban(queryset)

    for group_key in [group_by, sub_group_by]:
        if group_key in GROUP_FILTER_MAPPER:
            if group_key == "issue_module__module_id" and is_scrumban:
                continue
            queryset = queryset.filter(GROUP_FILTER_MAPPER[group_key])

    def _as_uuid_array(field_expr):
        from django.db.models import Func

        return Func(
            field_expr,
            function="",
            template=(
                "CASE WHEN %(expressions)s IS NULL THEN ARRAY[]::uuid[] "
                "ELSE ARRAY[%(expressions)s]::uuid[] END"
            ),
            output_field=ArrayField(UUIDField()),
        )

    # Scrumban reuses the module group key for L2/L3 hierarchy columns.
    # Classic groups by real Plane ModuleIssue membership.
    module_as_subgroup_only = (
        is_scrumban and sub_group_by == "issue_module__module_id" and group_by != "issue_module__module_id"
    )
    if is_scrumban and group_by == "issue_module__module_id":
        queryset = queryset.annotate(**{"issue_module__module_id": _epic_id_annotation()})
    elif module_as_subgroup_only:
        queryset = queryset.annotate(**{"issue_module__module_id": _delivery_parent_id_annotation()})

    issue_assignee_subquery = Subquery(
        IssueAssignee.objects.filter(
            issue_id=OuterRef("pk"),
            deleted_at__isnull=True,
        )
        .values("issue_id")
        .annotate(arr=ArrayAgg("assignee_id", distinct=True))
        .values("arr")
    )

    issue_label_subquery = Subquery(
        IssueLabel.objects.filter(issue_id=OuterRef("pk"), deleted_at__isnull=True)
        .values("issue_id")
        .annotate(arr=ArrayAgg("label_id", distinct=True))
        .values("arr")
    )

    issue_module_subquery = Subquery(
        ModuleIssue.objects.filter(
            issue_id=OuterRef("pk"),
            deleted_at__isnull=True,
            module__archived_at__isnull=True,
        )
        .values("issue_id")
        .annotate(arr=ArrayAgg("module_id", distinct=True))
        .values("arr")
    )

    epic_module_ids = Case(
        When(hierarchy_level=HIERARCHY_LEVEL_EPIC, then=_as_uuid_array(F("id"))),
        When(hierarchy_level=HIERARCHY_LEVEL_DELIVERY, then=_as_uuid_array(F("parent_id"))),
        When(hierarchy_level=HIERARCHY_LEVEL_SUB_TASK, then=_as_uuid_array(F("parent__parent_id"))),
        default=Value([], output_field=ArrayField(UUIDField())),
        output_field=ArrayField(UUIDField()),
    )

    delivery_parent_module_ids = Case(
        When(hierarchy_level=HIERARCHY_LEVEL_SUB_TASK, then=_as_uuid_array(F("parent_id"))),
        default=Value([], output_field=ArrayField(UUIDField())),
        output_field=ArrayField(UUIDField()),
    )

    annotations_map: Dict[str, Any] = {
        "assignee_ids": Coalesce(issue_assignee_subquery, Value([], output_field=ArrayField(UUIDField()))),
        "label_ids": Coalesce(issue_label_subquery, Value([], output_field=ArrayField(UUIDField()))),
        "module_ids": (
            delivery_parent_module_ids
            if module_as_subgroup_only
            else epic_module_ids
            if is_scrumban
            else Coalesce(issue_module_subquery, Value([], output_field=ArrayField(UUIDField())))
        ),
    }

    default_annotations: Dict[str, Any] = {}

    for key, expression in annotations_map.items():
        if FIELD_MAPPER.get(key) in {group_by, sub_group_by}:
            # Still attach module_ids for client swimlane grouping when module is only a subgroup
            if key == "module_ids" and module_as_subgroup_only:
                default_annotations[key] = expression
            continue
        default_annotations[key] = expression

    return queryset.annotate(**default_annotations)


def issue_on_results(
    issues: QuerySet[Issue],
    group_by: Optional[str],
    sub_group_by: Optional[str],
) -> List[Dict[str, Any]]:
    FIELD_MAPPER: Dict[str, str] = {
        "labels__id": "label_ids",
        "assignees__id": "assignee_ids",
        "issue_module__module_id": "module_ids",
    }

    original_list: List[str] = ["assignee_ids", "label_ids", "module_ids"]

    required_fields: List[str] = [
        "id",
        "name",
        "state_id",
        "sort_order",
        "completed_at",
        "estimate_point",
        "priority",
        "start_date",
        "target_date",
        "sequence_id",
        "project_id",
        "parent_id",
        "cycle_id",
        "sub_issues_count",
        "created_at",
        "updated_at",
        "created_by",
        "updated_by",
        "attachment_count",
        "link_count",
        "is_draft",
        "archived_at",
        "state__group",
        "type_id",
        "hierarchy_type_id",
        "hierarchy_level",
        "progress_status",
        "qa_outcome",
        "pin_level",
        "design_estimate_points",
        "dev_estimate_points",
        "qa_estimate_points",
    ]

    if group_by in FIELD_MAPPER:
        original_list.remove(FIELD_MAPPER[group_by])
        original_list.append(group_by)

    if sub_group_by in FIELD_MAPPER:
        # Sub-group-by module (L3 swimlanes): keep module_ids for the client AND the scalar
        # issue_module__module_id field the multi-group paginator reads.
        if sub_group_by == "issue_module__module_id" and group_by != "issue_module__module_id":
            if "issue_module__module_id" not in original_list:
                original_list.append("issue_module__module_id")
        else:
            if FIELD_MAPPER[sub_group_by] in original_list:
                original_list.remove(FIELD_MAPPER[sub_group_by])
            original_list.append(sub_group_by)

    required_fields.extend(original_list)

    # L3 Total Estimate rollups (Design/Dev/QA Σ of L4 estimate_point.value)
    from plane.utils.hierarchy_status import annotate_l4_estimate_rollups

    if "design_estimate_points" not in issues.query.annotations:
        issues = annotate_l4_estimate_rollups(issues)

    return list(issues.values(*required_fields))


def issue_group_values(
    field: str,
    slug: str,
    project_id: Optional[str] = None,
    filters: Dict[str, Any] = {},
    queryset: Optional[QuerySet] = None,
    for_subgroup: bool = False,
) -> List[Union[str, Any]]:
    if field == "state_id":
        queryset = State.objects.filter(is_triage=False, workspace__slug=slug).values_list("id", flat=True)
        if project_id:
            return list(queryset.filter(project_id=project_id))
        return list(queryset)

    if field == "labels__id":
        queryset = Label.objects.filter(workspace__slug=slug).values_list("id", flat=True)
        if project_id:
            return list(queryset.filter(project_id=project_id)) + ["None"]
        return list(queryset) + ["None"]

    if field == "assignees__id":
        if project_id:
            return list(
                ProjectMember.objects.filter(workspace__slug=slug, project_id=project_id, is_active=True).values_list(
                    "member_id", flat=True
                )
            )
        return list(
            WorkspaceMember.objects.filter(workspace__slug=slug, is_active=True).values_list("member_id", flat=True)
        )

    if field == "issue_module__module_id":
        if not _queryset_is_scrumban(queryset, project_id):
            module_qs = Module.objects.filter(workspace__slug=slug).values_list("id", flat=True)
            if project_id:
                return list(module_qs.filter(project_id=project_id)) + ["None"]
            return list(module_qs) + ["None"]

        # Scrumban: sub-group-by module → L3 delivery parents; group-by module → L2 epics.
        if queryset is not None:
            if for_subgroup:
                annotated_delivery = queryset.annotate(_group_delivery_id=_delivery_parent_id_annotation())
                delivery_ids = list(
                    annotated_delivery.exclude(_group_delivery_id__isnull=True)
                    .values_list("_group_delivery_id", flat=True)
                    .distinct()
                )
                result = [str(item_id) for item_id in delivery_ids]
                if annotated_delivery.filter(
                    hierarchy_level=HIERARCHY_LEVEL_SUB_TASK, _group_delivery_id__isnull=True
                ).exists():
                    result.append("None")
                return result

            annotated = queryset.annotate(_group_epic_id=_epic_id_annotation())
            epic_ids = list(
                annotated.exclude(_group_epic_id__isnull=True)
                .values_list("_group_epic_id", flat=True)
                .distinct()
            )
            result = [str(epic_id) for epic_id in epic_ids]
            if annotated.filter(_group_epic_id__isnull=True).exists():
                result.append("None")
            return result

        epic_qs = Issue.issue_objects.filter(
            workspace__slug=slug,
            hierarchy_level=HIERARCHY_LEVEL_EPIC,
        ).values_list("id", flat=True)
        if project_id:
            return list(epic_qs.filter(project_id=project_id)) + ["None"]
        return list(epic_qs) + ["None"]

    if field == "cycle_id":
        queryset = Cycle.objects.filter(workspace__slug=slug).values_list("id", flat=True)
        if project_id:
            return list(queryset.filter(project_id=project_id)) + ["None"]
        return list(queryset) + ["None"]

    if field == "project_id":
        queryset = Project.objects.filter(workspace__slug=slug).values_list("id", flat=True)
        return list(queryset)

    if field == "priority":
        return ["low", "medium", "high", "urgent", "none"]

    if field == "state__group":
        return ["backlog", "unstarted", "started", "completed", "cancelled"]

    if field == "target_date":
        queryset = queryset.values_list("target_date", flat=True).distinct()
        if project_id:
            return list(queryset.filter(project_id=project_id))
        else:
            return list(queryset)

    if field == "start_date":
        queryset = queryset.values_list("start_date", flat=True).distinct()
        if project_id:
            return list(queryset.filter(project_id=project_id))
        else:
            return list(queryset)

    if field == "created_by":
        queryset = queryset.values_list("created_by", flat=True).distinct()
        if project_id:
            return list(queryset.filter(project_id=project_id))
        else:
            return list(queryset)

    return []
