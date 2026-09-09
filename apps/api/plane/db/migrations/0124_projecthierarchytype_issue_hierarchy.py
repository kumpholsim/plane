# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
import uuid


DEFAULT_TYPES = [
    {"name": "Milestone", "color": "#5B21B6", "sort_order": 10000, "level": 1},
    {"name": "Epic", "color": "#A855F7", "sort_order": 10000, "level": 2},
    {"name": "Story", "color": "#3B82F6", "sort_order": 10000, "level": 3},
    {"name": "Bug", "color": "#EF4444", "sort_order": 20000, "level": 3},
    {"name": "Story-bug", "color": "#F59E0B", "sort_order": 30000, "level": 3},
    {"name": "Task", "color": "#60A5FA", "sort_order": 40000, "level": 3},
    {"name": "Design", "color": "#F97316", "sort_order": 10000, "level": 4},
    {"name": "Dev", "color": "#3B82F6", "sort_order": 20000, "level": 4},
    {"name": "QA", "color": "#22C55E", "sort_order": 30000, "level": 4},
]


def migrate_hierarchy_types(apps, schema_editor):
    Project = apps.get_model("db", "Project")
    ProjectHierarchyType = apps.get_model("db", "ProjectHierarchyType")
    SubWorkItemCategory = apps.get_model("db", "SubWorkItemCategory")
    Issue = apps.get_model("db", "Issue")

    # Map old category UUID → new hierarchy type UUID per project
    category_to_type = {}

    for project in Project.objects.all():
        # Migrate existing L4 categories first (preserve IDs where possible by creating new rows)
        old_cats = list(SubWorkItemCategory.objects.filter(project_id=project.id, deleted_at__isnull=True))
        existing_l4_names = set()
        for cat in old_cats:
            ht = ProjectHierarchyType.objects.create(
                id=cat.id,  # keep same id so Issue FK remap is trivial
                name=cat.name,
                description=cat.description or "",
                color=cat.color or "",
                sort_order=cat.sort_order,
                is_active=cat.is_active,
                is_default=cat.is_default,
                level=4,
                project_id=project.id,
                workspace_id=project.workspace_id,
                created_by_id=cat.created_by_id,
                updated_by_id=cat.updated_by_id,
                created_at=cat.created_at,
                updated_at=cat.updated_at,
            )
            category_to_type[str(cat.id)] = str(ht.id)
            existing_l4_names.add(cat.name.lower())

        # Seed missing defaults for all levels
        for default in DEFAULT_TYPES:
            if default["level"] == 4 and default["name"].lower() in existing_l4_names:
                continue
            if ProjectHierarchyType.objects.filter(
                project_id=project.id, level=default["level"], name__iexact=default["name"], deleted_at__isnull=True
            ).exists():
                continue
            ProjectHierarchyType.objects.create(
                name=default["name"],
                color=default["color"],
                sort_order=default["sort_order"],
                is_default=True,
                is_active=True,
                level=default["level"],
                project_id=project.id,
                workspace_id=project.workspace_id,
            )

    # Remap Issue.sub_work_item_category → hierarchy_type and set hierarchy_level
    # Historical Issue only exposes `issue_objects` (no default `.objects` manager).
    issue_qs = Issue.issue_objects
    for issue in issue_qs.all().iterator(chunk_size=500):
        updates = {}
        # Default level for roots
        level = 3
        if issue.parent_id is None:
            # Epic flag via type if available
            if getattr(issue, "type_id", None):
                IssueType = apps.get_model("db", "IssueType")
                issue_type = IssueType.objects.filter(pk=issue.type_id).first()
                if issue_type and getattr(issue_type, "is_epic", False):
                    level = 2
            updates["hierarchy_level"] = level
        else:
            # Has parent — if had category treat as L4, else parent+1 heuristic later
            if issue.sub_work_item_category_id:
                updates["hierarchy_type_id"] = issue.sub_work_item_category_id
                updates["hierarchy_level"] = 4
            else:
                updates["hierarchy_level"] = 4  # parented without category → sub-task

        if updates:
            issue_qs.filter(pk=issue.id).update(**updates)

    # Ensure hierarchy_type.level matches hierarchy_level when type is set
    for issue in issue_qs.filter(hierarchy_type_id__isnull=False).iterator(chunk_size=500):
        ht = ProjectHierarchyType.objects.filter(pk=issue.hierarchy_type_id).first()
        if ht and issue.hierarchy_level != ht.level:
            issue_qs.filter(pk=issue.id).update(hierarchy_level=ht.level)


def unmigrate_hierarchy_types(apps, schema_editor):
    ProjectHierarchyType = apps.get_model("db", "ProjectHierarchyType")
    ProjectHierarchyType.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0123_subworkitemcategory_issue_sub_work_item_category"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ProjectHierarchyType",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Created At")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Last Modified At")),
                ("deleted_at", models.DateTimeField(blank=True, null=True, verbose_name="Deleted At")),
                ("id", models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, primary_key=True, serialize=False, unique=True)),
                ("name", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                ("color", models.CharField(blank=True, max_length=255)),
                ("sort_order", models.FloatField(default=65535)),
                ("is_active", models.BooleanField(default=True)),
                ("is_default", models.BooleanField(default=False)),
                (
                    "level",
                    models.PositiveSmallIntegerField(
                        choices=[(1, "Milestone"), (2, "Epic"), (3, "Delivery"), (4, "Sub-task")],
                        default=3,
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="%(class)s_created_by",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Created By",
                    ),
                ),
                (
                    "updated_by",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="%(class)s_updated_by",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Last Modified By",
                    ),
                ),
                (
                    "project",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="project_%(class)s",
                        to="db.project",
                    ),
                ),
                (
                    "workspace",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="workspace_%(class)s",
                        to="db.workspace",
                    ),
                ),
            ],
            options={
                "verbose_name": "Project Hierarchy Type",
                "verbose_name_plural": "Project Hierarchy Types",
                "db_table": "project_hierarchy_types",
                "ordering": ("level", "sort_order", "created_at"),
            },
        ),
        migrations.AddConstraint(
            model_name="projecthierarchytype",
            constraint=models.UniqueConstraint(
                condition=models.Q(("deleted_at__isnull", True)),
                fields=("project", "level", "name"),
                name="unique_project_hierarchy_type_level_name_when_not_deleted",
            ),
        ),
        migrations.AddField(
            model_name="issue",
            name="hierarchy_level",
            field=models.PositiveSmallIntegerField(default=3),
        ),
        migrations.AddField(
            model_name="issue",
            name="hierarchy_type",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="issues",
                to="db.projecthierarchytype",
            ),
        ),
        migrations.RunPython(migrate_hierarchy_types, unmigrate_hierarchy_types),
        migrations.RemoveField(
            model_name="issue",
            name="sub_work_item_category",
        ),
        migrations.DeleteModel(
            name="SubWorkItemCategory",
        ),
    ]
