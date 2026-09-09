# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Cycle assignment rules for the work-item hierarchy.

- Levels 1 (Milestone) and 2 (Epic) cannot be in a cycle.
- Level 3 (Delivery) owns the cycle assignment.
- Level 4 (Sub-task) may inherit from L3 by default, but can also be assigned directly.
"""

from __future__ import annotations

from typing import Iterable, Optional
from uuid import UUID

from plane.utils.issue_parent import (
    HIERARCHY_LEVEL_DELIVERY,
    HIERARCHY_LEVEL_EPIC,
    HIERARCHY_LEVEL_MILESTONE,
    HIERARCHY_LEVEL_SUB_TASK,
    get_hierarchy_level,
)


def filter_cycle_assignable_issue_ids(issue_ids: Iterable) -> list:
    """Return delivery (L3) and sub-task (L4) issue ids — L1/L2 are not assignable."""
    from plane.db.models import Issue

    ids = list(issue_ids)
    if not ids:
        return []

    assignable = []
    for issue in Issue.issue_objects.filter(pk__in=ids).only("id", "hierarchy_level", "type_id"):
        if get_hierarchy_level(issue) in (HIERARCHY_LEVEL_DELIVERY, HIERARCHY_LEVEL_SUB_TASK):
            assignable.append(str(issue.id))
    return assignable


def purge_milestone_and_epic_from_cycles(cycle_id=None, project_id=None) -> int:
    """Remove CycleIssue rows for milestones (L1) and epics (L2)."""
    from plane.db.models import CycleIssue

    qs = CycleIssue.objects.filter(
        issue__hierarchy_level__in=[HIERARCHY_LEVEL_MILESTONE, HIERARCHY_LEVEL_EPIC],
    )
    if cycle_id:
        qs = qs.filter(cycle_id=cycle_id)
    if project_id:
        qs = qs.filter(project_id=project_id)
    # SoftDeletionQuerySet.delete() returns an int; Django hard-delete returns (count, per_type)
    result = qs.delete()
    return result[0] if isinstance(result, tuple) else int(result or 0)


def cycle_visible_hierarchy_levels() -> list[int]:
    """Levels that may appear in a cycle board (delivery + inherited sub-tasks)."""
    return [HIERARCHY_LEVEL_DELIVERY, HIERARCHY_LEVEL_SUB_TASK]


def get_parent_cycle_id(issue) -> Optional[UUID]:
    """Return the parent's CycleIssue.cycle_id if present."""
    from plane.db.models import CycleIssue

    parent_id = getattr(issue, "parent_id", None)
    if not parent_id:
        return None
    return (
        CycleIssue.objects.filter(issue_id=parent_id, deleted_at__isnull=True)
        .values_list("cycle_id", flat=True)
        .first()
    )


def inherit_cycle_from_parent(issue, user_id=None) -> None:
    """If issue is L4 and parent is in a cycle, mirror that CycleIssue onto the child."""
    from plane.db.models import CycleIssue

    if get_hierarchy_level(issue) != HIERARCHY_LEVEL_SUB_TASK:
        return

    parent_cycle_id = get_parent_cycle_id(issue)
    if not parent_cycle_id:
        # Parent has no cycle — ensure child is also unassigned
        CycleIssue.objects.filter(issue_id=issue.id).delete()
        return

    existing = CycleIssue.objects.filter(issue_id=issue.id, deleted_at__isnull=True).first()
    if existing:
        if existing.cycle_id != parent_cycle_id:
            existing.cycle_id = parent_cycle_id
            if user_id:
                existing.updated_by_id = user_id
            existing.save(update_fields=["cycle_id", "updated_by", "updated_at"])
        return

    CycleIssue.objects.create(
        issue_id=issue.id,
        cycle_id=parent_cycle_id,
        project_id=issue.project_id,
        workspace_id=issue.workspace_id,
        created_by_id=user_id,
        updated_by_id=user_id,
    )


def sync_subtask_cycles_for_parents(
    parent_issue_ids: Iterable,
    cycle_id,
    project_id,
    workspace_id,
    user_id=None,
) -> None:
    """Assign (or reassign) all L4 children of the given L3 parents to cycle_id."""
    from plane.db.models import CycleIssue, Issue

    parent_ids = list(parent_issue_ids)
    if not parent_ids or not cycle_id:
        return

    child_ids = list(
        Issue.issue_objects.filter(
            parent_id__in=parent_ids,
            hierarchy_level=HIERARCHY_LEVEL_SUB_TASK,
            project_id=project_id,
        ).values_list("id", flat=True)
    )
    if not child_ids:
        return

    existing = {
        str(ci.issue_id): ci
        for ci in CycleIssue.objects.filter(issue_id__in=child_ids, deleted_at__isnull=True)
    }

    to_create = []
    to_update = []
    for child_id in child_ids:
        key = str(child_id)
        if key in existing:
            ci = existing[key]
            if ci.cycle_id != cycle_id:
                ci.cycle_id = cycle_id
                if user_id:
                    ci.updated_by_id = user_id
                to_update.append(ci)
        else:
            to_create.append(
                CycleIssue(
                    issue_id=child_id,
                    cycle_id=cycle_id,
                    project_id=project_id,
                    workspace_id=workspace_id,
                    created_by_id=user_id,
                    updated_by_id=user_id,
                )
            )

    if to_create:
        CycleIssue.objects.bulk_create(to_create, batch_size=100)
    if to_update:
        CycleIssue.objects.bulk_update(to_update, ["cycle_id", "updated_by"], batch_size=100)


def clear_subtask_cycles_for_parents(parent_issue_ids: Iterable, project_id) -> None:
    """Remove cycle membership for all L4 children of the given parents."""
    from plane.db.models import CycleIssue, Issue

    parent_ids = list(parent_issue_ids)
    if not parent_ids:
        return

    child_ids = Issue.issue_objects.filter(
        parent_id__in=parent_ids,
        hierarchy_level=HIERARCHY_LEVEL_SUB_TASK,
        project_id=project_id,
    ).values_list("id", flat=True)
    CycleIssue.objects.filter(issue_id__in=child_ids).delete()
