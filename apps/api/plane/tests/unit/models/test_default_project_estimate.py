# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest

from plane.db.models import (
    Estimate,
    EstimatePoint,
    DEFAULT_LINEAR_ESTIMATE_POINTS,
    ensure_default_project_estimate,
)
from plane.db.models.estimate import EstimateType


@pytest.mark.unit
@pytest.mark.django_db
class TestDefaultProjectEstimate:
    def test_seeds_linear_points_and_activates(self, project, create_user):
        estimate = ensure_default_project_estimate(project, created_by=create_user)

        project.refresh_from_db()
        assert project.estimate_id == estimate.id
        assert estimate.name == "Points"
        assert estimate.type == EstimateType.POINTS

        points = list(
            EstimatePoint.objects.filter(estimate=estimate).order_by("key").values_list("key", "value")
        )
        assert points == list(DEFAULT_LINEAR_ESTIMATE_POINTS)

    def test_idempotent_when_already_active(self, project, create_user):
        first = ensure_default_project_estimate(project, created_by=create_user)
        second = ensure_default_project_estimate(project, created_by=create_user)

        assert first.id == second.id
        assert Estimate.objects.filter(project=project).count() == 1

    def test_activates_existing_points_estimate(self, project, create_user):
        existing = Estimate.objects.create(
            name="Points",
            type=EstimateType.POINTS,
            project=project,
            created_by=create_user,
        )

        activated = ensure_default_project_estimate(project, created_by=create_user)

        project.refresh_from_db()
        assert activated.id == existing.id
        assert project.estimate_id == existing.id
        assert Estimate.objects.filter(project=project).count() == 1
