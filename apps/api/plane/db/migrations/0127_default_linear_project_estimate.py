# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import migrations, models


DEFAULT_LINEAR_ESTIMATE_POINTS = (
    (1, "1"),
    (2, "2"),
    (3, "3"),
    (4, "4"),
    (5, "5"),
    (6, "6"),
)


def seed_default_estimates(apps, schema_editor):
    Project = apps.get_model("db", "Project")
    Estimate = apps.get_model("db", "Estimate")
    EstimatePoint = apps.get_model("db", "EstimatePoint")

    for project in Project.objects.filter(estimate_id__isnull=True, deleted_at__isnull=True).iterator():
        existing = (
            Estimate.objects.filter(project_id=project.id, deleted_at__isnull=True)
            .order_by(
                models.Case(
                    models.When(type="points", then=0),
                    default=1,
                ),
                "created_at",
            )
            .first()
        )
        if existing:
            project.estimate_id = existing.id
            project.save(update_fields=["estimate_id", "updated_at"])
            continue

        estimate = Estimate.objects.create(
            name="Points",
            type="points",
            last_used=True,
            project_id=project.id,
            workspace_id=project.workspace_id,
            created_by_id=project.created_by_id,
        )
        EstimatePoint.objects.bulk_create(
            [
                EstimatePoint(
                    estimate_id=estimate.id,
                    key=key,
                    value=value,
                    project_id=project.id,
                    workspace_id=project.workspace_id,
                    created_by_id=project.created_by_id,
                )
                for key, value in DEFAULT_LINEAR_ESTIMATE_POINTS
            ]
        )
        project.estimate_id = estimate.id
        project.save(update_fields=["estimate_id", "updated_at"])


def noop_reverse(apps, schema_editor):
    # Keep seeded estimates; clearing project.estimate would disable estimates for everyone.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0126_issue_pin_level"),
    ]

    operations = [
        migrations.RunPython(seed_default_estimates, noop_reverse),
    ]
