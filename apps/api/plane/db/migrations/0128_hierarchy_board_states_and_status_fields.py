# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import migrations, models


BOARD_STATES = [
    {
        "name": "Design/Dev To do",
        "color": "#60646C",
        "sequence": 15000,
        "group": "unstarted",
        "default": True,
        "external_id": "hierarchy_board:design_dev_todo",
    },
    {
        "name": "Design/Dev In progress",
        "color": "#F59E0B",
        "sequence": 25000,
        "group": "started",
        "default": False,
        "external_id": "hierarchy_board:design_dev_in_progress",
    },
    {
        "name": "Design/Dev Under review",
        "color": "#3B82F6",
        "sequence": 35000,
        "group": "started",
        "default": False,
        "external_id": "hierarchy_board:design_dev_under_review",
    },
    {
        "name": "QA To do",
        "color": "#60646C",
        "sequence": 45000,
        "group": "unstarted",
        "default": False,
        "external_id": "hierarchy_board:qa_todo",
    },
    {
        "name": "QA In progress",
        "color": "#F59E0B",
        "sequence": 55000,
        "group": "started",
        "default": False,
        "external_id": "hierarchy_board:qa_in_progress",
    },
    {
        "name": "Done",
        "color": "#46A758",
        "sequence": 65000,
        "group": "completed",
        "default": False,
        "external_id": "hierarchy_board:done",
    },
]


def seed_hierarchy_board_states(apps, schema_editor):
    Project = apps.get_model("db", "Project")
    State = apps.get_model("db", "State")

    for project in Project.objects.filter(deleted_at__isnull=True).iterator():
        existing_by_external = {
            s.external_id: s
            for s in State.objects.filter(
                project_id=project.id,
                deleted_at__isnull=True,
                external_id__startswith="hierarchy_board:",
            )
        }
        existing_by_name = {
            s.name.lower(): s
            for s in State.objects.filter(project_id=project.id, deleted_at__isnull=True)
        }

        created_default = False
        for spec in BOARD_STATES:
            external_id = spec["external_id"]
            if external_id in existing_by_external:
                continue
            named = existing_by_name.get(spec["name"].lower())
            if named is not None:
                named.external_id = external_id
                named.group = spec["group"]
                named.sequence = spec["sequence"]
                named.color = spec["color"]
                if spec["default"]:
                    named.default = True
                    created_default = True
                named.save(
                    update_fields=[
                        "external_id",
                        "group",
                        "sequence",
                        "color",
                        "default",
                        "updated_at",
                    ]
                )
                existing_by_external[external_id] = named
                continue

            if spec["default"]:
                created_default = True
            State.objects.create(
                name=spec["name"],
                color=spec["color"],
                sequence=spec["sequence"],
                group=spec["group"],
                default=spec["default"],
                external_id=external_id,
                project_id=project.id,
                workspace_id=project.workspace_id,
                created_by_id=project.created_by_id,
            )

        if created_default:
            # Ensure only one default — prefer Design/Dev To do
            defaults = list(
                State.objects.filter(project_id=project.id, deleted_at__isnull=True, default=True)
            )
            preferred = next(
                (s for s in defaults if s.external_id == "hierarchy_board:design_dev_todo"),
                defaults[0] if defaults else None,
            )
            if preferred is not None:
                State.objects.filter(project_id=project.id, deleted_at__isnull=True, default=True).exclude(
                    pk=preferred.pk
                ).update(default=False)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0127_default_linear_project_estimate"),
    ]

    operations = [
        migrations.AddField(
            model_name="issue",
            name="progress_status",
            field=models.CharField(blank=True, max_length=32, null=True),
        ),
        migrations.AddField(
            model_name="issue",
            name="qa_outcome",
            field=models.CharField(blank=True, max_length=16, null=True),
        ),
        migrations.RunPython(seed_hierarchy_board_states, noop_reverse),
    ]
