# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db import IntegrityError

# Third Party imports
from rest_framework.response import Response
from rest_framework import status

# Module imports
from .. import BaseViewSet
from plane.app.serializers import ProjectHierarchyTypeSerializer
from plane.app.permissions import allow_permission, ProjectBasePermission, ROLE
from plane.db.models import ProjectHierarchyType, Project, ensure_default_project_hierarchy_types


class ProjectHierarchyTypeViewSet(BaseViewSet):
    serializer_class = ProjectHierarchyTypeSerializer
    model = ProjectHierarchyType
    permission_classes = [ProjectBasePermission]

    def get_queryset(self):
        queryset = (
            super()
            .get_queryset()
            .filter(workspace__slug=self.kwargs.get("slug"))
            .filter(project_id=self.kwargs.get("project_id"))
            .filter(project__project_projectmember__member=self.request.user)
            .select_related("project")
            .select_related("workspace")
            .distinct()
            .order_by("level", "sort_order")
        )
        level = self.request.query_params.get("level")
        if level is not None:
            try:
                queryset = queryset.filter(level=int(level))
            except (TypeError, ValueError):
                pass
        return self.filter_queryset(queryset)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def list(self, request, *args, **kwargs):
        # Backfill defaults for older projects that never received seeded types
        project = Project.objects.filter(
            id=self.kwargs.get("project_id"), workspace__slug=self.kwargs.get("slug")
        ).first()
        if project is not None:
            ensure_default_project_hierarchy_types(project, created_by=request.user)
        return super().list(request, *args, **kwargs)

    @allow_permission([ROLE.ADMIN])
    def create(self, request, slug, project_id):
        try:
            serializer = ProjectHierarchyTypeSerializer(
                data=request.data, context={"project_id": project_id}
            )
            if serializer.is_valid():
                serializer.save(project_id=project_id)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except IntegrityError:
            return Response(
                {"error": "Hierarchy type with the same name already exists at this level"},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @allow_permission([ROLE.ADMIN])
    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        level = request.data.get("level", instance.level)
        if "name" in request.data and ProjectHierarchyType.objects.filter(
            project_id=kwargs["project_id"],
            level=level,
            name=request.data["name"],
        ).exclude(pk=kwargs["pk"]).exists():
            return Response(
                {"error": "Hierarchy type with the same name already exists at this level"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ProjectHierarchyTypeSerializer(
            instance=instance,
            data=request.data,
            context={"project_id": kwargs["project_id"]},
            partial=True,
        )

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN])
    def destroy(self, request, *args, **kwargs):
        return super().destroy(request, *args, **kwargs)
