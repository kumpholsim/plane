/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import useSWR from "swr";
// plane constants
import {
  ISSUE_DISPLAY_FILTERS_BY_PAGE,
  PROJECT_VIEW_TRACKER_ELEMENTS,
  PINNED_WORK_ITEM_HEADER_FILTER_PROPERTIES,
} from "@plane/constants";
import type { TWorkItemFilterProperty } from "@plane/types";
import { EIssueLayoutTypes, EIssuesStoreType } from "@plane/types";
import { Spinner } from "@plane/ui";
// components
import { ProjectLevelWorkItemFiltersHOC } from "@/components/work-item-filters/filters-hoc/project-level";
import { WorkItemPinnedFilters } from "@/components/work-item-filters/pinned-filters";
import { WorkItemFiltersRow } from "@/components/work-item-filters/filters-row";
// hooks
import { BoardFullscreenProvider } from "@/components/issues/issue-layouts/kanban/board-fullscreen-context";
import { BoardFullscreenShell } from "@/components/issues/issue-layouts/kanban/board-fullscreen-shell";
import { useIssues } from "@/hooks/store/use-issues";
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
  // hooks
  const { issues, issuesFilter } = useIssues(EIssuesStoreType.PROJECT);
  // derived values
  const workItemFilters = projectId ? issuesFilter?.getIssueFilters(projectId) : undefined;
  const activeLayout = workItemFilters?.displayFilters?.layout;
  const isPinnedFilterLayout = activeLayout === EIssueLayoutTypes.LIST || activeLayout === EIssueLayoutTypes.KANBAN;
  const filtersToShowByLayout: TWorkItemFilterProperty[] = isPinnedFilterLayout
    ? [
        ...ISSUE_DISPLAY_FILTERS_BY_PAGE.issues.filters.filter(
          (property): property is TWorkItemFilterProperty => !["state_id", "assignee_id"].includes(property as string)
        ),
        "progress_status",
      ]
    : [...ISSUE_DISPLAY_FILTERS_BY_PAGE.issues.filters];
  const suppressedProperties: TWorkItemFilterProperty[] = ["state_id", "progress_status", "assignee_id"];

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
          pinnedProperties={isPinnedFilterLayout ? PINNED_WORK_ITEM_HEADER_FILTER_PROPERTIES : []}
        >
          {({ filter: projectWorkItemsFilter }) => (
            <BoardFullscreenShell>
              {projectWorkItemsFilter && (
                <WorkItemFiltersRow
                  filter={projectWorkItemsFilter}
                  leadingControls={
                    isPinnedFilterLayout ? (
                      <WorkItemPinnedFilters filter={projectWorkItemsFilter} projectId={projectId} />
                    ) : undefined
                  }
                  suppressProperties={isPinnedFilterLayout ? suppressedProperties : undefined}
                  trackerElements={{
                    saveView: PROJECT_VIEW_TRACKER_ELEMENTS.PROJECT_HEADER_SAVE_AS_VIEW_BUTTON,
                  }}
                />
              )}
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
