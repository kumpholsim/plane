# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from .base import BaseSerializer
from rest_framework import serializers
from plane.db.models import ProjectEvent


class ProjectEventSerializer(BaseSerializer):
    class Meta:
        model = ProjectEvent
        fields = [
            "id",
            "project_id",
            "workspace_id",
            "name",
            "description",
            "start_at",
            "end_at",
            "all_day",
            "color",
            "cover_image",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = ["workspace", "project", "created_at", "updated_at", "created_by", "updated_by"]

    def validate(self, attrs):
        start_at = attrs.get("start_at", getattr(self.instance, "start_at", None))
        end_at = attrs.get("end_at", getattr(self.instance, "end_at", None))
        if start_at and end_at and end_at < start_at:
            raise serializers.ValidationError({"end_at": "end_at must be on or after start_at"})
        return attrs
