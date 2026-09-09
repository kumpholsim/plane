# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from types import SimpleNamespace

import pytest

from plane.utils.hierarchy_status import (
    BOARD_STATE_DONE,
    BOARD_STATE_EXTERNAL_PREFIX,
    PROGRESS_DESIGN_DONE_NO_DEV,
    PROGRESS_DESIGN_TODO,
    PROGRESS_DEV_DONE_NO_QA,
    PROGRESS_QA_DONE,
    is_story_fully_done,
    issue_ids_to_transfer_from_cycle,
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
