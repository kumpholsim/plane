# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from uuid import UUID

from django.http import HttpRequest
from django.utils.dateparse import parse_date
from rest_framework import status
from rest_framework.response import Response

from plane.app.permissions import ROLE, allow_permission
from plane.app.views.base import BaseAPIView
from plane.db.models import ManhourManualEntry, Project, Workspace
from plane.utils.manhour_report import build_manhour_report, workspace_member_exists


class WorkspaceManhourReportEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def get(self, request: HttpRequest, slug: str) -> Response:
        assignee_id = request.GET.get("assignee_id")
        if not assignee_id:
            return Response({"error": "assignee_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        payload = build_manhour_report(
            slug=slug,
            user=request.user,
            assignee_id=assignee_id,
            start_raw=request.GET.get("start_date"),
            end_raw=request.GET.get("end_date"),
        )
        if payload is None:
            return Response(
                {"error": "assignee_id, start_date, and end_date are required and must be valid"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(payload, status=status.HTTP_200_OK)


class WorkspaceManhourEntryEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def post(self, request: HttpRequest, slug: str) -> Response:
        try:
            workspace = Workspace.objects.get(slug=slug)
        except Workspace.DoesNotExist:
            return Response({"error": "Workspace does not exist"}, status=status.HTTP_404_NOT_FOUND)

        user_id = request.data.get("user_id")
        description = (request.data.get("description") or "").strip()
        entry_date = parse_date(str(request.data.get("entry_date") or ""))
        project_id = request.data.get("project_id") or None

        try:
            manhour = float(request.data.get("manhour") if request.data.get("manhour") is not None else 0)
        except (TypeError, ValueError):
            return Response({"error": "manhour must be a number"}, status=status.HTTP_400_BAD_REQUEST)

        if not user_id or not description or not entry_date:
            return Response(
                {"error": "user_id, description, and entry_date are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if manhour < 0:
            return Response({"error": "manhour must be zero or greater"}, status=status.HTTP_400_BAD_REQUEST)
        if not workspace_member_exists(slug, user_id):
            return Response({"error": "user_id must be a workspace member"}, status=status.HTTP_400_BAD_REQUEST)

        project = None
        if project_id:
            project = Project.objects.filter(id=project_id, workspace=workspace).first()
            if project is None:
                return Response({"error": "project_id is invalid"}, status=status.HTTP_400_BAD_REQUEST)

        entry = ManhourManualEntry.objects.create(
            workspace=workspace,
            project=project,
            user_id=user_id,
            description=description,
            manhour=manhour,
            entry_date=entry_date,
            created_by=request.user,
        )
        return Response(
            {
                "id": str(entry.id),
                "source": "standalone",
                "description": entry.description,
                "manhour": entry.manhour,
                "entry_date": entry.entry_date.isoformat(),
                "project_id": str(entry.project_id) if entry.project_id else None,
                "user_id": str(entry.user_id),
            },
            status=status.HTTP_201_CREATED,
        )

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def delete(self, request: HttpRequest, slug: str, entry_id: UUID) -> Response:
        entry = ManhourManualEntry.objects.filter(workspace__slug=slug, id=entry_id).first()
        if entry is None:
            return Response({"error": "Entry does not exist"}, status=status.HTTP_404_NOT_FOUND)
        entry.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
