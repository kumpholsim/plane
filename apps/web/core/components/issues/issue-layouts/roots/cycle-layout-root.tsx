/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState } from "react";
import { isEmpty } from "lodash-es";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
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
import { EIssuesStoreType, EIssueLayoutTypes } from "@plane/types";
// components
import { TransferIssues } from "@/components/cycles/transfer-issues";
import { TransferIssuesModal } from "@/components/cycles/transfer-issues-modal";
// hooks
import { ProjectLevelWorkItemFiltersHOC } from "@/components/work-item-filters/filters-hoc/project-level";
import { WorkItemPinnedFilters } from "@/components/work-item-filters/pinned-filters";
import { WorkItemFiltersRow } from "@/components/work-item-filters/filters-row";
import { BoardFullscreenProvider } from "@/components/issues/issue-layouts/kanban/board-fullscreen-context";
import { BoardFullscreenShell } from "@/components/issues/issue-layouts/kanban/board-fullscreen-shell";
import { useCycle } from "@/hooks/store/use-cycle";
import { useIssues } from "@/hooks/store/use-issues";
import { useProject } from "@/hooks/store/use-project";
import { IssuesStoreContext } from "@/hooks/use-issue-layout-store";
// local imports
import { IssuePeekOverview } from "../../peek-overview";
import { CycleCalendarLayout } from "../calendar/roots/cycle-root";
import { BaseGanttRoot } from "../gantt";
import { CycleKanBanLayout } from "../kanban/roots/cycle-root";
import { CycleListLayout } from "../list/roots/cycle-root";
import { CycleSpreadsheetLayout } from "../spreadsheet/roots/cycle-root";

function CycleIssueLayout(props: {
  activeLayout: EIssueLayoutTypes | undefined;
  cycleId: string;
  isCompletedCycle: boolean;
}) {
  switch (props.activeLayout) {
    case EIssueLayoutTypes.LIST:
      return <CycleListLayout />;
    case EIssueLayoutTypes.KANBAN:
      return <CycleKanBanLayout />;
    case EIssueLayoutTypes.CALENDAR:
      return <CycleCalendarLayout />;
    case EIssueLayoutTypes.GANTT:
      return <BaseGanttRoot viewId={props.cycleId} isCompletedCycle={props.isCompletedCycle} />;
    case EIssueLayoutTypes.SPREADSHEET:
      return <CycleSpreadsheetLayout />;
    default:
      return null;
  }
}

export const CycleLayoutRoot = observer(function CycleLayoutRoot() {
  const { workspaceSlug: routerWorkspaceSlug, projectId: routerProjectId, cycleId: routerCycleId } = useParams();
  const workspaceSlug = routerWorkspaceSlug ? routerWorkspaceSlug.toString() : undefined;
  const projectId = routerProjectId ? routerProjectId.toString() : undefined;
  const cycleId = routerCycleId ? routerCycleId.toString() : undefined;
  // store hooks
  const { issuesFilter } = useIssues(EIssuesStoreType.CYCLE);
  const { getCycleById } = useCycle();
  const { getProjectById } = useProject();
  // state
  const [transferIssuesModal, setTransferIssuesModal] = useState(false);
  // derived values
  const workItemFilters = cycleId ? issuesFilter?.getIssueFilters(cycleId) : undefined;
  const activeLayout = workItemFilters?.displayFilters?.layout;
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
    workspaceSlug && projectId && cycleId ? `CYCLE_ISSUES_${workspaceSlug}_${projectId}_${cycleId}` : null,
    async () => {
      if (workspaceSlug && projectId && cycleId) {
        await issuesFilter?.fetchFilters(workspaceSlug, projectId, cycleId);
      }
    },
    { revalidateIfStale: false, revalidateOnFocus: false }
  );

  const cycleDetails = cycleId ? getCycleById(cycleId) : undefined;
  const cycleStatus = cycleDetails?.status?.toLocaleLowerCase() ?? "draft";
  const isCompletedCycle = cycleStatus === "completed";
  const isProgressSnapshotEmpty = isEmpty(cycleDetails?.progress_snapshot);
  const transferableIssuesCount = cycleDetails
    ? cycleDetails.backlog_issues + cycleDetails.unstarted_issues + cycleDetails.started_issues
    : 0;
  const canTransferIssues = isProgressSnapshotEmpty && transferableIssuesCount > 0;

  if (!workspaceSlug || !projectId || !cycleId || !workItemFilters) return <></>;
  return (
    <IssuesStoreContext.Provider value={EIssuesStoreType.CYCLE}>
      <BoardFullscreenProvider>
        <ProjectLevelWorkItemFiltersHOC
          enableSaveView
          entityType={EIssuesStoreType.CYCLE}
          entityId={cycleId}
          filtersToShowByLayout={filtersToShowByLayout}
          initialWorkItemFilters={workItemFilters}
          updateFilters={issuesFilter?.updateFilterExpression.bind(issuesFilter, workspaceSlug, projectId, cycleId)}
          projectId={projectId}
          workspaceSlug={workspaceSlug}
          pinnedProperties={
            isPinnedFilterLayout
              ? PINNED_WORK_ITEM_HEADER_FILTER_PROPERTIES
              : EMPTY_PINNED_WORK_ITEM_HEADER_FILTER_PROPERTIES
          }
        >
          {({ filter: cycleWorkItemsFilter }) => (
            <>
              <TransferIssuesModal
                handleClose={() => setTransferIssuesModal(false)}
                cycleId={cycleId}
                isOpen={transferIssuesModal}
              />
              <BoardFullscreenShell>
                {cycleStatus === "completed" && (
                  <TransferIssues
                    handleClick={() => setTransferIssuesModal(true)}
                    canTransferIssues={canTransferIssues}
                    disabled={!isEmpty(cycleDetails?.progress_snapshot)}
                  />
                )}
                {cycleWorkItemsFilter && (
                  <WorkItemFiltersRow
                    filter={cycleWorkItemsFilter}
                    leadingControls={
                      isPinnedFilterLayout ? (
                        <WorkItemPinnedFilters filter={cycleWorkItemsFilter} projectId={projectId} />
                      ) : undefined
                    }
                    suppressProperties={isPinnedFilterLayout ? suppressedProperties : undefined}
                    trackerElements={{
                      saveView: PROJECT_VIEW_TRACKER_ELEMENTS.CYCLE_HEADER_SAVE_AS_VIEW_BUTTON,
                    }}
                  />
                )}
                <div className="h-full w-full overflow-auto">
                  <CycleIssueLayout activeLayout={activeLayout} cycleId={cycleId} isCompletedCycle={isCompletedCycle} />
                </div>
                <IssuePeekOverview />
              </BoardFullscreenShell>
            </>
          )}
        </ProjectLevelWorkItemFiltersHOC>
      </BoardFullscreenProvider>
    </IssuesStoreContext.Provider>
  );
});
