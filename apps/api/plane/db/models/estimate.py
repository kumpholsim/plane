# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q

# Module imports
from .project import ProjectBaseModel

class EstimateType(models.TextChoices):
    CATEGORIES = "categories", "Categories"
    POINTS = "points", "Points"


class Estimate(ProjectBaseModel):
    name = models.CharField(max_length=255)
    description = models.TextField(verbose_name="Estimate Description", blank=True)
    type = models.CharField(max_length=255, choices=EstimateType.choices, default=EstimateType.CATEGORIES)
    last_used = models.BooleanField(default=False)

    def __str__(self):
        """Return name of the estimate"""
        return f"{self.name} <{self.project.name}>"

    class Meta:
        unique_together = ["name", "project", "deleted_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["name", "project"],
                condition=Q(deleted_at__isnull=True),
                name="estimate_unique_name_project_when_deleted_at_null",
            )
        ]
        verbose_name = "Estimate"
        verbose_name_plural = "Estimates"
        db_table = "estimates"
        ordering = ("name",)


class EstimatePoint(ProjectBaseModel):
    estimate = models.ForeignKey("db.Estimate", on_delete=models.CASCADE, related_name="points")
    key = models.IntegerField(default=0, validators=[MinValueValidator(0)])
    description = models.TextField(blank=True)
    value = models.CharField(max_length=255)

    def __str__(self):
        """Return name of the estimate"""
        return f"{self.estimate.name} <{self.key}> <{self.value}>"

    class Meta:
        verbose_name = "Estimate Point"
        verbose_name_plural = "Estimate Points"
        db_table = "estimate_points"
        ordering = ("value",)


# Matches ESTIMATE_SYSTEMS.points.templates.linear (web constants)
DEFAULT_LINEAR_ESTIMATE_POINTS = (
    (1, "1"),
    (2, "2"),
    (3, "3"),
    (4, "4"),
    (5, "5"),
    (6, "6"),
)


def ensure_default_project_estimate(project, created_by=None, activate=True):
    """
    Ensure the project has a Points estimate (Linear 1–6) and optionally activate it.

    Idempotent when ``project.estimate_id`` is already set. If estimates exist but
    none are active, activates an existing Points estimate (or the oldest estimate).
    Otherwise creates Points/Linear and activates it.
    """
    if project.estimate_id is not None:
        return project.estimate

    existing = (
        Estimate.objects.filter(project_id=project.id, deleted_at__isnull=True)
        .order_by(
            models.Case(
                models.When(type=EstimateType.POINTS, then=0),
                default=1,
            ),
            "created_at",
        )
        .first()
    )
    if existing:
        if activate:
            project.estimate = existing
            project.save(update_fields=["estimate", "updated_at"])
        return existing

    estimate = Estimate(
        name="Points",
        type=EstimateType.POINTS,
        last_used=True,
        project=project,
        workspace_id=project.workspace_id,
        created_by=created_by,
    )
    estimate.save(disable_auto_set_user=created_by is not None)

    EstimatePoint.objects.bulk_create(
        [
            EstimatePoint(
                estimate=estimate,
                key=key,
                value=value,
                project_id=project.id,
                workspace_id=project.workspace_id,
                created_by=created_by,
            )
            for key, value in DEFAULT_LINEAR_ESTIMATE_POINTS
        ]
    )

    if activate:
        project.estimate = estimate
        project.save(update_fields=["estimate", "updated_at"])

    return estimate
