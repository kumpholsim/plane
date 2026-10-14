# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Workspace public holiday calendar shared by sprint capacity and the manhour report."""

from plane.db.models import WorkspacePublicHoliday


def serialize_public_holiday(holiday) -> dict:
    return {
        "id": str(holiday.id),
        "date": holiday.date.isoformat(),
        "name": holiday.name or "",
    }


def workspace_public_holidays(slug: str, start=None, end=None) -> list[dict]:
    """Holidays for the workspace, optionally limited to an inclusive date range."""
    queryset = WorkspacePublicHoliday.objects.filter(workspace__slug=slug)
    if start:
        queryset = queryset.filter(date__gte=start)
    if end:
        queryset = queryset.filter(date__lte=end)
    return [serialize_public_holiday(holiday) for holiday in queryset.order_by("date")]
