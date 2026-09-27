# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from uuid import UUID

from django.http import HttpRequest
from rest_framework import status
from rest_framework.response import Response

from plane.app.permissions import ROLE, allow_permission
from plane.app.views.base import BaseAPIView
from plane.utils.velocity import build_individual_velocity, build_project_velocity


def _parse_uuids(raw: str | None) -> list[UUID]:
    if not raw:
        return []
    values = []
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            values.append(UUID(part))
        except ValueError:
            continue
    return values


class WorkspaceVelocityEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def get(self, request: HttpRequest, slug: str) -> Response:
        mode = (request.GET.get("mode") or "project").strip().lower()
        if mode not in {"project", "individual"}:
            return Response({"error": "mode must be project or individual"}, status=status.HTTP_400_BAD_REQUEST)

        project_ids = _parse_uuids(request.GET.get("project_ids"))
        focus_project_id = request.GET.get("focus_project_id") or None
        assignee_id = request.GET.get("assignee_id") or None
        cycle_id = request.GET.get("cycle_id") or None

        if mode == "individual":
            if not assignee_id:
                return Response({"error": "assignee_id is required for individual mode"}, status=status.HTTP_400_BAD_REQUEST)
            return Response(
                build_individual_velocity(
                    slug=slug,
                    user=request.user,
                    assignee_id=assignee_id,
                    cycle_id=cycle_id,
                ),
                status=status.HTTP_200_OK,
            )

        return Response(
            build_project_velocity(
                slug=slug,
                user=request.user,
                project_ids=project_ids,
                focus_project_id=focus_project_id,
                assignee_id=assignee_id,
                cycle_id=cycle_id,
            ),
            status=status.HTTP_200_OK,
        )
