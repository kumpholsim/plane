# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from datetime import timedelta
from types import SimpleNamespace

import pytest
from django.utils import timezone

from plane.db.models import Cycle, CycleIssue, Issue, State
from plane.tests.factories import ProjectFactory, UserFactory
from plane.utils.cycle_transfer_issues import (
    _source_cycle_has_ended,
    preview_cycle_transfer_issues,
    transfer_cycle_issues,
)
from plane.utils.hierarchy_status import PROGRESS_DESIGN_TODO, PROGRESS_QA_DONE
from plane.utils.issue_parent import HIERARCHY_LEVEL_DELIVERY


def _request():
    return SimpleNamespace()


def _create_cycle_with_issue(*, project, user, start_delta, end_delta, name):
    now = timezone.now()
    cycle = Cycle.objects.create(
        name=name,
        project=project,
        workspace=project.workspace,
        owned_by=user,
        start_date=now + timedelta(days=start_delta),
        end_date=now + timedelta(days=end_delta),
    )
    state = State.objects.create(
        name=f"Todo {name}",
        group="unstarted",
        project=project,
        workspace=project.workspace,
    )
    issue = Issue.objects.create(
        name=f"Item {name}",
        project=project,
        workspace=project.workspace,
        created_by=user,
        state=state,
    )
    CycleIssue.objects.create(
        issue=issue,
        cycle=cycle,
        project=project,
        workspace=project.workspace,
    )
    return cycle, issue


@pytest.mark.unit
def test_source_cycle_has_ended_requires_past_end_date():
    now = timezone.now()
    assert _source_cycle_has_ended(SimpleNamespace(end_date=None)) is False
    assert _source_cycle_has_ended(SimpleNamespace(end_date=now + timedelta(days=2))) is False
    assert _source_cycle_has_ended(SimpleNamespace(end_date=now - timedelta(hours=1))) is True


@pytest.mark.unit
class TestTransferCycleIssues:
    @pytest.mark.django_db
    def test_mid_sprint_transfer_moves_issue_without_snapshot(self, monkeypatch):
        user = UserFactory()
        project = ProjectFactory(created_by=user, updated_by=user)
        source, issue = _create_cycle_with_issue(
            project=project, user=user, start_delta=-3, end_delta=4, name="Current"
        )
        destination, _ = _create_cycle_with_issue(
            project=project, user=user, start_delta=5, end_delta=12, name="Next"
        )

        monkeypatch.setattr("plane.utils.cycle_transfer_issues.issue_activity.delay", lambda **_k: None)
        monkeypatch.setattr("plane.utils.cycle_transfer_issues.base_host", lambda **_k: "https://plane.test")

        result = transfer_cycle_issues(
            slug=project.workspace.slug,
            project_id=project.id,
            cycle_id=source.id,
            new_cycle_id=destination.id,
            request=_request(),
            user_id=user.id,
        )

        assert result == {"success": True}
        source.refresh_from_db()
        assert source.progress_snapshot in ({}, None) or source.progress_snapshot == {}
        assert not source.progress_snapshot
        assert CycleIssue.objects.filter(cycle_id=destination.id, issue_id=issue.id).exists()
        assert not CycleIssue.objects.filter(cycle_id=source.id, issue_id=issue.id).exists()

    @pytest.mark.django_db
    def test_mid_sprint_transfer_can_run_twice(self, monkeypatch):
        user = UserFactory()
        project = ProjectFactory(created_by=user, updated_by=user)
        source, first = _create_cycle_with_issue(
            project=project, user=user, start_delta=-3, end_delta=4, name="Current"
        )
        destination, _ = _create_cycle_with_issue(
            project=project, user=user, start_delta=5, end_delta=12, name="Next"
        )
        extra_state = State.objects.create(
            name="Todo extra",
            group="unstarted",
            project=project,
            workspace=project.workspace,
        )

        monkeypatch.setattr("plane.utils.cycle_transfer_issues.issue_activity.delay", lambda **_k: None)
        monkeypatch.setattr("plane.utils.cycle_transfer_issues.base_host", lambda **_k: "https://plane.test")

        first_result = transfer_cycle_issues(
            slug=project.workspace.slug,
            project_id=project.id,
            cycle_id=source.id,
            new_cycle_id=destination.id,
            request=_request(),
            user_id=user.id,
        )
        assert first_result == {"success": True}

        leftover = Issue.objects.create(
            name="Leftover item",
            project=project,
            workspace=project.workspace,
            created_by=user,
            state=extra_state,
        )
        CycleIssue.objects.create(
            issue=leftover,
            cycle=source,
            project=project,
            workspace=project.workspace,
        )

        second_result = transfer_cycle_issues(
            slug=project.workspace.slug,
            project_id=project.id,
            cycle_id=source.id,
            new_cycle_id=destination.id,
            request=_request(),
            user_id=user.id,
        )
        assert second_result == {"success": True}
        source.refresh_from_db()
        assert not source.progress_snapshot
        assert CycleIssue.objects.filter(cycle_id=destination.id, issue_id=first.id).exists()
        assert CycleIssue.objects.filter(cycle_id=destination.id, issue_id=leftover.id).exists()

    @pytest.mark.django_db
    def test_after_end_transfer_writes_snapshot(self, monkeypatch):
        user = UserFactory()
        project = ProjectFactory(created_by=user, updated_by=user)
        source, issue = _create_cycle_with_issue(
            project=project, user=user, start_delta=-14, end_delta=-1, name="Ended"
        )
        destination, _ = _create_cycle_with_issue(
            project=project, user=user, start_delta=1, end_delta=8, name="Next"
        )

        monkeypatch.setattr("plane.utils.cycle_transfer_issues.issue_activity.delay", lambda **_k: None)
        monkeypatch.setattr("plane.utils.cycle_transfer_issues.base_host", lambda **_k: "https://plane.test")
        monkeypatch.setattr("plane.utils.cycle_transfer_issues.burndown_plot", lambda **_k: {})

        result = transfer_cycle_issues(
            slug=project.workspace.slug,
            project_id=project.id,
            cycle_id=source.id,
            new_cycle_id=destination.id,
            request=_request(),
            user_id=user.id,
        )

        assert result == {"success": True}
        source.refresh_from_db()
        assert source.progress_snapshot.get("total_issues") == 1
        assert CycleIssue.objects.filter(cycle_id=destination.id, issue_id=issue.id).exists()

    @pytest.mark.django_db
    def test_destination_completed_is_rejected(self, monkeypatch):
        user = UserFactory()
        project = ProjectFactory(created_by=user, updated_by=user)
        source, issue = _create_cycle_with_issue(
            project=project, user=user, start_delta=-3, end_delta=4, name="Current"
        )
        destination, _ = _create_cycle_with_issue(
            project=project, user=user, start_delta=-20, end_delta=-2, name="Past"
        )

        result = transfer_cycle_issues(
            slug=project.workspace.slug,
            project_id=project.id,
            cycle_id=source.id,
            new_cycle_id=destination.id,
            request=_request(),
            user_id=user.id,
        )

        assert result["success"] is False
        assert "already completed" in result["error"]
        assert CycleIssue.objects.filter(cycle_id=source.id, issue_id=issue.id).exists()

    @pytest.mark.django_db
    def test_preview_splits_fully_done_and_open_l3(self):
        user = UserFactory()
        project = ProjectFactory(created_by=user, updated_by=user)
        source, open_issue = _create_cycle_with_issue(
            project=project, user=user, start_delta=-3, end_delta=4, name="Current"
        )
        open_issue.hierarchy_level = HIERARCHY_LEVEL_DELIVERY
        open_issue.progress_status = PROGRESS_DESIGN_TODO
        open_issue.save(update_fields=["hierarchy_level", "progress_status"])

        done_state = State.objects.create(
            name="Done stay",
            group="completed",
            project=project,
            workspace=project.workspace,
        )
        done_issue = Issue.objects.create(
            name="Fully done story",
            project=project,
            workspace=project.workspace,
            created_by=user,
            state=done_state,
            hierarchy_level=HIERARCHY_LEVEL_DELIVERY,
            progress_status=PROGRESS_QA_DONE,
        )
        CycleIssue.objects.create(
            issue=done_issue,
            cycle=source,
            project=project,
            workspace=project.workspace,
        )

        preview = preview_cycle_transfer_issues(project.workspace.slug, project.id, source.id)
        staying_ids = {item["id"] for item in preview["staying"]}
        transferring_ids = {item["id"] for item in preview["transferring"]}

        assert str(done_issue.id) in staying_ids
        assert str(open_issue.id) in transferring_ids
        assert str(done_issue.id) not in transferring_ids
