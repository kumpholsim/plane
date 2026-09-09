# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import models
from django.db.models import Q

from .project import ProjectBaseModel

# Fixed hierarchy levels (not user-reorderable)
HIERARCHY_LEVEL_MILESTONE = 1
HIERARCHY_LEVEL_EPIC = 2
HIERARCHY_LEVEL_DELIVERY = 3
HIERARCHY_LEVEL_SUB_TASK = 4

HIERARCHY_LEVELS = (
    (HIERARCHY_LEVEL_MILESTONE, "Milestone"),
    (HIERARCHY_LEVEL_EPIC, "Epic"),
    (HIERARCHY_LEVEL_DELIVERY, "Delivery"),
    (HIERARCHY_LEVEL_SUB_TASK, "Sub-task"),
)

# Default types seeded per project, keyed by hierarchy level
DEFAULT_PROJECT_HIERARCHY_TYPES = [
    # Level 1 — Milestone
    {
        "name": "Milestone",
        "color": "#5B21B6",
        "sort_order": 10000,
        "is_default": True,
        "level": HIERARCHY_LEVEL_MILESTONE,
    },
    # Level 2 — Epic
    {
        "name": "Epic",
        "color": "#A855F7",
        "sort_order": 10000,
        "is_default": True,
        "level": HIERARCHY_LEVEL_EPIC,
    },
    # Level 3 — Story / Bug / Story-bug / Task
    {
        "name": "Story",
        "color": "#3B82F6",
        "sort_order": 10000,
        "is_default": True,
        "level": HIERARCHY_LEVEL_DELIVERY,
    },
    {
        "name": "Task",
        "color": "#60A5FA",
        "sort_order": 20000,
        "is_default": True,
        "level": HIERARCHY_LEVEL_DELIVERY,
    },
    {
        "name": "Bug",
        "color": "#EF4444",
        "sort_order": 30000,
        "is_default": True,
        "level": HIERARCHY_LEVEL_DELIVERY,
    },
    {
        "name": "Story-bug",
        "color": "#F59E0B",
        "sort_order": 40000,
        "is_default": True,
        "level": HIERARCHY_LEVEL_DELIVERY,
    },
    # Level 4 — Sub-task categories (Design / Dev / QA)
    {
        "name": "Design",
        "color": "#F97316",
        "sort_order": 10000,
        "is_default": True,
        "level": HIERARCHY_LEVEL_SUB_TASK,
    },
    {
        "name": "Dev",
        "color": "#3B82F6",
        "sort_order": 20000,
        "is_default": True,
        "level": HIERARCHY_LEVEL_SUB_TASK,
    },
    {
        "name": "QA",
        "color": "#22C55E",
        "sort_order": 30000,
        "is_default": True,
        "level": HIERARCHY_LEVEL_SUB_TASK,
    },
]

# Back-compat alias used by older imports during transition
DEFAULT_SUB_WORK_ITEM_CATEGORIES = [
    t for t in DEFAULT_PROJECT_HIERARCHY_TYPES if t["level"] == HIERARCHY_LEVEL_SUB_TASK
]


class ProjectHierarchyType(ProjectBaseModel):
    """Customizable work-item type within a fixed hierarchy level (1–4)."""

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    color = models.CharField(max_length=255, blank=True)
    sort_order = models.FloatField(default=65535)
    is_active = models.BooleanField(default=True)
    is_default = models.BooleanField(default=False)
    level = models.PositiveSmallIntegerField(choices=HIERARCHY_LEVELS, default=HIERARCHY_LEVEL_DELIVERY)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["project", "level", "name"],
                condition=Q(deleted_at__isnull=True),
                name="unique_project_hierarchy_type_level_name_when_not_deleted",
            ),
        ]
        verbose_name = "Project Hierarchy Type"
        verbose_name_plural = "Project Hierarchy Types"
        db_table = "project_hierarchy_types"
        ordering = ("level", "sort_order", "created_at")

    def save(self, *args, **kwargs):
        if self._state.adding:
            last_id = ProjectHierarchyType.objects.filter(project=self.project, level=self.level).aggregate(
                largest=models.Max("sort_order")
            )["largest"]
            if last_id is not None:
                self.sort_order = last_id + 10000
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.level}:{self.name}"


def ensure_default_project_hierarchy_types(project, created_by=None):
    """
    Seed any missing default hierarchy types (Milestone → Epic → Delivery → Sub-task)
    for a project. Safe to call repeatedly; skips names that already exist at a level.
    Also applies known default-palette color updates for Milestone / Task.
    """
    # Idempotent palette refresh for previously seeded defaults
    ProjectHierarchyType.objects.filter(
        project_id=project.id,
        name__iexact="Milestone",
        level=HIERARCHY_LEVEL_MILESTONE,
        color__iexact="#8B5CF6",
        deleted_at__isnull=True,
    ).update(color="#5B21B6")
    ProjectHierarchyType.objects.filter(
        project_id=project.id,
        name__iexact="Task",
        level=HIERARCHY_LEVEL_DELIVERY,
        color__iexact="#10B981",
        deleted_at__isnull=True,
    ).update(color="#60A5FA")

    existing = {
        (row["level"], row["name"].lower())
        for row in ProjectHierarchyType.objects.filter(
            project_id=project.id, deleted_at__isnull=True
        ).values("level", "name")
    }
    to_create = []
    for item in DEFAULT_PROJECT_HIERARCHY_TYPES:
        key = (item["level"], item["name"].lower())
        if key in existing:
            continue
        to_create.append(
            ProjectHierarchyType(
                name=item["name"],
                color=item["color"],
                sort_order=item["sort_order"],
                is_default=item.get("is_default", True),
                is_active=True,
                level=item["level"],
                project=project,
                workspace_id=project.workspace_id,
                created_by=created_by,
            )
        )
        existing.add(key)
    if to_create:
        ProjectHierarchyType.objects.bulk_create(to_create)
    return to_create
