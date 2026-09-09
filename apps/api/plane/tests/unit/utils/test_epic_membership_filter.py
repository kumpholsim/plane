# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest

from plane.db.models import Issue
from plane.tests.factories import ProjectFactory, UserFactory
from plane.utils.issue_parent import (
    HIERARCHY_LEVEL_DELIVERY,
    HIERARCHY_LEVEL_EPIC,
    HIERARCHY_LEVEL_MILESTONE,
    HIERARCHY_LEVEL_SUB_TASK,
    epic_membership_q,
)
from plane.utils.issue_filters import filter_module


@pytest.mark.unit
class TestEpicMembershipFilter:
    @pytest.mark.django_db
    def test_q_matches_epic_l3_and_l4(self):
        user = UserFactory()
        project = ProjectFactory(created_by=user, updated_by=user)
        ws = project.workspace

        milestone = Issue.objects.create(
            name="Milestone",
            project=project,
            workspace=ws,
            created_by=user,
            hierarchy_level=HIERARCHY_LEVEL_MILESTONE,
        )
        epic = Issue.objects.create(
            name="Epic",
            project=project,
            workspace=ws,
            created_by=user,
            parent=milestone,
            hierarchy_level=HIERARCHY_LEVEL_EPIC,
        )
        other_epic = Issue.objects.create(
            name="Other Epic",
            project=project,
            workspace=ws,
            created_by=user,
            parent=milestone,
            hierarchy_level=HIERARCHY_LEVEL_EPIC,
        )
        delivery = Issue.objects.create(
            name="Story",
            project=project,
            workspace=ws,
            created_by=user,
            parent=epic,
            hierarchy_level=HIERARCHY_LEVEL_DELIVERY,
        )
        sub_task = Issue.objects.create(
            name="Sub",
            project=project,
            workspace=ws,
            created_by=user,
            parent=delivery,
            hierarchy_level=HIERARCHY_LEVEL_SUB_TASK,
        )
        other_delivery = Issue.objects.create(
            name="Other Story",
            project=project,
            workspace=ws,
            created_by=user,
            parent=other_epic,
            hierarchy_level=HIERARCHY_LEVEL_DELIVERY,
        )

        matched = set(
            Issue.issue_objects.filter(epic_membership_q([epic.id])).values_list("id", flat=True)
        )
        assert epic.id in matched
        assert delivery.id in matched
        assert sub_task.id in matched
        assert other_epic.id not in matched
        assert other_delivery.id not in matched

    @pytest.mark.django_db
    def test_legacy_module_filter_uses_epic_ids(self):
        user = UserFactory()
        project = ProjectFactory(created_by=user, updated_by=user)
        ws = project.workspace

        epic = Issue.objects.create(
            name="Epic",
            project=project,
            workspace=ws,
            created_by=user,
            hierarchy_level=HIERARCHY_LEVEL_EPIC,
        )
        delivery = Issue.objects.create(
            name="Story",
            project=project,
            workspace=ws,
            created_by=user,
            parent=epic,
            hierarchy_level=HIERARCHY_LEVEL_DELIVERY,
        )
        Issue.objects.create(
            name="Unrelated",
            project=project,
            workspace=ws,
            created_by=user,
            hierarchy_level=HIERARCHY_LEVEL_DELIVERY,
        )

        issue_filter = {}
        filter_module({"module": str(epic.id)}, issue_filter, method="GET")
        assert "id__in" in issue_filter
        matched = set(issue_filter["id__in"])
        assert epic.id in matched
        assert delivery.id in matched
        assert len(matched) == 2
