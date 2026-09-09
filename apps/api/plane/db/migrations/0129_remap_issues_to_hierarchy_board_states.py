# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Remap issues from legacy workflow states onto hierarchy board columns."""

from django.db import migrations
from django.utils import timezone


# Legacy state name (lower) → hierarchy board external_id suffix
LEGACY_NAME_TO_BOARD_KEY = {
    "backlog": "design_dev_todo",
    "todo": "design_dev_todo",
    "to do": "design_dev_todo",
    "to-do": "design_dev_todo",
    "[dev or design] to-do": "design_dev_todo",
    "[dev or design] todo": "design_dev_todo",
    "design/dev to do": "design_dev_todo",
    "in progress": "design_dev_in_progress",
    "in-progress": "design_dev_in_progress",
    "[dev or design] in-progress": "design_dev_in_progress",
    "[dev or design] in progress": "design_dev_in_progress",
    "design/dev in progress": "design_dev_in_progress",
    "under review": "design_dev_under_review",
    "unver-review": "design_dev_under_review",
    "[dev or design] unver-review": "design_dev_under_review",
    "[dev or design] under-review": "design_dev_under_review",
    "[dev or design] under review": "design_dev_under_review",
    "design/dev under review": "design_dev_under_review",
    "qa to do": "qa_todo",
    "qa to-do": "qa_todo",
    "qa todo": "qa_todo",
    "qa in progress": "qa_in_progress",
    "qa in-progress": "qa_in_progress",
    "done": "done",
    "cancelled": "done",
    "canceled": "done",
}


def remap_issues_to_hierarchy_board_states(apps, schema_editor):
    Project = apps.get_model("db", "Project")
    State = apps.get_model("db", "State")
    Issue = apps.get_model("db", "Issue")
    ProjectHierarchyType = apps.get_model("db", "ProjectHierarchyType")

    now = timezone.now()

    for project in Project.objects.filter(deleted_at__isnull=True).iterator():
        board_by_key = {
            s.external_id.split("hierarchy_board:", 1)[-1]: s
            for s in State.objects.filter(
                project_id=project.id,
                deleted_at__isnull=True,
                external_id__startswith="hierarchy_board:",
            )
        }
        if not board_by_key:
            continue

        qa_type_ids = set(
            ProjectHierarchyType.objects.filter(
                project_id=project.id,
                deleted_at__isnull=True,
                name__iexact="QA",
                level=4,
            ).values_list("id", flat=True)
        )

        legacy_states = State.objects.filter(
            project_id=project.id,
            deleted_at__isnull=True,
        ).exclude(external_id__startswith="hierarchy_board:")

        for legacy in legacy_states:
            key = LEGACY_NAME_TO_BOARD_KEY.get(legacy.name.strip().lower())
            if not key:
                # Fallback: unstarted/backlog → todo, started → in progress, completed → done
                if legacy.group in ("backlog", "unstarted"):
                    key = "design_dev_todo"
                elif legacy.group == "started":
                    key = "design_dev_in_progress"
                elif legacy.group == "completed":
                    key = "done"
                else:
                    continue

            target = board_by_key.get(key)
            if target is None or target.id == legacy.id:
                continue

            # Non-QA issues
            Issue._default_manager.filter(
                project_id=project.id,
                state_id=legacy.id,
                deleted_at__isnull=True,
            ).exclude(hierarchy_type_id__in=qa_type_ids).update(
                state_id=target.id,
                updated_at=now,
            )

            # QA L4: prefer QA todo/in-progress when legacy was a todo/progress-like state
            qa_key = key
            if key == "design_dev_todo":
                qa_key = "qa_todo"
            elif key == "design_dev_in_progress":
                qa_key = "qa_in_progress"
            elif key == "design_dev_under_review":
                qa_key = "qa_in_progress"
            qa_target = board_by_key.get(qa_key) or target

            Issue._default_manager.filter(
                project_id=project.id,
                state_id=legacy.id,
                deleted_at__isnull=True,
                hierarchy_type_id__in=qa_type_ids,
            ).update(
                state_id=qa_target.id,
                updated_at=now,
            )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0128_hierarchy_board_states_and_status_fields"),
    ]

    operations = [
        migrations.RunPython(remap_issues_to_hierarchy_board_states, noop_reverse),
    ]
