/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import useSWR from "swr";
// plane constants
import {
  ISSUE_DISPLAY_FILTERS_BY_PAGE,
  PROJECT_VIEW_TRACKER_ELEMENTS,
  PINNED_WORK_ITEM_HEADER_FILTER_PROPERTIES,
  EMPTY_PINNED_WORK_ITEM_HEADER_FILTER_PROPERTIES,
  isStagedGateScrumbanMode,
} from "@plane/constants";
import type { TWorkItemFilterProperty } from "@plane/types";
import { EIssueLayoutTypes, EIssuesStoreType } from "@plane/types";
import { Spinner } from "@plane/ui";
// components
import { ProjectLevelWorkItemFiltersHOC } from "@/components/work-item-filters/filters-hoc/project-level";
import { ScrumbanWorkItemFiltersRow } from "@/components/work-item-filters/scrumban-filters-row";
// hooks
import { BoardFullscreenProvider } from "@/components/issues/issue-layouts/kanban/board-fullscreen-context";
import { BoardFullscreenShell } from "@/components/issues/issue-layouts/kanban/board-fullscreen-shell";
import { useIssues } from "@/hooks/store/use-issues";
import { useProject } from "@/hooks/store/use-project";
import { useAppRouter } from "@/hooks/use-app-router";
import { IssuesStoreContext } from "@/hooks/use-issue-layout-store";
// local imports
import { IssuePeekOverview } from "../../peek-overview";
import { CalendarLayout } from "../calendar/roots/project-root";
import { BaseGanttRoot } from "../gantt";
import { KanBanLayout } from "../kanban/roots/project-root";
import { ListLayout } from "../list/roots/project-root";
import { ProjectSpreadsheetLayout } from "../spreadsheet/roots/project-root";

function ProjectIssueLayout(props: { activeLayout: EIssueLayoutTypes | undefined }) {
  switch (props.activeLayout) {
    case EIssueLayoutTypes.LIST:
      return <ListLayout />;
    case EIssueLayoutTypes.KANBAN:
      return <KanBanLayout />;
    case EIssueLayoutTypes.CALENDAR:
      return <CalendarLayout />;
    case EIssueLayoutTypes.GANTT:
      return <BaseGanttRoot />;
    case EIssueLayoutTypes.SPREADSHEET:
      return <ProjectSpreadsheetLayout />;
    default:
      return null;
  }
}

export const ProjectLayoutRoot = observer(function ProjectLayoutRoot() {
  // router
  const { workspaceSlug: routerWorkspaceSlug, projectId: routerProjectId } = useParams();
  const workspaceSlug = routerWorkspaceSlug ? routerWorkspaceSlug.toString() : undefined;
  const projectId = routerProjectId ? routerProjectId.toString() : undefined;
  const router = useAppRouter();
  // hooks
  const { issues, issuesFilter } = useIssues(EIssuesStoreType.PROJECT);
  const { getProjectById } = useProject();
  // derived values
  const workItemFilters = projectId ? issuesFilter?.getIssueFilters(projectId) : undefined;
  const activeLayout = workItemFilters?.displayFilters?.layout;
  const isScrumban = isStagedGateScrumbanMode(projectId ? getProjectById(projectId)?.workflow_mode : undefined);

  // Scrumban uses Cycles as the primary board — bounce /issues away once mode is known
  useEffect(() => {
    if (!isScrumban || !workspaceSlug || !projectId) return;
    router.replace(`/${workspaceSlug}/projects/${projectId}/cycles/`);
  }, [isScrumban, workspaceSlug, projectId, router]);

  const isPinnedFilterLayout =
    isScrumban && (activeLayout === EIssueLayoutTypes.LIST || activeLayout === EIssueLayoutTypes.KANBAN);
  const filtersToShowByLayout: TWorkItemFilterProperty[] = isPinnedFilterLayout
    ? ISSUE_DISPLAY_FILTERS_BY_PAGE.issues.filters.filter(
        (property): property is TWorkItemFilterProperty =>
          !["state_id", "assignee_id", "progress_status", "hierarchy_type_id"].includes(property as string)
      )
    : [...ISSUE_DISPLAY_FILTERS_BY_PAGE.issues.filters];
  // L3 Category / State / Assignees are list/board-only — hide chips on calendar/table/timeline.
  const suppressedProperties: TWorkItemFilterProperty[] | undefined = !isScrumban
    ? undefined
    : ["state_id", "progress_status", "assignee_id", "hierarchy_type_id"];

  useSWR(
    workspaceSlug && projectId ? `PROJECT_ISSUES_${workspaceSlug}_${projectId}` : null,
    async () => {
      if (workspaceSlug && projectId) {
        await issuesFilter?.fetchFilters(workspaceSlug, projectId);
      }
    },
    { revalidateIfStale: false, revalidateOnFocus: false }
  );

  if (!workspaceSlug || !projectId || !workItemFilters) return <></>;
  return (
    <IssuesStoreContext.Provider value={EIssuesStoreType.PROJECT}>
      <BoardFullscreenProvider>
        <ProjectLevelWorkItemFiltersHOC
          enableSaveView
          entityType={EIssuesStoreType.PROJECT}
          entityId={projectId}
          filtersToShowByLayout={filtersToShowByLayout}
          initialWorkItemFilters={workItemFilters}
          updateFilters={issuesFilter?.updateFilterExpression.bind(issuesFilter, workspaceSlug, projectId)}
          projectId={projectId}
          workspaceSlug={workspaceSlug}
          pinnedProperties={
            isPinnedFilterLayout
              ? PINNED_WORK_ITEM_HEADER_FILTER_PROPERTIES
              : EMPTY_PINNED_WORK_ITEM_HEADER_FILTER_PROPERTIES
          }
        >
          {({ filter: projectWorkItemsFilter }) => (
            <BoardFullscreenShell>
              <ScrumbanWorkItemFiltersRow
                filter={projectWorkItemsFilter}
                projectId={projectId}
                isPinnedFilterLayout={isPinnedFilterLayout}
                suppressedProperties={suppressedProperties}
                trackerElements={{
                  saveView: PROJECT_VIEW_TRACKER_ELEMENTS.PROJECT_HEADER_SAVE_AS_VIEW_BUTTON,
                }}
              />
              <div className="relative h-full w-full overflow-auto bg-surface-1">
                {/* mutation loader */}
                {issues?.getIssueLoader() === "mutation" && (
                  <div className="shadow-sm fixed top-[70px] right-[20px] z-50 flex h-[40px] w-[40px] items-center justify-center rounded-sm bg-layer-1">
                    <Spinner className="h-4 w-4" />
                  </div>
                )}
                <ProjectIssueLayout activeLayout={activeLayout} />
              </div>
              <IssuePeekOverview />
            </BoardFullscreenShell>
          )}
        </ProjectLevelWorkItemFiltersHOC>
      </BoardFullscreenProvider>
    </IssuesStoreContext.Provider>
  );
});
