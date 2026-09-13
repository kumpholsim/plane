/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { FoldVertical, UnfoldVertical } from "lucide-react";
// plane imports
import { ALL_ISSUES, EIssueFilterType, EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { IconButton } from "@plane/propel/icon-button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Tooltip } from "@plane/propel/tooltip";
import type { EIssuesStoreType, IBlockUpdateData, TIssue } from "@plane/types";
import { EIssueLayoutTypes, GANTT_TIMELINE_TYPE, HIERARCHY_LEVEL_DELIVERY } from "@plane/types";
import { renderFormattedPayloadDate } from "@plane/utils";
// components
import { TimeLineTypeContext } from "@/components/gantt-chart/contexts";
import { GanttChartRoot } from "@/components/gantt-chart/root";
import { IssueGanttSidebar } from "@/components/gantt-chart/sidebar/issues/sidebar";
import { getHierarchyLevel } from "@/components/issues/issue-detail-widgets/sub-issues/depth";
// hooks
import { useIssues } from "@/hooks/store/use-issues";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useUserPermissions } from "@/hooks/store/user";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
import { useIssuesActions } from "@/hooks/use-issues-actions";
import { useTimeLineChart } from "@/hooks/use-timeline-chart";
import { useBulkOperationStatus } from "@/hooks/use-bulk-operation-status";
import { useIsStagedGateScrumban } from "@/hooks/use-workflow-mode";
// local imports
import { IssueLayoutHOC } from "../issue-layout-HOC";
import { GanttQuickAddIssueButton, QuickAddIssueRoot } from "../quick-add";
import { IssueGanttBlock } from "./blocks";
import { GanttHierarchyProvider } from "./hierarchy-context";
import type { TGanttHierarchyMode } from "./hierarchy";
import { buildScrumbanGanttHierarchy, ensureGanttEpicPlaceholders } from "./hierarchy";

const EMPTY_EXPANDED_IDS = new Set<string>();

interface IBaseGanttRoot {
  viewId?: string | undefined;
  isCompletedCycle?: boolean;
  isEpic?: boolean;
}

export type GanttStoreType =
  | EIssuesStoreType.PROJECT
  | EIssuesStoreType.MODULE
  | EIssuesStoreType.CYCLE
  | EIssuesStoreType.PROJECT_VIEW
  | EIssuesStoreType.EPIC;

export const BaseGanttRoot = observer(function BaseGanttRoot(props: IBaseGanttRoot) {
  const { viewId, isCompletedCycle = false, isEpic = false } = props;
  const { t } = useTranslation();
  // router
  const { workspaceSlug, projectId } = useParams();

  const storeType = useIssueStoreType() as GanttStoreType;
  const { issues, issuesFilter } = useIssues(storeType);
  const { fetchIssues, fetchNextIssues, updateIssue, quickAddIssue, updateFilters } = useIssuesActions(storeType);
  const { initGantt } = useTimeLineChart(GANTT_TIMELINE_TYPE.ISSUE);
  // store hooks
  const { allowPermissions } = useUserPermissions();
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  const isStagedGateScrumban = useIsStagedGateScrumban(projectId?.toString());

  const appliedDisplayFilters = issuesFilter.issueFilters?.displayFilters;
  // plane web hooks
  const isBulkOperationsEnabled = useBulkOperationStatus();
  // derived values
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 1);

  const hierarchyMode: TGanttHierarchyMode =
    (appliedDisplayFilters?.gantt_hierarchy as TGanttHierarchyMode | undefined) ?? "l3_l4";
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const seededModeRef = useRef<TGanttHierarchyMode | null>(null);
  const suppressAutoExpandRef = useRef(false);

  useEffect(() => {
    fetchIssues("init-loader", { canGroup: false, perPageCount: 100 }, viewId);
  }, [fetchIssues, storeType, viewId]);

  useEffect(() => {
    initGantt();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init once on mount
  }, []);

  // Keep sub_issue fetch aligned with hierarchy mode for Scrumban timeline
  useEffect(() => {
    if (!isStagedGateScrumban || !workspaceSlug || !projectId) return;
    const shouldIncludeSubIssues = hierarchyMode === "l3_l4";
    if ((appliedDisplayFilters?.sub_issue ?? false) === shouldIncludeSubIssues) return;
    void updateFilters(projectId.toString(), EIssueFilterType.DISPLAY_FILTERS, {
      sub_issue: shouldIncludeSubIssues,
    }).then(() => {
      void fetchIssues("mutation", { canGroup: false, perPageCount: 100 }, viewId);
      return undefined;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync mode → sub_issue only
  }, [hierarchyMode, isStagedGateScrumban, projectId, workspaceSlug, viewId]);

  const rawIssueIds = useMemo(() => (issues.groupedIssueIds?.[ALL_ISSUES] as string[]) ?? [], [issues.groupedIssueIds]);
  const nextPageResults = issues.getPaginationData(undefined, undefined)?.nextPageResults;

  const { enableIssueCreation } = issues?.viewFlags || {};

  const loadMoreIssues = useCallback(() => {
    fetchNextIssues();
  }, [fetchNextIssues]);

  // Parent discovery must ignore expand state so collapse does not churn this list / re-seed expand.
  const parentIdsWithChildren = useMemo(() => {
    if (!isStagedGateScrumban) return [] as string[];
    const { parentChildMap } = buildScrumbanGanttHierarchy({
      issueIds: rawIssueIds,
      getIssueById,
      mode: hierarchyMode,
      expandedIds: EMPTY_EXPANDED_IDS,
    });
    return Object.entries(parentChildMap)
      .filter(([, childIds]) => childIds.length > 0)
      .map(([id]) => id);
  }, [getIssueById, hierarchyMode, isStagedGateScrumban, rawIssueIds]);

  const parentIdsWithChildrenKey = parentIdsWithChildren.join("|");

  const hierarchy = useMemo(() => {
    if (!isStagedGateScrumban) {
      return {
        blockIds: rawIssueIds,
        metaById: {},
        parentChildMap: {},
      };
    }
    return buildScrumbanGanttHierarchy({
      issueIds: rawIssueIds,
      getIssueById,
      mode: hierarchyMode,
      expandedIds,
    });
  }, [expandedIds, getIssueById, hierarchyMode, isStagedGateScrumban, rawIssueIds]);

  const allExpanded = parentIdsWithChildren.length > 0 && parentIdsWithChildren.every((id) => expandedIds.has(id));

  // Seed epic rows + rolled-up dates for L2 timeline parents
  useEffect(() => {
    if (!isStagedGateScrumban || hierarchyMode !== "l2_l3") return;
    ensureGanttEpicPlaceholders({
      parentChildMap: hierarchy.parentChildMap,
      getIssueById,
      addIssue: (issuesToAdd) => {
        // Seed map only — do not append synthetic epics to the cycle/project issue list.
        for (const issue of issuesToAdd) {
          issues.addIssue(issue, false);
        }
      },
      projectId: projectId?.toString(),
    });
  }, [getIssueById, hierarchy.parentChildMap, hierarchyMode, isStagedGateScrumban, issues, projectId]);

  // Auto-expand once when parents first appear for a mode; never after the user collapses.
  useEffect(() => {
    if (!isStagedGateScrumban) return;
    if (suppressAutoExpandRef.current) return;
    if (seededModeRef.current === hierarchyMode) return;
    if (parentIdsWithChildren.length === 0) return;
    seededModeRef.current = hierarchyMode;
    setExpandedIds(new Set(parentIdsWithChildren));
  }, [hierarchyMode, isStagedGateScrumban, parentIdsWithChildren, parentIdsWithChildrenKey]);

  const setHierarchyMode = useCallback(
    (mode: TGanttHierarchyMode) => {
      if (!workspaceSlug || !projectId) return;
      seededModeRef.current = null;
      suppressAutoExpandRef.current = false;
      setExpandedIds(new Set());
      void updateFilters(projectId.toString(), EIssueFilterType.DISPLAY_FILTERS, {
        gantt_hierarchy: mode,
        sub_issue: mode === "l3_l4",
      }).then(() => {
        void fetchIssues("mutation", { canGroup: false, perPageCount: 100 }, viewId);
        return undefined;
      });
    },
    [fetchIssues, projectId, updateFilters, viewId, workspaceSlug]
  );

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        suppressAutoExpandRef.current = true;
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedIds(new Set(parentIdsWithChildren));
  }, [parentIdsWithChildren]);

  const collapseAll = useCallback(() => {
    suppressAutoExpandRef.current = true;
    setExpandedIds(new Set());
  }, []);

  const updateIssueBlockStructure = async (issue: TIssue, data: IBlockUpdateData) => {
    if (!workspaceSlug) return;

    const payload: any = { ...data };
    if (data.sort_order) payload.sort_order = data.sort_order.newSortOrder;

    if (updateIssue) await updateIssue(issue.project_id, issue.id, payload);
  };

  const isAllowed = allowPermissions([EUserPermissions.ADMIN, EUserPermissions.MEMBER], EUserPermissionsLevel.PROJECT);

  const canReorderBlock = useCallback(
    (blockId: string) => {
      if (!isAllowed) return false;
      // Classic timeline: only when manual order is active
      if (!isStagedGateScrumban) return appliedDisplayFilters?.order_by === "sort_order";
      // Scrumban: L3 (Delivery) rows can be reordered up/down
      const issue = getIssueById(blockId);
      return getHierarchyLevel(issue) === HIERARCHY_LEVEL_DELIVERY;
    },
    [appliedDisplayFilters?.order_by, getIssueById, isAllowed, isStagedGateScrumban]
  );

  const updateBlockDates = useCallback(
    (
      updates: {
        id: string;
        start_date?: string;
        target_date?: string;
      }[]
    ) =>
      issues.updateIssueDates(workspaceSlug.toString(), updates, projectId.toString()).catch(() => {
        setToast({
          type: TOAST_TYPE.ERROR,
          title: t("toast.error"),
          message: "Error while updating work item dates, Please try again Later",
        });
      }),
    [issues, projectId, workspaceSlug, t]
  );

  const quickAdd =
    enableIssueCreation && isAllowed && !isCompletedCycle ? (
      <QuickAddIssueRoot
        layout={EIssueLayoutTypes.GANTT}
        QuickAddButton={GanttQuickAddIssueButton}
        containerClassName="sticky bottom-0 z-[1]"
        prePopulatedData={{
          start_date: renderFormattedPayloadDate(new Date()),
          target_date: renderFormattedPayloadDate(targetDate),
        }}
        quickAddCallback={quickAddIssue}
        isEpic={isEpic}
      />
    ) : undefined;

  const hierarchyContextValue = useMemo(
    () => ({
      enabled: isStagedGateScrumban,
      mode: hierarchyMode,
      setMode: setHierarchyMode,
      metaById: hierarchy.metaById,
      expandedIds,
      toggleExpanded,
      expandAll,
      collapseAll,
      allExpanded,
    }),
    [
      allExpanded,
      collapseAll,
      expandAll,
      expandedIds,
      hierarchy.metaById,
      hierarchyMode,
      isStagedGateScrumban,
      setHierarchyMode,
      toggleExpanded,
    ]
  );

  return (
    <IssueLayoutHOC layout={EIssueLayoutTypes.GANTT}>
      <TimeLineTypeContext.Provider value={GANTT_TIMELINE_TYPE.ISSUE}>
        <GanttHierarchyProvider value={hierarchyContextValue}>
          <div className="flex h-full w-full flex-col">
            {isStagedGateScrumban && (
              <div className="flex shrink-0 items-center gap-2 border-b border-subtle bg-surface-1 px-4 py-2">
                <span className="text-12 font-medium text-secondary">Timeline hierarchy</span>
                <div className="flex items-center gap-1 rounded-md border border-subtle p-0.5">
                  <button
                    type="button"
                    className={`rounded px-2.5 py-1 text-12 font-medium transition-colors ${
                      hierarchyMode === "l2_l3"
                        ? "bg-accent-primary text-on-color"
                        : "text-secondary hover:bg-layer-1 hover:text-primary"
                    }`}
                    onClick={() => setHierarchyMode("l2_l3")}
                  >
                    Epic View
                  </button>
                  <button
                    type="button"
                    className={`rounded px-2.5 py-1 text-12 font-medium transition-colors ${
                      hierarchyMode === "l3_l4"
                        ? "bg-accent-primary text-on-color"
                        : "text-secondary hover:bg-layer-1 hover:text-primary"
                    }`}
                    onClick={() => setHierarchyMode("l3_l4")}
                  >
                    Story View
                  </button>
                </div>
                {parentIdsWithChildren.length > 0 && (
                  <Tooltip tooltipContent={allExpanded ? "Collapse all" : "Expand all"} position="bottom">
                    <IconButton
                      size="lg"
                      variant="secondary"
                      icon={allExpanded ? FoldVertical : UnfoldVertical}
                      onClick={allExpanded ? collapseAll : expandAll}
                      aria-label={allExpanded ? "Collapse all" : "Expand all"}
                    />
                  </Tooltip>
                )}
              </div>
            )}
            <div className="h-full min-h-0 w-full flex-1">
              <GanttChartRoot
                border={false}
                title={isEpic ? t("epic.label", { count: 2 }) : t("issue.label", { count: 2 })}
                loaderTitle={isEpic ? t("epic.label", { count: 2 }) : t("issue.label", { count: 2 })}
                blockIds={hierarchy.blockIds}
                blockUpdateHandler={updateIssueBlockStructure}
                blockToRender={(data: TIssue) => <IssueGanttBlock issueId={data.id} isEpic={isEpic} />}
                sidebarToRender={(sidebarProps) => (
                  <IssueGanttSidebar {...sidebarProps} showAllBlocks isEpic={isEpic} />
                )}
                enableBlockLeftResize={isAllowed}
                enableBlockRightResize={isAllowed}
                enableBlockMove={isAllowed}
                enableReorder={canReorderBlock}
                enableAddBlock={isAllowed}
                enableSelection={isBulkOperationsEnabled && isAllowed}
                quickAdd={quickAdd}
                loadMoreBlocks={loadMoreIssues}
                canLoadMoreBlocks={nextPageResults}
                updateBlockDates={updateBlockDates}
                showAllBlocks
                enableDependency
                isEpic={isEpic}
              />
            </div>
          </div>
        </GanttHierarchyProvider>
      </TimeLineTypeContext.Provider>
    </IssueLayoutHOC>
  );
});
