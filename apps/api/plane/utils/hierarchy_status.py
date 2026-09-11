# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Hierarchy-aware board columns, L3 progress, and L4 QA outcome helpers."""

from plane.db.models.state import StateGroup

# Stable external_id prefixes so renames don't break lookups
BOARD_STATE_EXTERNAL_PREFIX = "hierarchy_board:"

# Board column keys (4 shared) — map 1:1 to State.external_id suffix
BOARD_STATE_DESIGN_DEV_TODO = "design_dev_todo"
BOARD_STATE_DESIGN_DEV_IN_PROGRESS = "design_dev_in_progress"
BOARD_STATE_DESIGN_DEV_UNDER_REVIEW = "design_dev_under_review"
BOARD_STATE_DONE = "done"
# Legacy QA-only columns (soft-deleted by migration; kept for remaps / parsing)
BOARD_STATE_QA_TODO = "qa_todo"
BOARD_STATE_QA_IN_PROGRESS = "qa_in_progress"

L4_BOARD_KEYS = (
    BOARD_STATE_DESIGN_DEV_TODO,
    BOARD_STATE_DESIGN_DEV_IN_PROGRESS,
    BOARD_STATE_DESIGN_DEV_UNDER_REVIEW,
    BOARD_STATE_DONE,
)

# Back-compat aliases — all L4 types share L4_BOARD_KEYS
DESIGN_DEV_BOARD_KEYS = L4_BOARD_KEYS
QA_BOARD_KEYS = L4_BOARD_KEYS

# L3 progress (not board columns)
PROGRESS_DESIGN_TODO = "design_todo"
PROGRESS_DESIGN_IN_PROGRESS = "design_in_progress"
PROGRESS_DESIGN_UNDER_REVIEW = "design_under_review"
PROGRESS_DESIGN_DONE_NO_DEV = "design_done_no_dev"
PROGRESS_DEV_TODO = "dev_todo"
PROGRESS_DEV_IN_PROGRESS = "dev_in_progress"
PROGRESS_DEV_UNDER_REVIEW = "dev_under_review"
PROGRESS_DEV_DONE_NO_QA = "dev_done_no_qa"
PROGRESS_QA_TODO = "qa_todo"
PROGRESS_QA_IN_PROGRESS = "qa_in_progress"
PROGRESS_QA_DONE = "qa_done"

L3_PROGRESS_CHOICES = (
    (PROGRESS_DESIGN_TODO, "Design To Do"),
    (PROGRESS_DESIGN_IN_PROGRESS, "Design In Progress"),
    (PROGRESS_DESIGN_UNDER_REVIEW, "Design Under Review"),
    (PROGRESS_DESIGN_DONE_NO_DEV, "Design Done (No Dev Needed)"),
    (PROGRESS_DEV_TODO, "Dev To Do"),
    (PROGRESS_DEV_IN_PROGRESS, "Dev In Progress"),
    (PROGRESS_DEV_UNDER_REVIEW, "Dev Under Review"),
    (PROGRESS_DEV_DONE_NO_QA, "Dev Done (No QA Needed)"),
    (PROGRESS_QA_TODO, "QA To Do"),
    (PROGRESS_QA_IN_PROGRESS, "QA In Progress"),
    (PROGRESS_QA_DONE, "QA Done"),
)

L3_PROGRESS_VALUES = {value for value, _ in L3_PROGRESS_CHOICES}
L3_DONE_PROGRESS_VALUES = {
    PROGRESS_DESIGN_DONE_NO_DEV,
    PROGRESS_DEV_DONE_NO_QA,
    PROGRESS_QA_DONE,
}

QA_OUTCOME_PASS = "pass"
QA_OUTCOME_FAILED = "failed"

QA_OUTCOME_CHOICES = (
    (QA_OUTCOME_PASS, "Done pass"),
    (QA_OUTCOME_FAILED, "Done failed"),
)

QA_OUTCOME_VALUES = {value for value, _ in QA_OUTCOME_CHOICES}

# Default board states seeded per project (columns) — keep in sync with state.DEFAULT_STATES
HIERARCHY_BOARD_STATES = [
    {
        "name": "To Do",
        "color": "#60646C",
        "sequence": 15000,
        "group": StateGroup.UNSTARTED.value,
        "default": True,
        "external_id": f"{BOARD_STATE_EXTERNAL_PREFIX}{BOARD_STATE_DESIGN_DEV_TODO}",
    },
    {
        "name": "In Progress",
        "color": "#F59E0B",
        "sequence": 25000,
        "group": StateGroup.STARTED.value,
        "default": False,
        "external_id": f"{BOARD_STATE_EXTERNAL_PREFIX}{BOARD_STATE_DESIGN_DEV_IN_PROGRESS}",
    },
    {
        "name": "Under Review",
        "color": "#3B82F6",
        "sequence": 35000,
        "group": StateGroup.STARTED.value,
        "default": False,
        "external_id": f"{BOARD_STATE_EXTERNAL_PREFIX}{BOARD_STATE_DESIGN_DEV_UNDER_REVIEW}",
    },
    {
        "name": "Done",
        "color": "#46A758",
        "sequence": 45000,
        "group": StateGroup.COMPLETED.value,
        "default": False,
        "external_id": f"{BOARD_STATE_EXTERNAL_PREFIX}{BOARD_STATE_DONE}",
    },
    {
        "name": "Triage",
        "color": "#4E5355",
        "sequence": 55000,
        "group": StateGroup.TRIAGE.value,
        "default": False,
        "external_id": None,
    },
]


def board_state_key(external_id: str | None) -> str | None:
    if not external_id or not external_id.startswith(BOARD_STATE_EXTERNAL_PREFIX):
        return None
    return external_id[len(BOARD_STATE_EXTERNAL_PREFIX) :]


def is_qa_hierarchy_type(hierarchy_type) -> bool:
    if hierarchy_type is None:
        return False
    return str(getattr(hierarchy_type, "name", "")).strip().lower() == "qa"


def is_dev_hierarchy_type(hierarchy_type) -> bool:
    if hierarchy_type is None:
        return False
    return str(getattr(hierarchy_type, "name", "")).strip().lower() == "dev"


def is_dev_or_qa_hierarchy_type(hierarchy_type) -> bool:
    return is_dev_hierarchy_type(hierarchy_type) or is_qa_hierarchy_type(hierarchy_type)


def is_design_or_dev_hierarchy_type(hierarchy_type) -> bool:
    if hierarchy_type is None:
        return False
    return str(getattr(hierarchy_type, "name", "")).strip().lower() in {"design", "dev"}


def todo_board_key_for_l4(hierarchy_type) -> str:
    """All L4 types (Design / Dev / QA) share the same To Do column."""
    return BOARD_STATE_DESIGN_DEV_TODO


L4_LEAVE_TODO_REQUIRES_ASSIGNEE_AND_ESTIMATE = (
    "Add an assignee and estimate before moving this sub-task out of To Do."
)


def l4_leave_todo_requirement_error(
    *,
    hierarchy_level,
    hierarchy_type,
    current_state,
    next_state,
    has_assignee: bool,
    has_estimate: bool,
) -> str | None:
    """
    Dev/QA L4 cards cannot leave their To Do column without both assignee and estimate.
    Returns an error message when blocked, otherwise None.
    """
    if hierarchy_level != 4 or not is_dev_or_qa_hierarchy_type(hierarchy_type):
        return None
    if current_state is None or next_state is None:
        return None

    todo_key = todo_board_key_for_l4(hierarchy_type)
    current_key = board_state_key(getattr(current_state, "external_id", None))
    next_key = board_state_key(getattr(next_state, "external_id", None))

    if current_key != todo_key:
        return None
    if next_key == todo_key or getattr(current_state, "id", None) == getattr(next_state, "id", None):
        return None
    if has_assignee and has_estimate:
        return None
    return L4_LEAVE_TODO_REQUIRES_ASSIGNEE_AND_ESTIMATE


def allowed_board_keys_for_l4(hierarchy_type) -> tuple[str, ...]:
    return L4_BOARD_KEYS


def get_project_board_states_by_key(project_id):
    """Return {board_key: State} for hierarchy board states on a project."""
    from plane.db.models import State

    states = State.all_state_objects.filter(
        project_id=project_id,
        deleted_at__isnull=True,
        external_id__startswith=BOARD_STATE_EXTERNAL_PREFIX,
    )
    return {board_state_key(s.external_id): s for s in states if board_state_key(s.external_id)}


def ensure_hierarchy_board_states(project, created_by=None):
    """Idempotently seed the 4 board columns (+ Triage) for a project."""
    from plane.db.models import State

    existing = {
        s.external_id: s
        for s in State.all_state_objects.filter(
            project_id=project.id,
            deleted_at__isnull=True,
            external_id__startswith=BOARD_STATE_EXTERNAL_PREFIX,
        )
    }
    # Also match by name for projects that already have a classic "Done"/"Triage"
    existing_by_name = {
        s.name.lower(): s
        for s in State.all_state_objects.filter(project_id=project.id, deleted_at__isnull=True)
    }

    created = []
    for spec in HIERARCHY_BOARD_STATES:
        external_id = spec.get("external_id")
        if external_id and external_id in existing:
            # Keep existing board columns aligned with current defaults
            state = existing[external_id]
            dirty = False
            for field in ("name", "color", "sequence", "group"):
                if getattr(state, field) != spec[field]:
                    setattr(state, field, spec[field])
                    dirty = True
            if spec.get("default") and not state.default:
                state.default = True
                dirty = True
            if dirty:
                state.save(update_fields=["name", "color", "sequence", "group", "default", "updated_at"])
            continue
        if not external_id and existing_by_name.get(spec["name"].lower()):
            continue
        # Prefer attaching external_id to an existing same-named state (e.g. Done)
        named = existing_by_name.get(spec["name"].lower())
        if named is not None and external_id and not named.external_id:
            named.external_id = external_id
            named.group = spec["group"]
            named.sequence = spec["sequence"]
            named.color = spec["color"]
            if spec.get("default"):
                named.default = True
            named.save(
                update_fields=["external_id", "group", "sequence", "color", "default", "updated_at"]
            )
            existing[external_id] = named
            continue

        state = State(
            name=spec["name"],
            color=spec["color"],
            sequence=spec["sequence"],
            group=spec["group"],
            default=spec.get("default", False),
            external_id=external_id,
            project=project,
            workspace_id=project.workspace_id,
            created_by=created_by,
        )
        if spec["group"] == StateGroup.TRIAGE.value:
            state.is_triage = True
        created.append(state)

    if created:
        # Clear other defaults when seeding a new default board state
        if any(s.default for s in created):
            State.all_state_objects.filter(project_id=project.id, default=True).update(default=False)
        State.all_state_objects.bulk_create(created)

    return created


def l4_children_all_in_done(parent_issue) -> bool:
    """True when every non-deleted L4 child sits in the Done board column."""
    from plane.db.models import Issue

    children = Issue.objects.filter(
        parent_id=parent_issue.id,
        deleted_at__isnull=True,
        archived_at__isnull=True,
        is_draft=False,
        hierarchy_level=4,
    ).select_related("state")
    children = list(children)
    if not children:
        # No L4 children: L3 QA Done alone is enough for "fully done"
        return True

    done_external = f"{BOARD_STATE_EXTERNAL_PREFIX}{BOARD_STATE_DONE}"
    for child in children:
        state = child.state
        if state is None:
            return False
        if state.external_id == done_external or (
            state.group == StateGroup.COMPLETED.value and board_state_key(state.external_id) == BOARD_STATE_DONE
        ):
            continue
        # Fallback: completed group named Done
        if state.group == StateGroup.COMPLETED.value and state.name.lower() == "done":
            continue
        return False
    return True


def is_story_fully_done(issue) -> bool:
    """L3 is fully done when progress is a terminal done status and all L4 children are in Done."""
    if getattr(issue, "hierarchy_level", None) != 3:
        return False
    if getattr(issue, "progress_status", None) not in L3_DONE_PROGRESS_VALUES:
        return False
    return l4_children_all_in_done(issue)


def issue_ids_to_transfer_from_cycle(cycle_issues_qs):
    """
    Given a CycleIssue queryset for a source cycle, return issue IDs that should move.

    Hierarchy rule: transfer an L3 story (and its L4 children in the cycle) unless
    the story is fully done (L3 done status + all L4 in Done column).
    Non-L3 issues keep the classic incomplete state-group rule.
    """
    cycle_issues = list(
        cycle_issues_qs.select_related("issue", "issue__state", "issue__hierarchy_type")
    )
    issue_by_id = {ci.issue_id: ci.issue for ci in cycle_issues}
    cycle_issue_ids = set(issue_by_id.keys())

    transfer_ids = set()

    # L3 stories
    l3_ids = [iid for iid, issue in issue_by_id.items() if getattr(issue, "hierarchy_level", None) == 3]
    fully_done_l3 = set()
    for iid in l3_ids:
        issue = issue_by_id[iid]
        if is_story_fully_done(issue):
            fully_done_l3.add(iid)
        else:
            transfer_ids.add(iid)

    # L4 children in this cycle follow their L3 parent
    for iid, issue in issue_by_id.items():
        if getattr(issue, "hierarchy_level", None) != 4:
            continue
        parent_id = issue.parent_id
        if parent_id in fully_done_l3:
            continue
        if parent_id in transfer_ids or parent_id not in cycle_issue_ids:
            # Parent transferring, or parent not in cycle — use L4 completion
            if parent_id in transfer_ids:
                transfer_ids.add(iid)
                continue
            # Orphan / parent outside cycle: classic incomplete by state group
            state = issue.state
            if state is None or state.group in (
                StateGroup.BACKLOG.value,
                StateGroup.UNSTARTED.value,
                StateGroup.STARTED.value,
            ):
                transfer_ids.add(iid)
            continue
        # Parent in cycle but not fully done and not yet marked — shouldn't happen
        if parent_id in l3_ids and parent_id not in fully_done_l3:
            transfer_ids.add(iid)

    # L1 / L2 / other: classic incomplete
    for iid, issue in issue_by_id.items():
        level = getattr(issue, "hierarchy_level", None)
        if level in (3, 4):
            continue
        state = issue.state
        if state is None or state.group in (
            StateGroup.BACKLOG.value,
            StateGroup.UNSTARTED.value,
            StateGroup.STARTED.value,
        ):
            transfer_ids.add(iid)

    return transfer_ids


def l4_estimate_rollup_subquery(type_name: str):
    """Sum of L4 child estimate_point.value for a given hierarchy type name (design/dev/qa)."""
    from django.db.models import FloatField, OuterRef, Subquery, Sum, Value
    from django.db.models.functions import Cast, Coalesce

    from plane.db.models import Issue
    from plane.utils.issue_parent import HIERARCHY_LEVEL_SUB_TASK

    return Coalesce(
        Subquery(
            Issue.issue_objects.filter(
                parent_id=OuterRef("id"),
                hierarchy_level=HIERARCHY_LEVEL_SUB_TASK,
                hierarchy_type__name__iexact=type_name,
                estimate_point__isnull=False,
            )
            .order_by()
            .values("parent_id")
            .annotate(total=Sum(Cast("estimate_point__value", FloatField())))
            .values("total")[:1],
            output_field=FloatField(),
        ),
        Value(0.0),
        output_field=FloatField(),
    )


def annotate_l4_estimate_rollups(queryset):
    """Attach design/dev/qa estimate rollups onto an Issue queryset (for L3 parents)."""
    return queryset.annotate(
        design_estimate_points=l4_estimate_rollup_subquery("design"),
        dev_estimate_points=l4_estimate_rollup_subquery("dev"),
        qa_estimate_points=l4_estimate_rollup_subquery("qa"),
    )
