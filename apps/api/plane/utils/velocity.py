# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Workspace velocity: credited story points for staged-gate and classic boards."""

from collections import defaultdict
from datetime import datetime

from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from plane.db.models import Issue, ProjectMember
from plane.db.models.state import WORKFLOW_MODE_STAGED_GATE_SCRUMBAN
from plane.utils.hierarchy_status import (
    BOARD_STATE_DESIGN_DEV_UNDER_REVIEW,
    BOARD_STATE_DONE,
    BOARD_STATE_EXTERNAL_PREFIX,
)
from plane.utils.issue_parent import HIERARCHY_LEVEL_EPIC, HIERARCHY_LEVEL_SUB_TASK

UNDER_REVIEW_EXT = f"{BOARD_STATE_EXTERNAL_PREFIX}{BOARD_STATE_DESIGN_DEV_UNDER_REVIEW}"
DONE_EXT = f"{BOARD_STATE_EXTERNAL_PREFIX}{BOARD_STATE_DONE}"
ROLE_KEYS = ("design", "dev", "qa")


def credited_state_q() -> Q:
    """Under Review or Done — staged-gate L4 board keys, classic completed / review-named states."""
    staged_q = Q(
        project__workflow_mode=WORKFLOW_MODE_STAGED_GATE_SCRUMBAN,
        hierarchy_level=HIERARCHY_LEVEL_SUB_TASK,
        state__external_id__in=[UNDER_REVIEW_EXT, DONE_EXT],
    )
    classic_q = (
        ~Q(project__workflow_mode=WORKFLOW_MODE_STAGED_GATE_SCRUMBAN)
        & Q(hierarchy_level__gt=HIERARCHY_LEVEL_EPIC)  # exclude L1/L2
        & (
            Q(state__group="completed")
            | Q(state__external_id__in=[UNDER_REVIEW_EXT, DONE_EXT])
            | Q(state__name__iregex=r"under\s*review|in\s*review")
        )
    )
    return staged_q | classic_q


def role_key(name: str | None) -> str:
    normalized = (name or "").strip().lower()
    if normalized in ROLE_KEYS:
        return normalized
    return "uncategorized"


def credit_status(external_id: str | None, group: str | None) -> str:
    if external_id == DONE_EXT or group == "completed":
        return "done"
    return "under_review"


def parse_leave_days(personal_holiday_days, user_id: str) -> float:
    if not isinstance(personal_holiday_days, dict):
        return 0.0
    raw = personal_holiday_days.get(str(user_id), 0)
    try:
        return float(raw or 0)
    except (TypeError, ValueError):
        return 0.0


def _as_aware(value):
    if value is None:
        return None
    if isinstance(value, str):
        value = parse_datetime(value)
    if value is None:
        return None
    if timezone.is_naive(value):
        return timezone.make_aware(value, timezone.utc)
    return value


def is_completed_sprint(end_date, now=None) -> bool:
    end = _as_aware(end_date)
    if end is None:
        return False
    now = now or timezone.now()
    return end < now


def _float_estimate(value) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def member_project_ids(slug: str, user) -> list:
    return list(
        ProjectMember.objects.filter(
            workspace__slug=slug,
            member=user,
            is_active=True,
        ).values_list("project_id", flat=True)
    )


def credited_issue_rows(slug: str, project_ids, assignee_id=None):
    qs = (
        Issue.issue_objects.filter(
            workspace__slug=slug,
            estimate_point__isnull=False,
            issue_cycle__deleted_at__isnull=True,
            project_id__in=project_ids,
        )
        .filter(credited_state_q())
        .filter(Q(issue_assignee__deleted_at__isnull=True) | Q(assignees__isnull=True))
    )
    if assignee_id:
        qs = qs.filter(assignees__id=assignee_id)
    return list(
        qs.values(
            "id",
            "name",
            "sequence_id",
            "project_id",
            "project__name",
            "project__identifier",
            "project__workflow_mode",
            "issue_cycle__cycle_id",
            "issue_cycle__cycle__name",
            "issue_cycle__cycle__end_date",
            "issue_cycle__cycle__start_date",
            "issue_cycle__cycle__personal_holiday_days",
            "hierarchy_type__name",
            "hierarchy_level",
            "assignees__id",
            "assignees__display_name",
            "assignees__first_name",
            "assignees__last_name",
            "estimate_point__value",
            "parent_id",
            "parent__name",
            "parent__sequence_id",
            "state__name",
            "state__group",
            "state__external_id",
            "completed_at",
        )
    )


def _empty_role_totals():
    return {key: 0.0 for key in (*ROLE_KEYS, "uncategorized")}


def build_work_item(row) -> dict:
    points = _float_estimate(row.get("estimate_point__value"))
    identifier = f"{row.get('project__identifier') or 'WI'}-{row.get('sequence_id')}"
    parent_identifier = None
    if row.get("parent_id") and row.get("parent__sequence_id") is not None:
        parent_identifier = f"{row.get('project__identifier') or 'WI'}-{row.get('parent__sequence_id')}"
    completed_at = row.get("completed_at")
    return {
        "id": str(row["id"]),
        "identifier": identifier,
        "name": row.get("name") or "",
        "project_id": str(row["project_id"]),
        "project_name": row.get("project__name") or "",
        "cycle_id": str(row["issue_cycle__cycle_id"]) if row.get("issue_cycle__cycle_id") else None,
        "cycle_name": row.get("issue_cycle__cycle__name") or "",
        "role": role_key(row.get("hierarchy_type__name")),
        "story_points": round(points, 2),
        "status": credit_status(row.get("state__external_id"), row.get("state__group")),
        "state_name": row.get("state__name") or "",
        "completed_at": completed_at.isoformat() if isinstance(completed_at, datetime) else completed_at,
        "hierarchy_level": row.get("hierarchy_level"),
        "parent_id": str(row["parent_id"]) if row.get("parent_id") else None,
        "parent_identifier": parent_identifier,
        "parent_name": row.get("parent__name") or None,
    }


def build_project_velocity(slug: str, user, project_ids, focus_project_id=None, assignee_id=None, cycle_id=None):
    allowed = member_project_ids(slug, user)
    selected = [pid for pid in (project_ids or allowed) if pid in set(allowed)]
    if not selected:
        return _empty_project_payload()

    rows = credited_issue_rows(slug, selected)
    now = timezone.now()

    # Unique issue+cycle+assignee credits (values() already flattened)
    comparison_map = defaultdict(lambda: {"story_points": 0.0})
    role_by_sprint = defaultdict(_empty_role_totals)
    people_map = defaultdict(
        lambda: {
            **_empty_role_totals(),
            "total": 0.0,
            "sprint_ids": set(),
            "display_name": "",
            "first_name": "",
            "last_name": "",
        }
    )
    leave_by_person_sprint = {}

    focus_id = str(focus_project_id) if focus_project_id else (str(selected[0]) if len(selected) == 1 else None)
    if focus_id and focus_id not in {str(pid) for pid in selected}:
        focus_id = str(selected[0])

    seen_issue_assignee = set()
    for row in rows:
        cycle_pk = row.get("issue_cycle__cycle_id")
        if not cycle_pk:
            continue
        issue_id = row["id"]
        assignee = row.get("assignees__id")
        credit_key = (issue_id, cycle_pk, assignee)
        if credit_key in seen_issue_assignee:
            continue
        seen_issue_assignee.add(credit_key)

        points = _float_estimate(row.get("estimate_point__value"))
        project_id = str(row["project_id"])
        cycle_id_str = str(cycle_pk)
        role = role_key(row.get("hierarchy_type__name"))
        end_date = row.get("issue_cycle__cycle__end_date")
        label = row.get("issue_cycle__cycle__name") or cycle_id_str
        if len(selected) > 1:
            label = f"{row.get('project__name') or project_id} · {label}"

        cmp_key = (project_id, cycle_id_str)
        if cmp_key not in comparison_map or comparison_map[cmp_key].get("cycle_id") is None:
            comparison_map[cmp_key].update(
                {
                    "project_id": project_id,
                    "project_name": row.get("project__name") or "",
                    "cycle_id": cycle_id_str,
                    "cycle_name": row.get("issue_cycle__cycle__name") or "",
                    "end_date": end_date.isoformat() if end_date else None,
                    "workflow_mode": row.get("project__workflow_mode") or "scrum",
                    "label": label,
                    "is_completed": is_completed_sprint(end_date, now),
                }
            )
        comparison_map[cmp_key]["story_points"] += points

        if focus_id is None or project_id == focus_id:
            role_by_sprint[cycle_id_str][role] += points
            role_by_sprint[cycle_id_str]["_cycle_name"] = row.get("issue_cycle__cycle__name") or ""
            role_by_sprint[cycle_id_str]["_end_date"] = end_date
            role_by_sprint[cycle_id_str]["_is_completed"] = is_completed_sprint(end_date, now)

            if assignee:
                person = people_map[str(assignee)]
                person[role] += points
                person["total"] += points
                person["sprint_ids"].add(cycle_id_str)
                person["display_name"] = row.get("assignees__display_name") or person["display_name"]
                person["first_name"] = row.get("assignees__first_name") or person["first_name"]
                person["last_name"] = row.get("assignees__last_name") or person["last_name"]
                leave_key = (str(assignee), cycle_id_str)
                if leave_key not in leave_by_person_sprint:
                    leave_by_person_sprint[leave_key] = parse_leave_days(
                        row.get("issue_cycle__cycle__personal_holiday_days"), str(assignee)
                    )

    comparison = sorted(
        (
            {
                **entry,
                "story_points": round(entry["story_points"], 2),
            }
            for entry in comparison_map.values()
            if entry.get("cycle_id")
        ),
        key=lambda item: (item.get("end_date") or "", item.get("label") or ""),
    )

    role_rows = []
    for cycle_id_str, totals in role_by_sprint.items():
        role_rows.append(
            {
                "cycle_id": cycle_id_str,
                "cycle_name": totals.get("_cycle_name") or "",
                "end_date": totals["_end_date"].isoformat() if totals.get("_end_date") else None,
                "is_completed": bool(totals.get("_is_completed")),
                "design": round(totals["design"], 2),
                "dev": round(totals["dev"], 2),
                "qa": round(totals["qa"], 2),
                "uncategorized": round(totals["uncategorized"], 2),
            }
        )
    role_rows.sort(key=lambda item: (item.get("end_date") or "", item.get("cycle_name") or ""))

    focus_completed = [row for row in comparison if (focus_id is None or row["project_id"] == focus_id) and row["is_completed"]]
    completed_count = len({row["cycle_id"] for row in focus_completed})
    completed_sp = sum(row["story_points"] for row in focus_completed)
    last_sprint_sp = focus_completed[-1]["story_points"] if focus_completed else 0.0

    completed_role = [row for row in role_rows if row["is_completed"]]
    role_avg_denom = len(completed_role) or 1
    kpis = {
        "team_avg_velocity": round(completed_sp / completed_count, 2) if completed_count else 0.0,
        "last_sprint_sp": round(last_sprint_sp, 2),
        "avg_design": round(sum(row["design"] for row in completed_role) / role_avg_denom, 2) if completed_role else 0.0,
        "avg_dev": round(sum(row["dev"] for row in completed_role) / role_avg_denom, 2) if completed_role else 0.0,
        "avg_qa": round(sum(row["qa"] for row in completed_role) / role_avg_denom, 2) if completed_role else 0.0,
        "people_count": len(people_map),
        "completed_sprint_count": completed_count,
        "focus_project_id": focus_id,
    }

    people = []
    for user_id, person in people_map.items():
        sprint_count = len(person["sprint_ids"])
        leave_days = sum(leave_by_person_sprint.get((user_id, sid), 0.0) for sid in person["sprint_ids"])
        people.append(
            {
                "user_id": user_id,
                "display_name": person["display_name"] or f"{person['first_name']} {person['last_name']}".strip(),
                "first_name": person["first_name"],
                "last_name": person["last_name"],
                "design": round(person["design"], 2),
                "dev": round(person["dev"], 2),
                "qa": round(person["qa"], 2),
                "uncategorized": round(person["uncategorized"], 2),
                "total": round(person["total"], 2),
                "avg_per_sprint": round(person["total"] / sprint_count, 2) if sprint_count else 0.0,
                "sprint_count": sprint_count,
                "personal_leave_days": round(leave_days, 2),
            }
        )
    people.sort(key=lambda item: (item["display_name"] or "").lower())

    work_items = None
    if assignee_id:
        item_rows = [
            row
            for row in rows
            if str(row.get("assignees__id") or "") == str(assignee_id)
            and (focus_id is None or str(row["project_id"]) == focus_id)
            and (not cycle_id or str(row.get("issue_cycle__cycle_id")) == str(cycle_id))
        ]
        seen_items = set()
        items = []
        for row in item_rows:
            key = (row["id"], row.get("issue_cycle__cycle_id"))
            if key in seen_items:
                continue
            seen_items.add(key)
            items.append(build_work_item(row))
        work_items = {"items": items}

    return {
        "kpis": kpis,
        "comparison": comparison,
        "role_by_sprint": role_rows,
        "people": people,
        "work_items": work_items,
    }


def _empty_project_payload():
    return {
        "kpis": {
            "team_avg_velocity": 0.0,
            "last_sprint_sp": 0.0,
            "avg_design": 0.0,
            "avg_dev": 0.0,
            "avg_qa": 0.0,
            "people_count": 0,
            "completed_sprint_count": 0,
            "focus_project_id": None,
        },
        "comparison": [],
        "role_by_sprint": [],
        "people": [],
        "work_items": None,
    }


def build_individual_velocity(slug: str, user, assignee_id, cycle_id=None):
    allowed = member_project_ids(slug, user)
    if not allowed or not assignee_id:
        return _empty_individual_payload()

    rows = credited_issue_rows(slug, allowed, assignee_id=assignee_id)
    now = timezone.now()
    sprint_map = {}
    seen = set()
    items = []
    leave_by_sprint = {}
    total_sp = 0.0
    ticket_ids = set()

    for row in rows:
        cycle_pk = row.get("issue_cycle__cycle_id")
        if not cycle_pk:
            continue
        key = (row["id"], cycle_pk)
        if key in seen:
            continue
        seen.add(key)

        points = _float_estimate(row.get("estimate_point__value"))
        cycle_id_str = str(cycle_pk)
        end_date = row.get("issue_cycle__cycle__end_date")
        if cycle_id_str not in sprint_map:
            sprint_map[cycle_id_str] = {
                "project_id": str(row["project_id"]),
                "project_name": row.get("project__name") or "",
                "cycle_id": cycle_id_str,
                "cycle_name": row.get("issue_cycle__cycle__name") or "",
                "end_date": end_date.isoformat() if end_date else None,
                "story_points": 0.0,
                "is_completed": is_completed_sprint(end_date, now),
                "personal_leave_days": parse_leave_days(
                    row.get("issue_cycle__cycle__personal_holiday_days"), str(assignee_id)
                ),
            }
            leave_by_sprint[cycle_id_str] = sprint_map[cycle_id_str]["personal_leave_days"]
        sprint_map[cycle_id_str]["story_points"] += points
        total_sp += points
        ticket_ids.add(row["id"])
        if not cycle_id or str(cycle_pk) == str(cycle_id):
            items.append(build_work_item(row))

    sprints = sorted(
        ({**entry, "story_points": round(entry["story_points"], 2)} for entry in sprint_map.values()),
        key=lambda item: (item.get("end_date") or "", item.get("cycle_name") or ""),
    )
    completed = [row for row in sprints if row["is_completed"]]
    completed_count = len(completed)
    completed_sp = sum(row["story_points"] for row in completed)
    leave_days = sum(row["personal_leave_days"] for row in sprints)

    return {
        "kpis": {
            "total_story_points": round(total_sp, 2),
            "avg_per_sprint": round(completed_sp / completed_count, 2) if completed_count else 0.0,
            "sprint_count": completed_count,
            "ticket_count": len(ticket_ids),
            "personal_leave_days": round(leave_days, 2),
        },
        "sprints": sprints,
        "work_items": {"items": items},
    }


def _empty_individual_payload():
    return {
        "kpis": {
            "total_story_points": 0.0,
            "avg_per_sprint": 0.0,
            "sprint_count": 0,
            "ticket_count": 0,
            "personal_leave_days": 0.0,
        },
        "sprints": [],
        "work_items": {"items": []},
    }


__all__ = [
    "credited_state_q",
    "role_key",
    "credit_status",
    "parse_leave_days",
    "is_completed_sprint",
    "build_project_velocity",
    "build_individual_velocity",
]
