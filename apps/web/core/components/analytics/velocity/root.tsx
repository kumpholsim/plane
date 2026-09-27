/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { useTranslation } from "@plane/i18n";
import type { TVelocityIndividualResponse, TVelocityProjectResponse } from "@plane/types";
import { useAnalytics } from "@/hooks/store/use-analytics";
import { useMember } from "@/hooks/store/use-member";
import { AnalyticsService } from "@/services/analytics.service";
import AnalyticsWrapper from "../analytics-wrapper";
import { VelocityIndividualView } from "./individual-view";
import { VelocityProjectView } from "./project-view";

const analyticsService = new AnalyticsService();

export const Velocity = observer(function Velocity() {
  const { t } = useTranslation();
  const { workspaceSlug } = useParams();
  const { selectedProjects } = useAnalytics();
  const {
    workspace: { workspaceMemberIds },
  } = useMember();
  const [mode, setMode] = useState<"project" | "individual">("project");
  const [focusProjectId, setFocusProjectId] = useState<string | null>(null);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "individual") return;
    const members = workspaceMemberIds ?? [];
    if (members.length === 0) return;
    if (!assigneeId || !members.includes(assigneeId)) {
      setAssigneeId(members[0] ?? null);
    }
  }, [mode, assigneeId, workspaceMemberIds]);

  const slug = workspaceSlug?.toString() ?? "";
  const projectKey = selectedProjects.join(",");
  const shouldFetch = Boolean(slug) && (mode === "project" || Boolean(assigneeId));
  const requestFocusId = focusProjectId ?? selectedProjects[0] ?? undefined;

  const { data, isLoading } = useSWR(
    shouldFetch ? ["workspace-velocity", slug, mode, projectKey, requestFocusId, assigneeId] : null,
    () =>
      analyticsService.getVelocityAnalytics(slug, {
        mode,
        ...(mode === "project" && selectedProjects.length > 0 ? { project_ids: selectedProjects.join(",") } : {}),
        ...(mode === "project" && requestFocusId ? { focus_project_id: requestFocusId } : {}),
        ...(assigneeId ? { assignee_id: assigneeId } : {}),
      })
  );

  const projectData = mode === "project" ? (data as TVelocityProjectResponse | undefined) : undefined;
  const individualData = mode === "individual" ? (data as TVelocityIndividualResponse | undefined) : undefined;

  const resolvedFocusId = useMemo(() => {
    if (focusProjectId) return focusProjectId;
    return projectData?.kpis.focus_project_id ?? selectedProjects[0] ?? null;
  }, [focusProjectId, projectData?.kpis.focus_project_id, selectedProjects]);

  return (
    <AnalyticsWrapper i18nTitle="workspace_analytics.velocity.title">
      <div className="flex flex-col gap-10">
        <div className="flex flex-wrap items-center gap-2">
          {(["project", "individual"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={`rounded-md px-3 py-1.5 text-13 font-medium ${
                mode === value ? "bg-layer-1 text-primary" : "text-tertiary hover:text-primary"
              }`}
            >
              {t(`workspace_analytics.velocity.${value}`)}
            </button>
          ))}
        </div>

        {mode === "project" ? (
          <VelocityProjectView
            data={projectData}
            isLoading={isLoading}
            focusProjectId={resolvedFocusId}
            onFocusProject={setFocusProjectId}
            assigneeId={assigneeId}
            onAssigneeChange={setAssigneeId}
          />
        ) : (
          <VelocityIndividualView
            data={individualData}
            isLoading={isLoading}
            assigneeId={assigneeId}
            onAssigneeChange={setAssigneeId}
          />
        )}
      </div>
    </AnalyticsWrapper>
  );
});
