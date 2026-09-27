# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Individual manhour report: L4 cards plus standalone workspace entries."""

from datetime import datetime, time

from django.core.exceptions import ValidationError
from django.utils import timezone
from django.utils.dateparse import parse_date

from plane.db.models import Issue, ManhourManualEntry, User, WorkspaceMember
from plane.utils.issue_parent import HIERARCHY_LEVEL_SUB_TASK
from plane.utils.manhour import manhour_from_estimate_value
from plane.utils.velocity import member_project_ids


def format_duration_hms(hours) -> str:
    try:
        total_seconds = int(round(float(hours or 0) * 3600))
    except (TypeError, ValueError):
        total_seconds = 0
    if total_seconds < 0:
        total_seconds = 0
    hours_part, remainder = divmod(total_seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    return f"{hours_part}:{minutes:02d}:{seconds:02d}"


def parse_report_dates(start_raw: str | None, end_raw: str | None):
    start = parse_date(start_raw or "")
    end = parse_date(end_raw or "")
    if not start or not end or end < start:
        return None, None
    return start, end


def _day_bounds(start, end):
    tz = timezone.get_current_timezone()
    start_dt = timezone.make_aware(datetime.combine(start, time.min), tz)
    end_dt = timezone.make_aware(datetime.combine(end, time.max), tz)
    return start_dt, end_dt


def _issue_hours(issue) -> float:
    estimate_value = issue.estimate_point.value if issue.estimate_point_id and issue.estimate_point else None
    converted = manhour_from_estimate_value(estimate_value)
    if converted is not None:
        return converted
    return _float_hours(issue.manhour)


def _float_hours(value) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def member_display_name(user) -> str:
    name = (getattr(user, "display_name", None) or "").strip()
    if name:
        return name
    full = f"{getattr(user, 'first_name', '')} {getattr(user, 'last_name', '')}".strip()
    return full or getattr(user, "email", "") or ""


def workspace_member_exists(slug: str, user_id) -> bool:
    return WorkspaceMember.objects.filter(workspace__slug=slug, member_id=user_id, is_active=True).exists()


def _summarize(rows: list[dict], start, end) -> dict:
    total = sum(_float_hours(row.get("manhour")) for row in rows)
    day_count = max(1, (end - start).days + 1)
    average = total / day_count
    return {
        "total_hours": round(total, 2),
        "average_daily_hours": round(average, 2),
        "total_duration": format_duration_hms(total),
        "average_daily_duration": format_duration_hms(average),
        "row_count": len(rows),
        "day_count": day_count,
    }


def _issue_rows(slug: str, project_ids, assignee_id, start, end, member_name: str) -> list[dict]:
    if not project_ids:
        return []
    start_dt, end_dt = _day_bounds(start, end)
    issues = (
        Issue.issue_objects.filter(
            workspace__slug=slug,
            hierarchy_level=HIERARCHY_LEVEL_SUB_TASK,
            project_id__in=project_ids,
            created_at__gte=start_dt,
            created_at__lte=end_dt,
            issue_assignee__assignee_id=assignee_id,
            issue_assignee__deleted_at__isnull=True,
        )
        .select_related("project", "estimate_point")
        .distinct()
    )
    rows = []
    for issue in issues:
        hours = _issue_hours(issue)
        created_at = issue.created_at
        date_value = timezone.localtime(created_at).date() if created_at else start
        rows.append(
            {
                "id": str(issue.id),
                "source": "issue",
                "description": issue.name or "",
                "manhour": round(hours, 2),
                "duration": format_duration_hms(hours),
                "member": member_name,
                "project_id": str(issue.project_id) if issue.project_id else None,
                "project_name": issue.project.name if issue.project_id else "",
                "date": date_value.isoformat(),
                "created_at": created_at.isoformat() if created_at else date_value.isoformat(),
            }
        )
    return rows


def _standalone_rows(slug: str, assignee_id, start, end, member_name: str) -> list[dict]:
    entries = ManhourManualEntry.objects.filter(
        workspace__slug=slug,
        user_id=assignee_id,
        entry_date__gte=start,
        entry_date__lte=end,
    ).select_related("project")
    rows = []
    for entry in entries:
        hours = _float_hours(entry.manhour)
        created_at = entry.created_at
        rows.append(
            {
                "id": str(entry.id),
                "source": "standalone",
                "description": entry.description or "",
                "manhour": round(hours, 2),
                "duration": format_duration_hms(hours),
                "member": member_name,
                "project_id": str(entry.project_id) if entry.project_id else None,
                "project_name": entry.project.name if entry.project_id else "",
                "date": entry.entry_date.isoformat(),
                "created_at": created_at.isoformat() if created_at else entry.entry_date.isoformat(),
            }
        )
    return rows


def build_manhour_report(slug: str, user, assignee_id: str, start_raw: str | None, end_raw: str | None):
    start, end = parse_report_dates(start_raw, end_raw)
    if not start or not end:
        return None

    try:
        assignee = User.objects.get(id=assignee_id)
    except (User.DoesNotExist, ValueError, TypeError, ValidationError):
        return None
    if not workspace_member_exists(slug, assignee.id):
        return None

    member_name = member_display_name(assignee)
    project_ids = member_project_ids(slug, user)
    rows = _issue_rows(slug, project_ids, assignee.id, start, end, member_name)
    rows.extend(_standalone_rows(slug, assignee.id, start, end, member_name))
    rows.sort(key=lambda row: (row["date"], row["created_at"] or "", row["id"]))

    return {
        "member": {
            "id": str(assignee.id),
            "display_name": member_name,
            "first_name": assignee.first_name or "",
            "last_name": assignee.last_name or "",
        },
        "range": {
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
        },
        "summary": _summarize(rows, start, end),
        "rows": rows,
    }
