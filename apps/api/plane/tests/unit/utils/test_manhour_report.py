# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from datetime import timedelta

import pytest
from django.utils import timezone

from plane.db.models import Estimate, EstimatePoint, Issue, IssueAssignee, ManhourManualEntry, Project, ProjectMember, State
from plane.db.models.estimate import EstimateType
from plane.utils.manhour_report import build_manhour_report, format_duration_hms, parse_report_dates


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(
        name="Manhour Project",
        identifier="MHR",
        workspace=workspace,
        created_by=create_user,
        workflow_mode="staged_gate_scrumban",
    )
    ProjectMember.objects.create(project=project, member=create_user, workspace=workspace, role=20, is_active=True)
    return project


def _state(project, create_user):
    return State.objects.create(
        name="To Do",
        group="unstarted",
        project=project,
        workspace=project.workspace,
        created_by=create_user,
    )


def _estimate_point(project, create_user, value="1"):
    estimate = Estimate.objects.create(
        name="Points",
        type=EstimateType.POINTS,
        project=project,
        created_by=create_user,
    )
    return EstimatePoint.objects.create(
        estimate=estimate,
        project=project,
        key=int(float(value)),
        value=value,
        created_by=create_user,
    )


def _issue(project, create_user, state, *, name, manhour=None, estimate=None, level=4):
    return Issue.objects.create(
        name=name,
        project=project,
        workspace=project.workspace,
        created_by=create_user,
        state=state,
        hierarchy_level=level,
        manhour=manhour,
        estimate_point=estimate,
    )


@pytest.mark.unit
def test_format_duration_hms():
    assert format_duration_hms(0.25) == "0:15:00"
    assert format_duration_hms(1.5) == "1:30:00"
    assert format_duration_hms(8) == "8:00:00"
    assert format_duration_hms(None) == "0:00:00"
    assert format_duration_hms(-1) == "0:00:00"


@pytest.mark.unit
def test_parse_report_dates_rejects_inverted_range():
    start, end = parse_report_dates("2026-09-30", "2026-09-01")
    assert start is None
    assert end is None
    start, end = parse_report_dates("2026-09-01", "2026-09-30")
    assert start.isoformat() == "2026-09-01"
    assert end.isoformat() == "2026-09-30"


@pytest.mark.unit
@pytest.mark.django_db
def test_report_filters_dates_and_merges_l4_with_standalone(project, create_user):
    now = timezone.now()
    state = _state(project, create_user)
    one_sp = _estimate_point(project, create_user, "1")
    in_range = _issue(project, create_user, state, name="In range L4", estimate=one_sp)
    IssueAssignee.objects.create(issue=in_range, assignee=create_user, project=project, workspace=project.workspace)
    Issue.objects.filter(id=in_range.id).update(created_at=now - timedelta(days=2))

    empty_hours = _issue(project, create_user, state, name="Empty hours", manhour=None)
    IssueAssignee.objects.create(issue=empty_hours, assignee=create_user, project=project, workspace=project.workspace)
    Issue.objects.filter(id=empty_hours.id).update(created_at=now - timedelta(days=1))

    old = _issue(project, create_user, state, name="Old L4", manhour=8)
    IssueAssignee.objects.create(issue=old, assignee=create_user, project=project, workspace=project.workspace)
    Issue.objects.filter(id=old.id).update(created_at=now - timedelta(days=40))

    l3 = _issue(project, create_user, state, name="L3 story", manhour=4, level=3)
    IssueAssignee.objects.create(issue=l3, assignee=create_user, project=project, workspace=project.workspace)
    Issue.objects.filter(id=l3.id).update(created_at=now - timedelta(days=1))

    start = (now - timedelta(days=5)).date()
    end = now.date()
    ManhourManualEntry.objects.create(
        workspace=project.workspace,
        user=create_user,
        description="Offline work",
        manhour=0.25,
        entry_date=start,
        created_by=create_user,
    )
    ManhourManualEntry.objects.create(
        workspace=project.workspace,
        user=create_user,
        description="Out of range",
        manhour=3,
        entry_date=start - timedelta(days=10),
        created_by=create_user,
    )

    payload = build_manhour_report(
        project.workspace.slug,
        create_user,
        str(create_user.id),
        start.isoformat(),
        end.isoformat(),
    )
    descriptions = [row["description"] for row in payload["rows"]]
    assert descriptions == ["Offline work", "In range L4", "Empty hours"]
    assert payload["rows"][0]["source"] == "standalone"
    assert payload["rows"][0]["duration"] == "0:15:00"
    assert payload["rows"][1]["source"] == "issue"
    assert payload["rows"][1]["duration"] == "8:00:00"
    assert payload["rows"][2]["duration"] == "0:00:00"
    assert payload["summary"]["total_hours"] == 8.25
    assert payload["summary"]["row_count"] == 3
    assert payload["member"]["id"] == str(create_user.id)
