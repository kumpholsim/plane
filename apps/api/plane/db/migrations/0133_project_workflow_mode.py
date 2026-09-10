# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0132_alter_project_feature_view_defaults"),
    ]

    operations = [
        migrations.AlterField(
            model_name="project",
            name="cycle_view",
            field=models.BooleanField(default=False),
        ),
        migrations.AlterField(
            model_name="project",
            name="issue_views_view",
            field=models.BooleanField(default=False),
        ),
        migrations.AlterField(
            model_name="project",
            name="module_view",
            field=models.BooleanField(default=False),
        ),
        migrations.AlterField(
            model_name="project",
            name="intake_view",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="project",
            name="workflow_mode",
            field=models.CharField(
                choices=[
                    ("scrum", "Scrum"),
                    ("staged_gate_scrumban", "Staged-gate Scrumban"),
                ],
                default="scrum",
                max_length=64,
            ),
        ),
        # Existing projects stay classic Scrum regardless of prior Scrumban-shaped UX.
        migrations.RunSQL(
            sql="UPDATE projects SET workflow_mode = 'scrum' WHERE deleted_at IS NULL;",
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
