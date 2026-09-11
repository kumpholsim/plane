# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Collapse Scrumban board from 6 columns to 4 shared L4 states.

Remap QA To Do → To Do and QA In Progress → In Progress, then soft-delete the
QA-only state rows on staged_gate_scrumban projects. Classic scrum is untouched.
"""

from django.db import migrations
from django.utils import timezone

QA_TODO_EXTERNAL_ID = "hierarchy_board:qa_todo"
QA_IN_PROGRESS_EXTERNAL_ID = "hierarchy_board:qa_in_progress"
SHARED_TODO_EXTERNAL_ID = "hierarchy_board:design_dev_todo"
SHARED_IN_PROGRESS_EXTERNAL_ID = "hierarchy_board:design_dev_in_progress"
DONE_EXTERNAL_ID = "hierarchy_board:done"

SEQUENCE_UPDATES = {
    SHARED_TODO_EXTERNAL_ID: 15000,
    SHARED_IN_PROGRESS_EXTERNAL_ID: 25000,
    "hierarchy_board:design_dev_under_review": 35000,
    DONE_EXTERNAL_ID: 45000,
}


def collapse_qa_board_columns(apps, schema_editor):
    Project = apps.get_model("db", "Project")
    State = apps.get_model("db", "State")
    Issue = apps.get_model("db", "Issue")
    now = timezone.now()

    for project in Project.objects.filter(
        deleted_at__isnull=True, workflow_mode="staged_gate_scrumban"
    ).iterator():
        states_by_external = {
            s.external_id: s
            for s in State.objects.filter(
                project_id=project.id,
                deleted_at__isnull=True,
                external_id__startswith="hierarchy_board:",
            )
        }
        states_by_name = {
            s.name.lower(): s
            for s in State.objects.filter(project_id=project.id, deleted_at__isnull=True)
        }

        shared_todo = states_by_external.get(SHARED_TODO_EXTERNAL_ID) or states_by_name.get("to do")
        shared_in_progress = states_by_external.get(SHARED_IN_PROGRESS_EXTERNAL_ID) or states_by_name.get(
            "in progress"
        )
        qa_todo = states_by_external.get(QA_TODO_EXTERNAL_ID)
        qa_in_progress = states_by_external.get(QA_IN_PROGRESS_EXTERNAL_ID)

        if qa_todo is not None:
            if shared_todo is not None:
                Issue._default_manager.filter(
                    project_id=project.id, state_id=qa_todo.id, deleted_at__isnull=True
                ).update(state_id=shared_todo.id, updated_at=now)
            State.objects.filter(pk=qa_todo.id).update(deleted_at=now, updated_at=now)

        if qa_in_progress is not None:
            if shared_in_progress is not None:
                Issue._default_manager.filter(
                    project_id=project.id, state_id=qa_in_progress.id, deleted_at__isnull=True
                ).update(state_id=shared_in_progress.id, updated_at=now)
            State.objects.filter(pk=qa_in_progress.id).update(deleted_at=now, updated_at=now)

        for external_id, sequence in SEQUENCE_UPDATES.items():
            State.objects.filter(
                project_id=project.id,
                deleted_at__isnull=True,
                external_id=external_id,
            ).update(sequence=sequence, updated_at=now)

        State.objects.filter(
            project_id=project.id,
            deleted_at__isnull=True,
            name__iexact="Triage",
            is_triage=True,
        ).update(sequence=55000, updated_at=now)


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0135_reset_scrumban_display_filters_for_scrum"),
    ]

    operations = [
        migrations.RunPython(collapse_qa_board_columns, migrations.RunPython.noop),
    ]
