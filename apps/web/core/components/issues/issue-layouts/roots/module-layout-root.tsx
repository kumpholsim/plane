/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import useSWR from "swr";
// plane imports
import {
  ISSUE_DISPLAY_FILTERS_BY_PAGE,
  PROJECT_VIEW_TRACKER_ELEMENTS,
  PINNED_WORK_ITEM_HEADER_FILTER_PROPERTIES,
  EMPTY_PINNED_WORK_ITEM_HEADER_FILTER_PROPERTIES,
  isStagedGateScrumbanMode,
} from "@plane/constants";
import type { TWorkItemFilterProperty } from "@plane/types";
import { EIssuesStoreType, EIssueLayoutTypes } from "@plane/types";
import { Row, ERowVariant } from "@plane/ui";
// hooks
import { ProjectLevelWorkItemFiltersHOC } from "@/components/work-item-filters/filters-hoc/project-level";
import { WorkItemPinnedFilters } from "@/components/work-item-filters/pinned-filters";
import { WorkItemFiltersRow } from "@/components/work-item-filters/filters-row";
import { BoardFullscreenProvider } from "@/components/issues/issue-layouts/kanban/board-fullscreen-context";
import { BoardFullscreenShell } from "@/components/issues/issue-layouts/kanban/board-fullscreen-shell";
import { useIssues } from "@/hooks/store/use-issues";
import { useProject } from "@/hooks/store/use-project";
import { IssuesStoreContext } from "@/hooks/use-issue-layout-store";
// local imports
import { IssuePeekOverview } from "../../peek-overview";
import { ModuleCalendarLayout } from "../calendar/roots/module-root";
import { BaseGanttRoot } from "../gantt";
import { ModuleKanBanLayout } from "../kanban/roots/module-root";
import { ModuleListLayout } from "../list/roots/module-root";
import { ModuleSpreadsheetLayout } from "../spreadsheet/roots/module-root";

function ModuleIssueLayout(props: { activeLayout: EIssueLayoutTypes | undefined; moduleId: string }) {
  switch (props.activeLayout) {
    case EIssueLayoutTypes.LIST:
      return <ModuleListLayout />;
    case EIssueLayoutTypes.KANBAN:
      return <ModuleKanBanLayout />;
    case EIssueLayoutTypes.CALENDAR:
      return <ModuleCalendarLayout />;
    case EIssueLayoutTypes.GANTT:
      return <BaseGanttRoot viewId={props.moduleId} />;
    case EIssueLayoutTypes.SPREADSHEET:
      return <ModuleSpreadsheetLayout />;
    default:
      return null;
  }
}

export const ModuleLayoutRoot = observer(function ModuleLayoutRoot() {
  // router
  const { workspaceSlug: routerWorkspaceSlug, projectId: routerProjectId, moduleId: routerModuleId } = useParams();
  const workspaceSlug = routerWorkspaceSlug ? routerWorkspaceSlug.toString() : undefined;
  const projectId = routerProjectId ? routerProjectId.toString() : undefined;
  const moduleId = routerModuleId ? routerModuleId.toString() : undefined;
  // hooks
  const { issuesFilter } = useIssues(EIssuesStoreType.MODULE);
  const { getProjectById } = useProject();
  // derived values
  const workItemFilters = moduleId ? issuesFilter?.getIssueFilters(moduleId) : undefined;
  const activeLayout = workItemFilters?.displayFilters?.layout || undefined;
  const isScrumban = isStagedGateScrumbanMode(projectId ? getProjectById(projectId)?.workflow_mode : undefined);
  const isPinnedFilterLayout =
    isScrumban && (activeLayout === EIssueLayoutTypes.LIST || activeLayout === EIssueLayoutTypes.KANBAN);
  const filtersToShowByLayout: TWorkItemFilterProperty[] = isPinnedFilterLayout
    ? ISSUE_DISPLAY_FILTERS_BY_PAGE.issues.filters.filter(
        (property): property is TWorkItemFilterProperty =>
          !["state_id", "assignee_id", "progress_status"].includes(property as string)
      )
    : [...ISSUE_DISPLAY_FILTERS_BY_PAGE.issues.filters];
  const suppressedProperties: TWorkItemFilterProperty[] = ["state_id", "progress_status", "assignee_id"];

  useSWR(
    workspaceSlug && projectId && moduleId
      ? `MODULE_ISSUES_${workspaceSlug.toString()}_${projectId.toString()}_${moduleId.toString()}`
      : null,
    async () => {
      if (workspaceSlug && projectId && moduleId) {
        await issuesFilter?.fetchFilters(workspaceSlug.toString(), projectId.toString(), moduleId.toString());
      }
    },
    { revalidateIfStale: false, revalidateOnFocus: false }
  );

  if (!workspaceSlug || !projectId || !moduleId || !workItemFilters) return <></>;
  return (
    <IssuesStoreContext.Provider value={EIssuesStoreType.MODULE}>
      <BoardFullscreenProvider>
        <ProjectLevelWorkItemFiltersHOC
          enableSaveView
          entityType={EIssuesStoreType.MODULE}
          entityId={moduleId}
          filtersToShowByLayout={filtersToShowByLayout}
          initialWorkItemFilters={workItemFilters}
          updateFilters={issuesFilter?.updateFilterExpression.bind(issuesFilter, workspaceSlug, projectId, moduleId)}
          projectId={projectId}
          workspaceSlug={workspaceSlug}
          pinnedProperties={
            isPinnedFilterLayout
              ? PINNED_WORK_ITEM_HEADER_FILTER_PROPERTIES
              : EMPTY_PINNED_WORK_ITEM_HEADER_FILTER_PROPERTIES
          }
        >
          {({ filter: moduleWorkItemsFilter }) => (
            <BoardFullscreenShell>
              {moduleWorkItemsFilter && (
                <WorkItemFiltersRow
                  filter={moduleWorkItemsFilter}
                  leadingControls={
                    isPinnedFilterLayout ? (
                      <WorkItemPinnedFilters filter={moduleWorkItemsFilter} projectId={projectId} />
                    ) : undefined
                  }
                  suppressProperties={isPinnedFilterLayout ? suppressedProperties : undefined}
                  trackerElements={{
                    saveView: PROJECT_VIEW_TRACKER_ELEMENTS.MODULE_HEADER_SAVE_AS_VIEW_BUTTON,
                  }}
                />
              )}
              <Row variant={ERowVariant.HUGGING} className="h-full w-full overflow-auto">
                <ModuleIssueLayout activeLayout={activeLayout} moduleId={moduleId} />
              </Row>
              <IssuePeekOverview />
            </BoardFullscreenShell>
          )}
        </ProjectLevelWorkItemFiltersHOC>
      </BoardFullscreenProvider>
    </IssuesStoreContext.Provider>
  );
});
