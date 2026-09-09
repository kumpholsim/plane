# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Rename hierarchy board states, fix sequence, soft-delete legacy clutter."""

from django.db import migrations
from django.utils import timezone

BOARD_SPECS = [
    {
        "external_id": "hierarchy_board:design_dev_todo",
        "name": "To Do",
        "color": "#60646C",
        "sequence": 15000,
        "group": "unstarted",
        "default": True,
    },
    {
        "external_id": "hierarchy_board:design_dev_in_progress",
        "name": "In Progress",
        "color": "#F59E0B",
        "sequence": 25000,
        "group": "started",
        "default": False,
    },
    {
        "external_id": "hierarchy_board:design_dev_under_review",
        "name": "Under Review",
        "color": "#3B82F6",
        "sequence": 35000,
        "group": "started",
        "default": False,
    },
    {
        "external_id": "hierarchy_board:qa_todo",
        "name": "QA To Do",
        "color": "#60646C",
        "sequence": 45000,
        "group": "started",
        "default": False,
    },
    {
        "external_id": "hierarchy_board:qa_in_progress",
        "name": "QA In Progress",
        "color": "#F59E0B",
        "sequence": 55000,
        "group": "started",
        "default": False,
    },
    {
        "external_id": "hierarchy_board:done",
        "name": "Done",
        "color": "#46A758",
        "sequence": 65000,
        "group": "completed",
        "default": False,
    },
]


def cleanup_hierarchy_board_states(apps, schema_editor):
    Project = apps.get_model("db", "Project")
    State = apps.get_model("db", "State")
    Issue = apps.get_model("db", "Issue")
    now = timezone.now()

    for project in Project.objects.filter(deleted_at__isnull=True).iterator():
        existing = {
            s.external_id: s
            for s in State._default_manager.filter(
                project_id=project.id,
                deleted_at__isnull=True,
                external_id__startswith="hierarchy_board:",
            )
        }

        # Ensure / rename the 6 board states
        for spec in BOARD_SPECS:
            state = existing.get(spec["external_id"])
            if state is None:
                # Try match by previous Design/Dev names
                continue
            state.name = spec["name"]
            state.color = spec["color"]
            state.sequence = spec["sequence"]
            state.group = spec["group"]
            state.default = spec["default"]
            state.save(
                update_fields=["name", "color", "sequence", "group", "default", "updated_at"]
            )

        # Create any missing board states
        existing = {
            s.external_id: s
            for s in State._default_manager.filter(
                project_id=project.id,
                deleted_at__isnull=True,
                external_id__startswith="hierarchy_board:",
            )
        }
        for spec in BOARD_SPECS:
            if spec["external_id"] in existing:
                continue
            State._default_manager.create(
                name=spec["name"],
                color=spec["color"],
                sequence=spec["sequence"],
                group=spec["group"],
                default=spec["default"],
                external_id=spec["external_id"],
                project_id=project.id,
                workspace_id=project.workspace_id,
                created_by_id=project.created_by_id,
            )

        board_ids = set(
            State._default_manager.filter(
                project_id=project.id,
                deleted_at__isnull=True,
                external_id__startswith="hierarchy_board:",
            ).values_list("id", flat=True)
        )
        fallback = (
            State._default_manager.filter(
                project_id=project.id,
                deleted_at__isnull=True,
                external_id="hierarchy_board:design_dev_todo",
            ).first()
        )

        # Soft-delete non-board states (keep triage)
        legacy = State._default_manager.filter(
            project_id=project.id,
            deleted_at__isnull=True,
        ).exclude(external_id__startswith="hierarchy_board:").exclude(group="triage")

        for legacy_state in legacy:
            if fallback is not None:
                Issue._default_manager.filter(
                    project_id=project.id,
                    state_id=legacy_state.id,
                    deleted_at__isnull=True,
                ).update(state_id=fallback.id, updated_at=now)
            legacy_state.deleted_at = now
            legacy_state.save(update_fields=["deleted_at", "updated_at"])

        # One default only
        State._default_manager.filter(project_id=project.id, deleted_at__isnull=True, default=True).exclude(
            external_id="hierarchy_board:design_dev_todo"
        ).update(default=False)
        State._default_manager.filter(
            project_id=project.id,
            deleted_at__isnull=True,
            external_id="hierarchy_board:design_dev_todo",
        ).update(default=True)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0129_remap_issues_to_hierarchy_board_states"),
    ]

    operations = [
        migrations.RunPython(cleanup_hierarchy_board_states, noop_reverse),
    ]
