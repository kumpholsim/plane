# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0125_update_milestone_task_default_colors"),
    ]

    operations = [
        migrations.AddField(
            model_name="issue",
            name="pin_level",
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="draftissue",
            name="pin_level",
            field=models.PositiveSmallIntegerField(default=0),
        ),
    ]
