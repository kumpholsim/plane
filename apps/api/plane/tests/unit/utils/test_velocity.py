# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from datetime import timedelta

import pytest
from django.utils import timezone

from plane.db.models import (
    Cycle,
    CycleIssue,
    Estimate,
    EstimatePoint,
    Issue,
    IssueAssignee,
    Project,
    ProjectHierarchyType,
    ProjectMember,
    State,
)
from plane.db.models.estimate import EstimateType
from plane.utils.hierarchy_status import BOARD_STATE_EXTERNAL_PREFIX
from plane.utils.velocity import (
    build_individual_velocity,
    build_project_velocity,
    credit_status,
    is_completed_sprint,
    parse_leave_days,
    role_key,
)


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(
        name="Velocity Project",
        identifier="VEL",
        workspace=workspace,
        created_by=create_user,
        workflow_mode="staged_gate_scrumban",
    )
    ProjectMember.objects.create(project=project, member=create_user, workspace=workspace, role=20, is_active=True)
    return project


def _estimate_point(project, create_user, value="5"):
    estimate = Estimate.objects.create(
        name="Points",
        type=EstimateType.POINTS,
        project=project,
        created_by=create_user,
    )
    return EstimatePoint.objects.create(
        estimate=estimate,
        project=project,
        key=int(value),
        value=value,
        created_by=create_user,
    )


def _state(project, create_user, *, name, group, key=None):
    return State.objects.create(
        name=name,
        group=group,
        project=project,
        workspace=project.workspace,
        created_by=create_user,
        external_id=f"{BOARD_STATE_EXTERNAL_PREFIX}{key}" if key else None,
    )


def _cycle(project, create_user, *, name, ended=True, leave=None, days_ago=7):
    now = timezone.now()
    end = now - timedelta(days=days_ago) if ended else now + timedelta(days=7)
    start = end - timedelta(days=14)
    return Cycle.objects.create(
        name=name,
        project=project,
        workspace=project.workspace,
        owned_by=create_user,
        start_date=start,
        end_date=end,
        personal_holiday_days=leave or {},
    )


def _issue(project, create_user, *, name, state, estimate, level=4, hierarchy_type=None, parent=None):
    return Issue.objects.create(
        name=name,
        project=project,
        workspace=project.workspace,
        created_by=create_user,
        state=state,
        estimate_point=estimate,
        hierarchy_level=level,
        hierarchy_type=hierarchy_type,
        parent=parent,
    )


@pytest.mark.unit
def test_role_and_status_helpers():
    assert role_key("Design") == "design"
    assert role_key("unknown") == "uncategorized"
    assert credit_status(f"{BOARD_STATE_EXTERNAL_PREFIX}done", "started") == "done"
    assert credit_status(None, "completed") == "done"
    assert credit_status(f"{BOARD_STATE_EXTERNAL_PREFIX}design_dev_under_review", "started") == "under_review"
    assert parse_leave_days({str("abc"): 1.5}, "abc") == 1.5
    assert is_completed_sprint(timezone.now() - timedelta(days=1)) is True
    assert is_completed_sprint(timezone.now() + timedelta(days=1)) is False


@pytest.mark.unit
@pytest.mark.django_db
def test_project_velocity_counts_under_review_and_done_not_todo(project, create_user):
    estimate = _estimate_point(project, create_user, "5")
    done = _state(project, create_user, name="Done", group="completed", key="done")
    review = _state(project, create_user, name="Under Review", group="started", key="design_dev_under_review")
    todo = _state(project, create_user, name="To Do", group="unstarted", key="design_dev_todo")
    progress = _state(project, create_user, name="In Progress", group="started", key="design_dev_in_progress")
    design = ProjectHierarchyType.objects.create(
        name="Design", color="#F97316", level=4, project=project, created_by=create_user
    )
    cycle = _cycle(project, create_user, name="S1", leave={str(create_user.id): 2})

    for name, state in (("done", done), ("review", review), ("todo", todo), ("wip", progress)):
        issue = _issue(project, create_user, name=name, state=state, estimate=estimate, hierarchy_type=design)
        IssueAssignee.objects.create(issue=issue, assignee=create_user, project=project, workspace=project.workspace)
        CycleIssue.objects.create(issue=issue, cycle=cycle, project=project, workspace=project.workspace)

    payload = build_project_velocity(project.workspace.slug, create_user, [project.id])
    assert payload["kpis"]["last_sprint_sp"] == 10.0
    assert payload["kpis"]["team_avg_velocity"] == 10.0
    assert payload["people"][0]["personal_leave_days"] == 2.0
    assert payload["people"][0]["design"] == 10.0


@pytest.mark.unit
@pytest.mark.django_db
def test_average_ignores_current_sprint(project, create_user):
    estimate = _estimate_point(project, create_user, "3")
    done = _state(project, create_user, name="Done", group="completed", key="done")
    past = _cycle(project, create_user, name="Past", ended=True)
    current = _cycle(project, create_user, name="Current", ended=False)
    for cycle in (past, current):
        issue = _issue(project, create_user, name=cycle.name, state=done, estimate=estimate)
        IssueAssignee.objects.create(issue=issue, assignee=create_user, project=project, workspace=project.workspace)
        CycleIssue.objects.create(issue=issue, cycle=cycle, project=project, workspace=project.workspace)

    payload = build_project_velocity(project.workspace.slug, create_user, [project.id])
    assert payload["kpis"]["completed_sprint_count"] == 1
    assert payload["kpis"]["team_avg_velocity"] == 3.0
    assert len(payload["comparison"]) == 2


@pytest.mark.unit
@pytest.mark.django_db
def test_classic_completed_counts_and_staged_gate_l3_does_not(workspace, create_user):
    classic = Project.objects.create(
        name="Classic",
        identifier="CLS",
        workspace=workspace,
        created_by=create_user,
        workflow_mode="scrum",
    )
    ProjectMember.objects.create(project=classic, member=create_user, workspace=workspace, role=20, is_active=True)
    estimate = _estimate_point(classic, create_user, "8")
    done = _state(classic, create_user, name="Done", group="completed")
    cycle = _cycle(classic, create_user, name="Classic S1")
    issue = _issue(classic, create_user, name="Classic story", state=done, estimate=estimate, level=3)
    IssueAssignee.objects.create(issue=issue, assignee=create_user, project=classic, workspace=workspace)
    CycleIssue.objects.create(issue=issue, cycle=cycle, project=classic, workspace=workspace)

    staged = Project.objects.create(
        name="Staged",
        identifier="STG",
        workspace=workspace,
        created_by=create_user,
        workflow_mode="staged_gate_scrumban",
    )
    ProjectMember.objects.create(project=staged, member=create_user, workspace=workspace, role=20, is_active=True)
    staged_estimate = _estimate_point(staged, create_user, "8")
    staged_done = _state(staged, create_user, name="Done", group="completed", key="done")
    staged_cycle = _cycle(staged, create_user, name="Staged S1")
    l3 = _issue(staged, create_user, name="L3 story", state=staged_done, estimate=staged_estimate, level=3)
    IssueAssignee.objects.create(issue=l3, assignee=create_user, project=staged, workspace=workspace)
    CycleIssue.objects.create(issue=l3, cycle=staged_cycle, project=staged, workspace=workspace)

    classic_payload = build_project_velocity(workspace.slug, create_user, [classic.id])
    staged_payload = build_project_velocity(workspace.slug, create_user, [staged.id])
    assert classic_payload["kpis"]["last_sprint_sp"] == 8.0
    assert staged_payload["kpis"]["last_sprint_sp"] == 0.0


@pytest.mark.unit
@pytest.mark.django_db
def test_individual_mode_includes_under_review(project, create_user):
    estimate = _estimate_point(project, create_user, "2")
    review = _state(project, create_user, name="Under Review", group="started", key="design_dev_under_review")
    cycle = _cycle(project, create_user, name="S2", leave={str(create_user.id): 1})
    issue = _issue(project, create_user, name="Review card", state=review, estimate=estimate)
    IssueAssignee.objects.create(issue=issue, assignee=create_user, project=project, workspace=project.workspace)
    CycleIssue.objects.create(issue=issue, cycle=cycle, project=project, workspace=project.workspace)

    payload = build_individual_velocity(project.workspace.slug, create_user, str(create_user.id))
    assert payload["kpis"]["total_story_points"] == 2.0
    assert payload["kpis"]["personal_leave_days"] == 1.0
    assert payload["work_items"]["items"][0]["status"] == "under_review"
