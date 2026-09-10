# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Reset Scrumban-shaped display filters on classic (scrum) projects.

Users who used hierarchy UX before workflow_mode had prefs like group_by=module
+ sub_issue=false persisted. After projects were backfilled to scrum, those
prefs hide cards on classic boards (module columns empty for hierarchy issues).
"""

from django.db import migrations


CLASSIC_DISPLAY_FILTER_DEFAULTS = {
    "group_by": None,
    "sub_group_by": None,
    "order_by": "-created_at",
    "type": None,
    "sub_issue": True,
    "show_empty_groups": True,
}


def _looks_like_scrumban_display_filters(display_filters: dict | None) -> bool:
    if not isinstance(display_filters, dict):
        return False
    group_by = display_filters.get("group_by")
    sub_group_by = display_filters.get("sub_group_by")
    order_by = display_filters.get("order_by")
    sub_issue = display_filters.get("sub_issue")
    # Locked Scrumban list/board shapes (and common hybrids left in prefs)
    if group_by == "module":
        return True
    if sub_group_by == "module":
        return True
    if order_by == "sort_order" and sub_issue is False and group_by in ("module", "state", None):
        return True
    return False


def reset_scrumban_display_filters_for_scrum(apps, schema_editor):
    Project = apps.get_model("db", "Project")
    ProjectUserProperty = apps.get_model("db", "ProjectUserProperty")

    scrum_ids = Project.objects.filter(deleted_at__isnull=True, workflow_mode="scrum").values_list("id", flat=True)

    for prop in ProjectUserProperty.objects.filter(project_id__in=scrum_ids, deleted_at__isnull=True).iterator():
        display_filters = prop.display_filters or {}
        if not _looks_like_scrumban_display_filters(display_filters):
            continue
        layout = display_filters.get("layout") or "list"
        calendar = display_filters.get("calendar")
        updated = {
            **display_filters,
            **CLASSIC_DISPLAY_FILTER_DEFAULTS,
            "layout": layout,
        }
        # Kanban without a group looks empty — default classic board groups by state
        if layout in ("kanban", "board") and not updated.get("group_by"):
            updated["group_by"] = "state"
        if calendar is not None:
            updated["calendar"] = calendar
        ProjectUserProperty.objects.filter(pk=prop.pk).update(display_filters=updated)


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0134_restore_classic_states_for_scrum"),
    ]

    operations = [
        migrations.RunPython(reset_scrumban_display_filters_for_scrum, migrations.RunPython.noop),
    ]
