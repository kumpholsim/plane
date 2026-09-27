# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

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
        # Seed defaults only for Staged-gate Scrumban — never backfill classic Scrum projects.
        project = Project.objects.filter(
            id=self.kwargs.get("project_id"), workspace__slug=self.kwargs.get("slug")
        ).first()
        if project is not None and project.workflow_mode == "staged_gate_scrumban":
            ensure_default_project_hierarchy_types(project, created_by=request.user)
        return super().list(request, *args, **kwargs)

    @allow_permission([ROLE.ADMIN])
    def create(self, request, slug, project_id):
        return Response(
            {"error": "Hierarchy types are system-defined and cannot be created."},
            status=status.HTTP_403_FORBIDDEN,
        )

    @allow_permission([ROLE.ADMIN])
    def partial_update(self, request, *args, **kwargs):
        return Response(
            {"error": "Hierarchy types are system-defined and cannot be edited."},
            status=status.HTTP_403_FORBIDDEN,
        )

    @allow_permission([ROLE.ADMIN])
    def destroy(self, request, *args, **kwargs):
        return Response(
            {"error": "Hierarchy types are system-defined and cannot be deleted."},
            status=status.HTTP_403_FORBIDDEN,
        )
