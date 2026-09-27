# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.conf import settings
from django.db import models

from .workspace import WorkspaceBaseModel


class ManhourManualEntry(WorkspaceBaseModel):
    """Workspace-wide manhour row that is not tied to a board card."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="manhour_manual_entries",
    )
    description = models.TextField()
    manhour = models.FloatField(default=0)
    entry_date = models.DateField()

    class Meta:
        verbose_name = "Manhour Manual Entry"
        verbose_name_plural = "Manhour Manual Entries"
        db_table = "manhour_manual_entries"
        ordering = ("entry_date", "created_at")
        indexes = [
            models.Index(fields=["workspace", "user", "entry_date"], name="manhour_ws_user_date_idx"),
        ]

    def __str__(self):
        return f"{self.user_id} {self.entry_date} {self.description}"
