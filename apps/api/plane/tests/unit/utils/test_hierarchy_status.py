# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from types import SimpleNamespace

import pytest

from plane.utils.hierarchy_status import (
    BOARD_STATE_DONE,
    BOARD_STATE_DESIGN_DEV_TODO,
    BOARD_STATE_EXTERNAL_PREFIX,
    BOARD_STATE_QA_TODO,
    L4_LEAVE_TODO_REQUIRES_ASSIGNEE_AND_ESTIMATE,
    PROGRESS_DESIGN_DONE_NO_DEV,
    PROGRESS_DESIGN_TODO,
    PROGRESS_DEV_DONE_NO_QA,
    PROGRESS_QA_DONE,
    is_story_fully_done,
    issue_ids_to_transfer_from_cycle,
    l4_leave_todo_requirement_error,
)


def _state(key=None, group="unstarted", name="Todo"):
    external_id = f"{BOARD_STATE_EXTERNAL_PREFIX}{key}" if key else None
    return SimpleNamespace(external_id=external_id, group=group, name=name)


@pytest.mark.unit
def test_is_story_fully_done_requires_terminal_done_status(monkeypatch):
    issue = SimpleNamespace(hierarchy_level=3, progress_status=PROGRESS_DESIGN_TODO, id="1")
    assert is_story_fully_done(issue) is False

    monkeypatch.setattr("plane.utils.hierarchy_status.l4_children_all_in_done", lambda _i: True)
    for done_status in (PROGRESS_DESIGN_DONE_NO_DEV, PROGRESS_DEV_DONE_NO_QA, PROGRESS_QA_DONE):
        issue.progress_status = done_status
        assert is_story_fully_done(issue) is True

    monkeypatch.setattr(
        "plane.utils.hierarchy_status.l4_children_all_in_done",
        lambda _i: False,
    )
    assert is_story_fully_done(issue) is False


@pytest.mark.unit
def test_transfer_skips_fully_done_l3(monkeypatch):
    done_state = _state(BOARD_STATE_DONE, group="completed", name="Done")
    open_state = _state("design_dev_todo", group="unstarted", name="Design/Dev To do")

    fully_done_l3 = SimpleNamespace(
        id="l3-done",
        hierarchy_level=3,
        progress_status=PROGRESS_QA_DONE,
        parent_id=None,
        state=done_state,
        hierarchy_type=None,
    )
    open_l3 = SimpleNamespace(
        id="l3-open",
        hierarchy_level=3,
        progress_status=PROGRESS_DESIGN_TODO,
        parent_id=None,
        state=open_state,
        hierarchy_type=None,
    )
    l4_of_done = SimpleNamespace(
        id="l4-done",
        hierarchy_level=4,
        progress_status=None,
        parent_id="l3-done",
        state=done_state,
        hierarchy_type=None,
    )
    l4_of_open = SimpleNamespace(
        id="l4-open",
        hierarchy_level=4,
        progress_status=None,
        parent_id="l3-open",
        state=open_state,
        hierarchy_type=None,
    )

    issues = {
        "l3-done": fully_done_l3,
        "l3-open": open_l3,
        "l4-done": l4_of_done,
        "l4-open": l4_of_open,
    }

    class FakeCI:
        def __init__(self, issue_id):
            self.issue_id = issue_id
            self.issue = issues[issue_id]

    class FakeQS:
        def select_related(self, *args):
            return [FakeCI(i) for i in issues]

    monkeypatch.setattr(
        "plane.utils.hierarchy_status.is_story_fully_done",
        lambda issue: issue.id == "l3-done",
    )
    result = issue_ids_to_transfer_from_cycle(FakeQS())

    assert "l3-done" not in result
    assert "l4-done" not in result
    assert "l3-open" in result
    assert "l4-open" in result


@pytest.mark.unit
def test_dev_and_qa_cannot_leave_todo_without_assignee_and_estimate():
    todo = _state(BOARD_STATE_DESIGN_DEV_TODO, group="unstarted", name="To Do")
    in_progress = _state("design_dev_in_progress", group="started", name="In Progress")
    qa_todo = _state(BOARD_STATE_QA_TODO, group="started", name="QA To Do")
    qa_in_progress = _state("qa_in_progress", group="started", name="QA In Progress")
    dev_type = SimpleNamespace(name="Dev")
    qa_type = SimpleNamespace(name="QA")
    design_type = SimpleNamespace(name="Design")

    # Dev blocked without assignee/estimate
    assert (
        l4_leave_todo_requirement_error(
            hierarchy_level=4,
            hierarchy_type=dev_type,
            current_state=todo,
            next_state=in_progress,
            has_assignee=False,
            has_estimate=False,
        )
        == L4_LEAVE_TODO_REQUIRES_ASSIGNEE_AND_ESTIMATE
    )
    assert (
        l4_leave_todo_requirement_error(
            hierarchy_level=4,
            hierarchy_type=dev_type,
            current_state=todo,
            next_state=in_progress,
            has_assignee=True,
            has_estimate=False,
        )
        == L4_LEAVE_TODO_REQUIRES_ASSIGNEE_AND_ESTIMATE
    )
    # Dev allowed when both set
    assert (
        l4_leave_todo_requirement_error(
            hierarchy_level=4,
            hierarchy_type=dev_type,
            current_state=todo,
            next_state=in_progress,
            has_assignee=True,
            has_estimate=True,
        )
        is None
    )
    # QA blocked without both
    assert (
        l4_leave_todo_requirement_error(
            hierarchy_level=4,
            hierarchy_type=qa_type,
            current_state=qa_todo,
            next_state=qa_in_progress,
            has_assignee=False,
            has_estimate=True,
        )
        == L4_LEAVE_TODO_REQUIRES_ASSIGNEE_AND_ESTIMATE
    )
    # Design is not gated
    assert (
        l4_leave_todo_requirement_error(
            hierarchy_level=4,
            hierarchy_type=design_type,
            current_state=todo,
            next_state=in_progress,
            has_assignee=False,
            has_estimate=False,
        )
        is None
    )
    # Already out of To Do — no gate
    assert (
        l4_leave_todo_requirement_error(
            hierarchy_level=4,
            hierarchy_type=dev_type,
            current_state=in_progress,
            next_state=_state(BOARD_STATE_DONE, group="completed", name="Done"),
            has_assignee=False,
            has_estimate=False,
        )
        is None
    )
