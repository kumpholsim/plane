# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0136_collapse_qa_board_columns"),
    ]

    operations = [
        migrations.AddField(
            model_name="project",
            name="average_velocity",
            field=models.FloatField(default=15),
        ),
        migrations.AddField(
            model_name="cycle",
            name="public_holiday_days",
            field=models.FloatField(default=0),
        ),
        migrations.AddField(
            model_name="cycle",
            name="personal_holiday_days",
            field=models.JSONField(default=dict),
        ),
    ]
