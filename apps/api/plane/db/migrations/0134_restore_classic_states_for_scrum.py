# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Restore classic board states for scrum projects that already received hierarchy remaps."""

from django.db import migrations
from django.utils import timezone


CLASSIC_STATES = [
    {
        "name": "Backlog",
        "color": "#60646C",
        "sequence": 15000,
        "group": "backlog",
        "default": True,
    },
    {
        "name": "Todo",
        "color": "#60646C",
        "sequence": 25000,
        "group": "unstarted",
        "default": False,
    },
    {
        "name": "In Progress",
        "color": "#F59E0B",
        "sequence": 35000,
        "group": "started",
        "default": False,
    },
    {
        "name": "Done",
        "color": "#46A758",
        "sequence": 45000,
        "group": "completed",
        "default": False,
    },
    {
        "name": "Cancelled",
        "color": "#9AA4BC",
        "sequence": 55000,
        "group": "cancelled",
        "default": False,
    },
    {
        "name": "Triage",
        "color": "#4E5355",
        "sequence": 65000,
        "group": "triage",
        "default": False,
    },
]


# hierarchy_board external_id suffix → classic state name
HIERARCHY_KEY_TO_CLASSIC = {
    "design_dev_todo": "Todo",
    "design_dev_in_progress": "In Progress",
    "design_dev_under_review": "In Progress",
    "qa_todo": "Todo",
    "qa_in_progress": "In Progress",
    "done": "Done",
}


def restore_classic_states_for_scrum_projects(apps, schema_editor):
    Project = apps.get_model("db", "Project")
    State = apps.get_model("db", "State")
    Issue = apps.get_model("db", "Issue")
    now = timezone.now()

    for project in Project.objects.filter(deleted_at__isnull=True, workflow_mode="scrum").iterator():
        hierarchy_states = list(
            State.objects.filter(
                project_id=project.id,
                deleted_at__isnull=True,
                external_id__startswith="hierarchy_board:",
            )
        )
        if not hierarchy_states:
            continue

        # Ensure classic states exist (match by name, case-insensitive)
        existing = {
            s.name.lower(): s
            for s in State.objects.filter(project_id=project.id, deleted_at__isnull=True)
        }
        classic_by_name = {}
        for spec in CLASSIC_STATES:
            key = spec["name"].lower()
            state = existing.get(key)
            if state is None:
                state = State.objects.create(
                    name=spec["name"],
                    color=spec["color"],
                    sequence=spec["sequence"],
                    group=spec["group"],
                    default=spec["default"],
                    is_triage=spec["group"] == "triage",
                    project_id=project.id,
                    workspace_id=project.workspace_id,
                    created_at=now,
                    updated_at=now,
                )
            else:
                # Prefer classic group/default for restored columns
                State.objects.filter(pk=state.pk).update(
                    group=spec["group"],
                    default=spec["default"],
                    color=spec["color"],
                    sequence=spec["sequence"],
                    is_triage=spec["group"] == "triage",
                    updated_at=now,
                )
                state.refresh_from_db()
            classic_by_name[spec["name"]] = state

        # Remap issues off hierarchy columns onto classic states
        for h_state in hierarchy_states:
            external_id = h_state.external_id or ""
            suffix = external_id.split("hierarchy_board:", 1)[-1]
            classic_name = HIERARCHY_KEY_TO_CLASSIC.get(suffix, "Todo")
            target = classic_by_name.get(classic_name) or classic_by_name["Todo"]
            if target.id == h_state.id:
                continue
            Issue._default_manager.filter(project_id=project.id, state_id=h_state.id, deleted_at__isnull=True).update(
                state_id=target.id,
                updated_at=now,
            )

        # Soft-delete hierarchy board states that are not also classic-named rows we keep
        classic_ids = {s.id for s in classic_by_name.values()}
        for h_state in hierarchy_states:
            if h_state.id in classic_ids:
                # Clear hierarchy external_id on retained classic row
                State.objects.filter(pk=h_state.id).update(external_id=None, updated_at=now)
                continue
            State.objects.filter(pk=h_state.id).update(deleted_at=now, updated_at=now)

        # Point project.default_state at classic default (Backlog)
        default_state = classic_by_name.get("Backlog")
        if default_state:
            Project.objects.filter(pk=project.id).update(default_state_id=default_state.id, updated_at=now)


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0133_project_workflow_mode"),
    ]

    operations = [
        migrations.RunPython(restore_classic_states_for_scrum_projects, migrations.RunPython.noop),
    ]
