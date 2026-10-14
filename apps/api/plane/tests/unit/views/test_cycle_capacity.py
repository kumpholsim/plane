# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from datetime import timedelta

import pytest
from django.utils import timezone

from plane.app.views.cycle.base import CycleCapacityEndpoint
from plane.db.models import Cycle, Project, ProjectMember, WorkspacePublicHoliday


@pytest.mark.unit
@pytest.mark.django_db
def test_capacity_deducts_workspace_public_holidays_inside_sprint(workspace, create_user):
    project = Project.objects.create(
        name="Capacity Project",
        identifier="CAP",
        workspace=workspace,
        created_by=create_user,
        workflow_mode="staged_gate_scrumban",
    )
    ProjectMember.objects.create(project=project, member=create_user, workspace=workspace, role=20, is_active=True)
    # Future sprint so time decay stays at zero.
    start = timezone.now() + timedelta(days=30)
    end = start + timedelta(days=9)
    cycle = Cycle.objects.create(
        name="Sprint",
        project=project,
        workspace=workspace,
        owned_by=create_user,
        start_date=start,
        end_date=end,
    )
    WorkspacePublicHoliday.objects.create(workspace=workspace, date=(start + timedelta(days=1)).date(), name="A")
    WorkspacePublicHoliday.objects.create(workspace=workspace, date=(start + timedelta(days=3)).date(), name="B")
    WorkspacePublicHoliday.objects.create(workspace=workspace, date=(end + timedelta(days=5)).date(), name="Later")

    payload, error = CycleCapacityEndpoint()._build_capacity_payload(workspace.slug, project.id, cycle.id)

    assert error is None
    assert payload["public_holiday_days"] == 2
    assert [holiday["name"] for holiday in payload["public_holidays"]] == ["A", "B"]
    assert payload["members"][0]["capacity_max"] == 15 - 1.5 * 2
