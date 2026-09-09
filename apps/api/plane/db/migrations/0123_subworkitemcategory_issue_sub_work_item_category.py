# Generated manually for SubWorkItemCategory

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
import uuid


DEFAULT_CATEGORIES = [
    {"name": "Design", "color": "#F97316", "sort_order": 10000},
    {"name": "Dev", "color": "#3B82F6", "sort_order": 20000},
    {"name": "QA", "color": "#22C55E", "sort_order": 30000},
]


def seed_sub_work_item_categories(apps, schema_editor):
    Project = apps.get_model("db", "Project")
    SubWorkItemCategory = apps.get_model("db", "SubWorkItemCategory")

    categories = []
    for project in Project.objects.all().iterator():
        existing_names = set(
            SubWorkItemCategory.objects.filter(project_id=project.id, deleted_at__isnull=True).values_list(
                "name", flat=True
            )
        )
        for category in DEFAULT_CATEGORIES:
            if category["name"] in existing_names:
                continue
            categories.append(
                SubWorkItemCategory(
                    id=uuid.uuid4(),
                    name=category["name"],
                    color=category["color"],
                    sort_order=category["sort_order"],
                    is_default=True,
                    is_active=True,
                    project_id=project.id,
                    workspace_id=project.workspace_id,
                )
            )
    if categories:
        SubWorkItemCategory.objects.bulk_create(categories, batch_size=500, ignore_conflicts=True)


def unseed_sub_work_item_categories(apps, schema_editor):
    SubWorkItemCategory = apps.get_model("db", "SubWorkItemCategory")
    SubWorkItemCategory.objects.filter(is_default=True, name__in=["Design", "Dev", "QA"]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0122_alter_draftissue_assignees_alter_issue_assignees_and_more"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="SubWorkItemCategory",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Created At")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Last Modified At")),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("id", models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, primary_key=True, serialize=False, unique=True)),
                ("name", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                ("color", models.CharField(blank=True, max_length=255)),
                ("sort_order", models.FloatField(default=65535)),
                ("is_active", models.BooleanField(default=True)),
                ("is_default", models.BooleanField(default=False)),
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
                    "project",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="project_%(class)s",
                        to="db.project",
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
                    "workspace",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="workspace_%(class)s",
                        to="db.workspace",
                    ),
                ),
            ],
            options={
                "verbose_name": "Sub Work Item Category",
                "verbose_name_plural": "Sub Work Item Categories",
                "db_table": "sub_work_item_categories",
                "ordering": ("sort_order", "created_at"),
            },
        ),
        migrations.AddField(
            model_name="issue",
            name="sub_work_item_category",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="issues",
                to="db.subworkitemcategory",
            ),
        ),
        migrations.AddConstraint(
            model_name="subworkitemcategory",
            constraint=models.UniqueConstraint(
                condition=models.Q(("deleted_at__isnull", True)),
                fields=("project", "name"),
                name="unique_project_sub_work_item_category_name_when_not_deleted",
            ),
        ),
        migrations.RunPython(seed_sub_work_item_categories, unseed_sub_work_item_categories),
    ]
