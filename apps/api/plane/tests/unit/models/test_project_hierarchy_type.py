# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest

from plane.db.models import Issue, State, ProjectHierarchyType, DEFAULT_PROJECT_HIERARCHY_TYPES, ensure_default_project_hierarchy_types


@pytest.mark.unit
@pytest.mark.django_db
class TestProjectHierarchyType:
    def test_default_hierarchy_types_seed(self, project, create_user):
        created = ensure_default_project_hierarchy_types(project, created_by=create_user)
        assert len(created) == len(DEFAULT_PROJECT_HIERARCHY_TYPES)

        # Idempotent — second call creates nothing
        assert ensure_default_project_hierarchy_types(project, created_by=create_user) == []

        by_level = {}
        for t in ProjectHierarchyType.objects.filter(project=project):
            by_level.setdefault(t.level, []).append(t.name)

        assert by_level[1] == ["Milestone"]
        assert by_level[2] == ["Epic"]
        assert set(by_level[3]) == {"Story", "Bug", "Story-bug", "Task"}
        assert set(by_level[4]) == {"Design", "Dev", "QA"}

    def test_parented_issue_defaults_to_todo_state(self, project, create_user):
        todo = State.objects.create(
            name="Todo",
            group="unstarted",
            project=project,
            workspace=project.workspace,
            created_by=create_user,
        )
        State.objects.create(
            name="Backlog",
            group="backlog",
            default=True,
            project=project,
            workspace=project.workspace,
            created_by=create_user,
        )
        parent = Issue(
            name="Parent",
            project=project,
            workspace=project.workspace,
            created_by=create_user,
            hierarchy_level=3,
        )
        parent.save()
        child = Issue(
            name="Child",
            project=project,
            workspace=project.workspace,
            created_by=create_user,
            parent=parent,
            hierarchy_level=4,
        )
        child.save()
        assert child.state_id == todo.id
