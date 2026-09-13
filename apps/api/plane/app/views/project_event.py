# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from datetime import datetime

from django.utils.dateparse import parse_datetime
from rest_framework import status
from rest_framework.response import Response

from plane.app.permissions import ProjectBasePermission, ROLE, allow_permission
from plane.app.serializers import ProjectEventSerializer
from plane.db.models import ProjectEvent
from .base import BaseViewSet


class ProjectEventViewSet(BaseViewSet):
    serializer_class = ProjectEventSerializer
    model = ProjectEvent
    permission_classes = [ProjectBasePermission]

    def get_queryset(self):
        queryset = (
            super()
            .get_queryset()
            .filter(workspace__slug=self.kwargs.get("slug"))
            .filter(project_id=self.kwargs.get("project_id"))
            .filter(project__project_projectmember__member=self.request.user)
            .select_related("project", "workspace")
            .distinct()
            .order_by("start_at", "created_at")
        )

        # Overlap range: events that intersect [start, end]
        start = self.request.query_params.get("start")
        end = self.request.query_params.get("end")
        start_dt = parse_datetime(start) if start else None
        end_dt = parse_datetime(end) if end else None
        if start and not start_dt:
            try:
                start_dt = datetime.fromisoformat(start.replace("Z", "+00:00"))
            except ValueError:
                start_dt = None
        if end and not end_dt:
            try:
                end_dt = datetime.fromisoformat(end.replace("Z", "+00:00"))
            except ValueError:
                end_dt = None

        if start_dt is not None:
            queryset = queryset.filter(end_at__gte=start_dt)
        if end_dt is not None:
            queryset = queryset.filter(start_at__lte=end_dt)

        return self.filter_queryset(queryset)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def create(self, request, slug, project_id):
        serializer = ProjectEventSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(project_id=project_id)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def partial_update(self, request, *args, **kwargs):
        return super().partial_update(request, *args, **kwargs)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def destroy(self, request, *args, **kwargs):
        return super().destroy(request, *args, **kwargs)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, *args, **kwargs)
