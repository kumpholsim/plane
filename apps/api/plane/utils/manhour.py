# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

MANHOUR_HOURS_PER_SP = 8.0


def normalize_manhour(value, hierarchy_level):
    """Parse and validate an L4 manhour value. Empty values clear the field."""
    if value in (None, ""):
        return None
    if hierarchy_level != 4:
        raise ValueError("Manhour is only valid for sub-tasks (L4).")
    try:
        parsed = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("Manhour must be a number.") from exc
    if parsed < 0:
        raise ValueError("Manhour cannot be negative.")
    return parsed


def manhour_from_estimate_value(value):
    """Convert an estimate point value (story points) to manhour. 1 SP = 8 hours."""
    if value in (None, ""):
        return None
    try:
        story_points = float(value)
    except (TypeError, ValueError):
        return None
    if story_points < 0:
        return None
    return story_points * MANHOUR_HOURS_PER_SP


def apply_manhour_auto_convert_for_project(project_id):
    """Overwrite L4 manhour from each issue's story-point estimate."""
    from plane.db.models import EstimatePoint, Issue

    points = {
        str(point_id): value
        for point_id, value in EstimatePoint.objects.filter(project_id=project_id).values_list("id", "value")
    }
    updates = []
    for issue in Issue.issue_objects.filter(project_id=project_id, hierarchy_level=4).iterator():
        estimate_value = points.get(str(issue.estimate_point_id)) if issue.estimate_point_id else None
        next_manhour = manhour_from_estimate_value(estimate_value)
        if issue.manhour != next_manhour:
            issue.manhour = next_manhour
            updates.append(issue)
    if updates:
        Issue.objects.bulk_update(updates, ["manhour"], batch_size=200)
    return len(updates)
