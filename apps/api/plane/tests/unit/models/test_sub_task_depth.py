# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest

from plane.db.models import Issue
from plane.tests.factories import ProjectFactory, UserFactory
from plane.utils.issue_parent import (
    MAX_SUB_TASK_DEPTH,
    get_descendant_height,
    get_issue_depth,
    would_exceed_sub_task_depth,
)


@pytest.mark.unit
class TestSubTaskDepthLimit:
    @pytest.mark.django_db
    def test_depths_and_limit(self):
        user = UserFactory()
        project = ProjectFactory(created_by=user, updated_by=user)

        root = Issue.objects.create(name="Root", project=project, workspace=project.workspace, created_by=user)
        level1 = Issue.objects.create(
            name="L1",
            project=project,
            workspace=project.workspace,
            parent=root,
            created_by=user,
        )
        level2 = Issue.objects.create(
            name="L2",
            project=project,
            workspace=project.workspace,
            parent=level1,
            created_by=user,
        )
        level3 = Issue.objects.create(
            name="L3",
            project=project,
            workspace=project.workspace,
            parent=level2,
            created_by=user,
        )

        assert get_issue_depth(root) == 0
        assert get_issue_depth(level1) == 1
        assert get_issue_depth(level2) == 2
        assert get_issue_depth(level3) == 3
        assert MAX_SUB_TASK_DEPTH == 3

        assert would_exceed_sub_task_depth(root) is False
        assert would_exceed_sub_task_depth(level1) is False
        assert would_exceed_sub_task_depth(level2) is False
        assert would_exceed_sub_task_depth(level3) is True

        assert get_descendant_height(root.id) == 3
        assert get_descendant_height(level1.id) == 2
        assert get_descendant_height(level2.id) == 1
        assert get_descendant_height(level3.id) == 0

        leaf = Issue.objects.create(
            name="Other",
            project=project,
            workspace=project.workspace,
            created_by=user,
        )
        assert would_exceed_sub_task_depth(level2, leaf.id) is False
        assert would_exceed_sub_task_depth(level3, leaf.id) is True
