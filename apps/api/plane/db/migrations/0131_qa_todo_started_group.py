# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Move QA To Do into the Started state group (board defaults)."""

from django.db import migrations


BOARD_GROUP_SPECS = [
    ("hierarchy_board:design_dev_todo", "unstarted", 15000, True),
    ("hierarchy_board:design_dev_in_progress", "started", 25000, False),
    ("hierarchy_board:design_dev_under_review", "started", 35000, False),
    ("hierarchy_board:qa_todo", "started", 45000, False),
    ("hierarchy_board:qa_in_progress", "started", 55000, False),
    ("hierarchy_board:done", "completed", 65000, False),
]


def apply_board_state_groups(apps, schema_editor):
    State = apps.get_model("db", "State")
    for external_id, group, sequence, is_default in BOARD_GROUP_SPECS:
        State._default_manager.filter(deleted_at__isnull=True, external_id=external_id).update(
            group=group,
            sequence=sequence,
            default=is_default,
        )
    # Ensure only Design/Dev To Do is the project default
    State._default_manager.filter(deleted_at__isnull=True, default=True).exclude(
        external_id="hierarchy_board:design_dev_todo"
    ).update(default=False)
    State._default_manager.filter(
        deleted_at__isnull=True,
        external_id="hierarchy_board:design_dev_todo",
    ).update(default=True)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0130_cleanup_hierarchy_board_states"),
    ]

    operations = [
        migrations.RunPython(apply_board_state_groups, noop_reverse),
    ]
