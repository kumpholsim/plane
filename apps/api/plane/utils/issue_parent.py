# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Helpers for limiting work-item nesting depth and hierarchy levels.

Depth 0 = top-level work item
Depth 1–3 = nested children (maximum depth = 3 for a 4-level hierarchy)

Hierarchy levels (fixed):
  1 Milestone → 2 Epic → 3 Delivery (Story/Bug/Task) → 4 Sub-task
"""

from __future__ import annotations

from typing import Optional
from uuid import UUID

MAX_SUB_TASK_DEPTH = 3

HIERARCHY_LEVEL_MILESTONE = 1
HIERARCHY_LEVEL_EPIC = 2
HIERARCHY_LEVEL_DELIVERY = 3
HIERARCHY_LEVEL_SUB_TASK = 4

HIERARCHY_LEVEL_ADJACENCY_ERROR = (
    "Work items can only nest under the level directly above them "
    "(Milestone → Epic → Story/Bug/Task → Sub-task)."
)


def get_issue_depth(issue) -> int:
    """Return how many ancestors the issue has (0 for top-level)."""
    from plane.db.models import Issue

    depth = 0
    parent_id = getattr(issue, "parent_id", None)
    visited: set[UUID] = set()

    while parent_id:
        if parent_id in visited:
            break
        visited.add(parent_id)
        depth += 1
        parent_id = (
            Issue.issue_objects.filter(pk=parent_id).values_list("parent_id", flat=True).first()
        )
        if depth > 50:
            break

    return depth


def get_descendant_height(issue_id: Optional[UUID]) -> int:
    """Return max depth of the subtree under issue_id (0 if leaf / missing)."""
    if not issue_id:
        return 0

    from plane.db.models import Issue

    children = list(Issue.issue_objects.filter(parent_id=issue_id).values_list("id", flat=True))
    if not children:
        return 0
    return 1 + max(get_descendant_height(child_id) for child_id in children)


def would_exceed_sub_task_depth(parent, child_issue_id: Optional[UUID] = None) -> bool:
    """True if making `parent` the parent of child (or a new issue) exceeds max depth."""
    if parent is None:
        return False
    parent_depth = get_issue_depth(parent)
    child_height = get_descendant_height(child_issue_id)
    return parent_depth + 1 + child_height > MAX_SUB_TASK_DEPTH


def get_hierarchy_level(issue) -> int:
    """Return hierarchy_level on the issue, defaulting via is_epic then delivery (3)."""
    level = getattr(issue, "hierarchy_level", None)
    if level:
        return int(level)
    # Compat: legacy epics may only expose is_epic
    if getattr(issue, "is_epic", False):
        return HIERARCHY_LEVEL_EPIC
    issue_type = getattr(issue, "type", None)
    if issue_type is not None and getattr(issue_type, "is_epic", False):
        return HIERARCHY_LEVEL_EPIC
    return HIERARCHY_LEVEL_DELIVERY


def would_break_hierarchy_adjacency(parent, child_level: Optional[int] = None) -> bool:
    """True if child's level is not exactly parent.level + 1."""
    if parent is None:
        return False
    parent_level = get_hierarchy_level(parent)
    if child_level is None:
        child_level = parent_level + 1
    return child_level != parent_level + 1


def resolve_child_hierarchy_level(parent) -> int:
    """Next level under parent, capped at sub-task."""
    if parent is None:
        return HIERARCHY_LEVEL_DELIVERY
    return min(get_hierarchy_level(parent) + 1, HIERARCHY_LEVEL_SUB_TASK)


SUB_TASK_DEPTH_ERROR = (
    f"Work items can only be nested up to {MAX_SUB_TASK_DEPTH} levels. "
    "This parent already sits at the maximum depth."
)


def epic_membership_q(epic_ids, prefix: str = ""):
    """Match an epic or its L3/L4 descendants (fixed hierarchy depth — no CTE).

    Reuses the legacy ``module_id`` filter property key; values are epic issue IDs.
    """
    from django.db.models import Q

    ids = [epic_id for epic_id in (epic_ids or []) if epic_id is not None]
    if not ids:
        return Q()
    return (
        Q(**{f"{prefix}id__in": ids})
        | Q(**{f"{prefix}parent_id__in": ids})
        | Q(**{f"{prefix}parent__parent_id__in": ids})
    )
