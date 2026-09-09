# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.contrib.postgres.aggregates import ArrayAgg
from django.contrib.postgres.fields import ArrayField
from django.db.models import Q, UUIDField, Value, F, Case, When, Func
from django.db.models.functions import Coalesce
from django.db.models import QuerySet

from typing import List, Optional, Dict, Any, Union

# Module imports
from plane.db.models import (
    Cycle,
    Issue,
    Label,
    Project,
    ProjectMember,
    State,
    WorkspaceMember,
)
from plane.utils.issue_parent import (
    HIERARCHY_LEVEL_DELIVERY,
    HIERARCHY_LEVEL_EPIC,
    HIERARCHY_LEVEL_SUB_TASK,
)


def _epic_id_annotation():
    return Case(
        When(hierarchy_level=HIERARCHY_LEVEL_EPIC, then=F("id")),
        When(hierarchy_level=HIERARCHY_LEVEL_DELIVERY, then=F("parent_id")),
        When(hierarchy_level=HIERARCHY_LEVEL_SUB_TASK, then=F("parent__parent_id")),
        default=None,
        output_field=UUIDField(),
    )


def _delivery_parent_id_annotation():
    return Case(
        When(hierarchy_level=HIERARCHY_LEVEL_SUB_TASK, then=F("parent_id")),
        default=None,
        output_field=UUIDField(),
    )


def _as_uuid_array(field_expr):
    return Func(
        field_expr,
        function="",
        template=(
            "CASE WHEN %(expressions)s IS NULL THEN ARRAY[]::uuid[] " "ELSE ARRAY[%(expressions)s]::uuid[] END"
        ),
        output_field=ArrayField(UUIDField()),
    )


def issue_queryset_grouper(
    queryset: QuerySet[Issue], group_by: Optional[str], sub_group_by: Optional[str]
) -> QuerySet[Issue]:
    FIELD_MAPPER = {
        "label_ids": "labels__id",
        "assignee_ids": "assignees__id",
        "module_ids": "issue_module__module_id",
    }

    GROUP_FILTER_MAPPER = {
        "assignees__id": Q(issue_assignee__deleted_at__isnull=True),
        "labels__id": Q(label_issue__deleted_at__isnull=True),
    }

    for group_key in [group_by, sub_group_by]:
        if group_key in GROUP_FILTER_MAPPER:
            queryset = queryset.filter(GROUP_FILTER_MAPPER[group_key])

    module_as_subgroup_only = sub_group_by == "issue_module__module_id" and group_by != "issue_module__module_id"
    if group_by == "issue_module__module_id":
        queryset = queryset.annotate(**{"issue_module__module_id": _epic_id_annotation()})
    elif module_as_subgroup_only:
        queryset = queryset.annotate(**{"issue_module__module_id": _delivery_parent_id_annotation()})

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

    annotations_map = {
        "assignee_ids": (
            "assignees__id",
            ~Q(assignees__id__isnull=True) & Q(issue_assignee__deleted_at__isnull=True),
        ),
        "label_ids": (
            "labels__id",
            ~Q(labels__id__isnull=True) & Q(label_issue__deleted_at__isnull=True),
        ),
    }
    default_annotations = {
        key: Coalesce(
            ArrayAgg(field, distinct=True, filter=condition),
            Value([], output_field=ArrayField(UUIDField())),
        )
        for key, (field, condition) in annotations_map.items()
        if FIELD_MAPPER.get(key) != group_by or FIELD_MAPPER.get(key) != sub_group_by
    }
    if module_as_subgroup_only:
        default_annotations["module_ids"] = delivery_parent_module_ids
    elif FIELD_MAPPER.get("module_ids") not in {group_by, sub_group_by}:
        default_annotations["module_ids"] = epic_module_ids

    return queryset.annotate(**default_annotations)


def issue_on_results(
    issues: QuerySet[Issue], group_by: Optional[str], sub_group_by: Optional[str]
) -> List[Dict[str, Any]]:
    FIELD_MAPPER = {
        "labels__id": "label_ids",
        "assignees__id": "assignee_ids",
        "issue_module__module_id": "module_ids",
    }

    original_list = ["assignee_ids", "label_ids", "module_ids"]

    required_fields = [
        "id",
        "name",
        "state_id",
        "sort_order",
        "estimate_point",
        "priority",
        "start_date",
        "target_date",
        "sequence_id",
        "project_id",
        "parent_id",
        "cycle_id",
        "created_by",
        "state__group",
        "type_id",
        "hierarchy_type_id",
        "hierarchy_level",
        "pin_level",
    ]

    if group_by in FIELD_MAPPER:
        original_list.remove(FIELD_MAPPER[group_by])
        original_list.append(group_by)

    if sub_group_by in FIELD_MAPPER:
        original_list.remove(FIELD_MAPPER[sub_group_by])
        original_list.append(sub_group_by)

    required_fields.extend(original_list)
    return list(issues.values(*required_fields))


def issue_group_values(
    field: str,
    slug: str,
    project_id: Optional[str] = None,
    filters: Dict[str, Any] = {},
    queryset: Optional[QuerySet] = None,
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
        else:
            return list(queryset) + ["None"]
    if field == "assignees__id":
        if project_id:
            return ProjectMember.objects.filter(
                workspace__slug=slug, project_id=project_id, is_active=True
            ).values_list("member_id", flat=True)
        else:
            return list(
                WorkspaceMember.objects.filter(workspace__slug=slug, is_active=True).values_list("member_id", flat=True)
            )
    if field == "issue_module__module_id":
        queryset = Issue.issue_objects.filter(
            workspace__slug=slug,
            hierarchy_level=HIERARCHY_LEVEL_EPIC,
        ).values_list("id", flat=True)
        if project_id:
            return list(queryset.filter(project_id=project_id)) + ["None"]
        else:
            return list(queryset) + ["None"]
    if field == "cycle_id":
        queryset = Cycle.objects.filter(workspace__slug=slug).values_list("id", flat=True)
        if project_id:
            return list(queryset.filter(project_id=project_id)) + ["None"]
        else:
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
