# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import models

from .project import ProjectBaseModel


class ProjectEvent(ProjectBaseModel):
    """
    Calendar-only project event (not an Issue / L1–L4 work item).
    Multi-day spans use start_at / end_at; all_day ignores wall-clock times in the UI.
    """

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    start_at = models.DateTimeField()
    end_at = models.DateTimeField()
    all_day = models.BooleanField(default=True)
    color = models.CharField(max_length=32, default="#3B82F6")
    cover_image = models.TextField(blank=True, null=True, default=None)

    class Meta:
        db_table = "project_events"
        verbose_name = "Project Event"
        verbose_name_plural = "Project Events"
        ordering = ("start_at", "created_at")
        indexes = [
            models.Index(fields=["project", "start_at", "end_at"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.start_at} → {self.end_at})"
