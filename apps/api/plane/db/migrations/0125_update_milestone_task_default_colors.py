# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import migrations


# Previous seed palette → current defaults (only rewrite exact old colors)
COLOR_UPDATES = [
    # Milestone: violet → deep purple
    {"name": "Milestone", "level": 1, "old": "#8B5CF6", "new": "#5B21B6"},
    # Task: green → brighter blue
    {"name": "Task", "level": 3, "old": "#10B981", "new": "#60A5FA"},
]


def update_default_type_colors(apps, schema_editor):
    ProjectHierarchyType = apps.get_model("db", "ProjectHierarchyType")
    for item in COLOR_UPDATES:
        ProjectHierarchyType.objects.filter(
            name__iexact=item["name"],
            level=item["level"],
            color__iexact=item["old"],
            deleted_at__isnull=True,
        ).update(color=item["new"])


def revert_default_type_colors(apps, schema_editor):
    ProjectHierarchyType = apps.get_model("db", "ProjectHierarchyType")
    for item in COLOR_UPDATES:
        ProjectHierarchyType.objects.filter(
            name__iexact=item["name"],
            level=item["level"],
            color__iexact=item["new"],
            deleted_at__isnull=True,
        ).update(color=item["old"])


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0124_projecthierarchytype_issue_hierarchy"),
    ]

    operations = [
        migrations.RunPython(update_default_type_colors, revert_default_type_colors),
    ]
