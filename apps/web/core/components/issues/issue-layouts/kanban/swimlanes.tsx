/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { MutableRefObject } from "react";
import { useRef } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import type {
  GroupByColumnTypes,
  IGroupByColumn,
  TGroupedIssues,
  TIssue,
  IIssueDisplayProperties,
  IIssueMap,
  TSubGroupedIssues,
  TIssueKanbanFilters,
  TIssueGroupByOptions,
  TIssueOrderByOptions,
  TDeliveryProgressStatus,
} from "@plane/types";
import { HIERARCHY_LEVEL_DELIVERY } from "@plane/types";
import { Row } from "@plane/ui";
import { cn } from "@plane/utils";
// hooks
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
import useIssuePeekOverviewRedirection from "@/hooks/use-issue-peek-overview-redirection";
import { usePlatformOS } from "@/hooks/use-platform-os";
import { useIsStagedGateScrumban } from "@/hooks/use-workflow-mode";
import { ProgressStatusDropdown } from "@/components/dropdowns/progress-status";
import { isFullyDoneL3ForCycleHighlight } from "@/components/issues/hierarchy-status";
import { HierarchyTypeBadge } from "@/components/issues/hierarchy-type-badge";
import { IssueIdentifier } from "@/components/issues/issue-detail/issue-identifier";
import { IssuePropertyLabels } from "@/components/issues/issue-layouts/properties/labels";
import { ParentEpicBadge } from "@/components/issues/parent-epic-badge";
// plane web imports
import { useWorkFlowFDragNDrop } from "@/components/workflow";
// local imports
import type { TRenderQuickActions } from "../list/list-view-types";
import type { GroupDropLocation } from "../utils";
import { collectGroupedIssueIds, getGroupByColumns, isWorkspaceLevel } from "../utils";
import { CLASSIC_KANBAN_COLUMN_CLASS, SCRUMBAN_KANBAN_COLUMN_CLASS } from "./scrumban-board-layout";
import { KanBan } from "./default";
import { HeaderGroupByCard } from "./headers/group-by-card";
import { HeaderSubGroupByCard } from "./headers/sub-group-by-card";

interface ISubGroupSwimlaneHeader {
  collapsedGroups: TIssueKanbanFilters;
  group_by: TIssueGroupByOptions | undefined;
  getGroupIssueCount: (
    groupId: string | undefined,
    subGroupId: string | undefined,
    isSubGroupCumulative: boolean
  ) => number | undefined;
  handleCollapsedGroups: (toggle: "group_by" | "sub_group_by", value: string) => void;
  isEpic?: boolean;
  list: IGroupByColumn[];
  showEmptyGroup: boolean;
  sub_group_by: TIssueGroupByOptions | undefined;
}

const visibilitySubGroupByGroupCount = (subGroupIssueCount: number, showEmptyGroup: boolean): boolean => {
  let subGroupHeaderVisibility = true;

  if (showEmptyGroup) subGroupHeaderVisibility = true;
  else {
    if (subGroupIssueCount > 0) subGroupHeaderVisibility = true;
    else subGroupHeaderVisibility = false;
  }

  return subGroupHeaderVisibility;
};

const SubGroupSwimlaneHeader = observer(function SubGroupSwimlaneHeader({
  collapsedGroups,
  getGroupIssueCount,
  group_by,
  handleCollapsedGroups,
  isEpic = false,
  list,
  showEmptyGroup,
  sub_group_by,
}: ISubGroupSwimlaneHeader) {
  const { getIsWorkflowWorkItemCreationDisabled } = useWorkFlowFDragNDrop(group_by, sub_group_by);
  const isStagedGateScrumban = useIsStagedGateScrumban();

  return (
    <div className="relative flex h-max min-h-full w-full items-center gap-4">
      {list &&
        list.length > 0 &&
        list.map((_list: IGroupByColumn) => {
          const groupCount = getGroupIssueCount(_list?.id, undefined, false) ?? 0;

          const subGroupByVisibilityToggle = visibilitySubGroupByGroupCount(groupCount, showEmptyGroup);

          if (subGroupByVisibilityToggle === false) return <></>;

          return (
            <div
              key={`${sub_group_by}_${_list.id}`}
              className={cn(
                "flex flex-col",
                isStagedGateScrumban ? SCRUMBAN_KANBAN_COLUMN_CLASS : CLASSIC_KANBAN_COLUMN_CLASS
              )}
            >
              <HeaderGroupByCard
                sub_group_by={sub_group_by}
                group_by={group_by}
                column_id={_list.id}
                icon={_list.icon}
                title={_list.name}
                count={groupCount}
                collapsedGroups={collapsedGroups}
                handleCollapsedGroups={handleCollapsedGroups}
                issuePayload={_list.payload}
                disableIssueCreation={getIsWorkflowWorkItemCreationDisabled(_list.id)}
                isEpic={isEpic}
              />
            </div>
          );
        })}
    </div>
  );
});

interface ISubGroupSwimlane extends ISubGroupSwimlaneHeader {
  addIssuesToView?: (issueIds: string[]) => Promise<TIssue>;
  canEditProperties: (projectId: string | undefined) => boolean;
  collapsedGroups: TIssueKanbanFilters;
  disableIssueCreation?: boolean;
  displayProperties: IIssueDisplayProperties | undefined;
  enableQuickIssueCreate: boolean;
  getGroupIssueCount: (
    groupId: string | undefined,
    subGroupId: string | undefined,
    isSubGroupCumulative: boolean
  ) => number | undefined;
  groupedIssueIds: TGroupedIssues | TSubGroupedIssues;
  handleCollapsedGroups: (toggle: "group_by" | "sub_group_by", value: string) => void;
  handleOnDrop: (source: GroupDropLocation, destination: GroupDropLocation) => Promise<void>;
  isEpic?: boolean;
  issuesMap: IIssueMap;
  loadMoreIssues: (groupId?: string, subGroupId?: string) => void;
  orderBy: TIssueOrderByOptions | undefined;
  quickActions: TRenderQuickActions;
  quickAddCallback?: (projectId: string | null | undefined, data: TIssue) => Promise<TIssue | undefined>;
  scrollableContainerRef?: MutableRefObject<HTMLDivElement | null>;
  showEmptyGroup: boolean;
  updateIssue: ((projectId: string | null, issueId: string, data: Partial<TIssue>) => Promise<void>) | undefined;
}

const SubGroupSwimlane = observer(function SubGroupSwimlane(props: ISubGroupSwimlane) {
  const {
    addIssuesToView,
    canEditProperties,
    collapsedGroups,
    disableIssueCreation,
    displayProperties,
    enableQuickIssueCreate,
    getGroupIssueCount,
    group_by,
    groupedIssueIds,
    handleCollapsedGroups,
    handleOnDrop,
    isEpic = false,
    issuesMap,
    list,
    loadMoreIssues,
    orderBy,
    quickActions,
    quickAddCallback,
    scrollableContainerRef,
    showEmptyGroup,
    sub_group_by,
    updateIssue,
  } = props;

  const isStagedGateScrumban = useIsStagedGateScrumban();
  const { workspaceSlug } = useParams();
  const { handleRedirection } = useIssuePeekOverviewRedirection(isEpic);
  const { isMobile } = usePlatformOS();
  // Keep swimlane boards mounted after first expand so collapse/expand is instant
  // (avoids remounting through RenderIfVisible gray placeholders).
  const mountedSwimlaneIdsRef = useRef(new Set<string>());

  const visibilitySubGroupBy = (
    _list: IGroupByColumn,
    subGroupCount: number
  ): { showGroup: boolean; showIssues: boolean } => {
    const subGroupVisibility = {
      showGroup: true,
      showIssues: true,
    };
    if (showEmptyGroup) subGroupVisibility.showGroup = true;
    else {
      if (subGroupCount > 0) subGroupVisibility.showGroup = true;
      else subGroupVisibility.showGroup = false;
    }
    if (collapsedGroups?.sub_group_by.includes(_list.id)) subGroupVisibility.showIssues = false;
    return subGroupVisibility;
  };

  return (
    <div className="relative h-max min-h-full w-full">
      {list &&
        list.length > 0 &&
        list.map((_list: IGroupByColumn, subGroupIndex) => {
          const issueCount = getGroupIssueCount(undefined, _list.id, true) ?? 0;
          const subGroupByVisibilityToggle = visibilitySubGroupBy(_list, issueCount);
          if (subGroupByVisibilityToggle.showGroup === false) return <></>;

          if (subGroupByVisibilityToggle.showIssues) {
            mountedSwimlaneIdsRef.current.add(_list.id);
          }
          const shouldMountIssues =
            subGroupByVisibilityToggle.showIssues || mountedSwimlaneIdsRef.current.has(_list.id);

          const l3Issue = issuesMap[_list.id];
          // Scrumban sub-groups by L3 delivery item and surfaces its progress on the swimlane header
          const isL3Swimlane =
            isStagedGateScrumban &&
            !!l3Issue &&
            _list.id !== "None" &&
            Number(l3Issue.hierarchy_level ?? HIERARCHY_LEVEL_DELIVERY) === HIERARCHY_LEVEL_DELIVERY;
          const canEditL3 = isL3Swimlane && canEditProperties(l3Issue.project_id ?? undefined);

          const handleL3ProgressChange = async (value: TDeliveryProgressStatus) => {
            if (!updateIssue || !l3Issue?.project_id) return;
            await updateIssue(l3Issue.project_id, l3Issue.id, { progress_status: value });
          };

          const handleL3LabelChange = async (labelIds: string[]) => {
            if (!updateIssue || !l3Issue?.project_id) return;
            await updateIssue(l3Issue.project_id, l3Issue.id, { label_ids: labelIds });
          };

          return (
            <div key={_list.id} className="flex flex-shrink-0 flex-col">
              {/* oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions */}
              <div
                className="sticky top-[50px] z-[3] flex w-full cursor-pointer items-center border-y-[0.5px] border-subtle bg-layer-3 py-1"
                onClick={() => handleCollapsedGroups("sub_group_by", _list.id)}
              >
                <Row
                  className={cn("sticky left-0", isStagedGateScrumban ? "flex min-w-0 items-center" : "flex-shrink-0")}
                >
                  <div
                    className={cn(
                      "flex max-w-4xl min-w-0 items-center gap-2",
                      isStagedGateScrumban &&
                        isFullyDoneL3ForCycleHighlight(l3Issue ?? { id: _list.id }, issuesMap) &&
                        "rounded-md bg-success-subtle px-1.5 py-0.5"
                    )}
                  >
                    <HeaderSubGroupByCard
                      column_id={_list.id}
                      icon={_list.icon}
                      title={_list.name}
                      count={issueCount}
                      collapsedGroups={collapsedGroups}
                      handleCollapsedGroups={handleCollapsedGroups}
                      sub_group_by={sub_group_by}
                      emphasizeTitle={isL3Swimlane}
                      leading={
                        isL3Swimlane ? (
                          // oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions
                          <div className="flex min-w-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <HierarchyTypeBadge issue={l3Issue} disabled={!canEditL3} updateIssue={updateIssue} />
                            {l3Issue.project_id && (
                              <IssueIdentifier
                                issueId={l3Issue.id}
                                projectId={l3Issue.project_id}
                                size="xs"
                                variant="tertiary"
                              />
                            )}
                          </div>
                        ) : undefined
                      }
                      trailing={
                        isL3Swimlane ? (
                          // oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions
                          <div className="flex shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
                            <ParentEpicBadge issue={l3Issue} />
                          </div>
                        ) : undefined
                      }
                      onTitleClick={
                        isL3Swimlane ? () => handleRedirection(workspaceSlug?.toString(), l3Issue, isMobile) : undefined
                      }
                    />
                    {isL3Swimlane && (
                      // oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions
                      <div
                        className="flex h-5 min-w-0 shrink-0 items-center gap-2"
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <ProgressStatusDropdown
                          value={l3Issue.progress_status}
                          onChange={handleL3ProgressChange}
                          projectId={l3Issue.project_id}
                          disabled={!canEditL3}
                          buttonVariant="border-with-text"
                          buttonContainerClassName="truncate max-w-48"
                          className="h-5 max-w-48"
                          showTooltip
                        />
                        <IssuePropertyLabels
                          projectId={l3Issue.project_id}
                          value={l3Issue.label_ids || []}
                          onChange={handleL3LabelChange}
                          disabled={!canEditL3}
                          hideDropdownArrow
                          maxRender={2}
                          renderByDefault={isMobile}
                        />
                      </div>
                    )}
                  </div>
                </Row>
              </div>

              {shouldMountIssues && (
                <div className={cn("relative", !subGroupByVisibilityToggle.showIssues && "hidden")}>
                  <KanBan
                    issuesMap={issuesMap}
                    groupedIssueIds={groupedIssueIds}
                    getGroupIssueCount={getGroupIssueCount}
                    displayProperties={displayProperties}
                    sub_group_by={sub_group_by}
                    group_by={group_by}
                    sub_group_id={_list.id}
                    subGroupIndex={subGroupIndex}
                    updateIssue={updateIssue}
                    quickActions={quickActions}
                    collapsedGroups={collapsedGroups}
                    handleCollapsedGroups={handleCollapsedGroups}
                    showEmptyGroup={showEmptyGroup}
                    enableQuickIssueCreate={enableQuickIssueCreate}
                    disableIssueCreation={disableIssueCreation}
                    canEditProperties={canEditProperties}
                    addIssuesToView={addIssuesToView}
                    quickAddCallback={quickAddCallback}
                    scrollableContainerRef={scrollableContainerRef}
                    loadMoreIssues={loadMoreIssues}
                    handleOnDrop={handleOnDrop}
                    orderBy={orderBy}
                    isDropDisabled={_list.isDropDisabled}
                    dropErrorMessage={_list.dropErrorMessage}
                    isEpic={isEpic}
                  />
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
});

export interface IKanBanSwimLanes {
  addIssuesToView?: (issueIds: string[]) => Promise<TIssue>;
  canEditProperties: (projectId: string | undefined) => boolean;
  collapsedGroups: TIssueKanbanFilters;
  disableIssueCreation?: boolean;
  displayProperties: IIssueDisplayProperties | undefined;
  enableQuickIssueCreate: boolean;
  getGroupIssueCount: (
    groupId: string | undefined,
    subGroupId: string | undefined,
    isSubGroupCumulative: boolean
  ) => number | undefined;
  group_by: TIssueGroupByOptions | undefined;
  groupedIssueIds: TGroupedIssues | TSubGroupedIssues;
  handleCollapsedGroups: (toggle: "group_by" | "sub_group_by", value: string) => void;
  handleOnDrop: (source: GroupDropLocation, destination: GroupDropLocation) => Promise<void>;
  isEpic?: boolean;
  issuesMap: IIssueMap;
  loadMoreIssues: (groupId?: string, subGroupId?: string) => void;
  orderBy: TIssueOrderByOptions | undefined;
  quickActions: TRenderQuickActions;
  quickAddCallback?: (projectId: string | null | undefined, data: TIssue) => Promise<TIssue | undefined>;
  scrollableContainerRef?: MutableRefObject<HTMLDivElement | null>;
  showEmptyGroup: boolean;
  sub_group_by: TIssueGroupByOptions | undefined;
  updateIssue: ((projectId: string | null, issueId: string, data: Partial<TIssue>) => Promise<void>) | undefined;
}

export const KanBanSwimLanes = observer(function KanBanSwimLanes(props: IKanBanSwimLanes) {
  const {
    issuesMap,
    groupedIssueIds,
    getGroupIssueCount,
    displayProperties,
    sub_group_by,
    group_by,
    orderBy,
    updateIssue,
    quickActions,
    collapsedGroups,
    handleCollapsedGroups,
    loadMoreIssues,
    showEmptyGroup,
    handleOnDrop,
    disableIssueCreation,
    enableQuickIssueCreate,
    canEditProperties,
    addIssuesToView,
    quickAddCallback,
    scrollableContainerRef,
    isEpic = false,
  } = props;
  // store hooks
  const storeType = useIssueStoreType();
  // derived values
  const groupByList = getGroupByColumns({
    groupBy: group_by as GroupByColumnTypes,
    includeNone: true,
    isWorkspaceLevel: isWorkspaceLevel(storeType),
    isEpic: isEpic,
  });
  const scopedIssueIds = collectGroupedIssueIds(groupedIssueIds as TGroupedIssues);
  const subGroupByList = getGroupByColumns({
    groupBy: sub_group_by as GroupByColumnTypes,
    includeNone: true,
    isWorkspaceLevel: isWorkspaceLevel(storeType),
    isEpic: isEpic,
    asSubGroup: true,
    issueIds: scopedIssueIds,
  });

  if (!groupByList || !subGroupByList) return null;

  return (
    <div className="relative w-full">
      <Row className="sticky top-0 z-[4] h-[50px] bg-surface-2">
        <SubGroupSwimlaneHeader
          getGroupIssueCount={getGroupIssueCount}
          group_by={group_by}
          sub_group_by={sub_group_by}
          collapsedGroups={collapsedGroups}
          handleCollapsedGroups={handleCollapsedGroups}
          list={groupByList}
          showEmptyGroup={showEmptyGroup}
          isEpic={isEpic}
        />
      </Row>

      {sub_group_by && (
        <SubGroupSwimlane
          issuesMap={issuesMap}
          list={subGroupByList}
          groupedIssueIds={groupedIssueIds}
          getGroupIssueCount={getGroupIssueCount}
          displayProperties={displayProperties}
          group_by={group_by}
          sub_group_by={sub_group_by}
          orderBy={orderBy}
          updateIssue={updateIssue}
          quickActions={quickActions}
          collapsedGroups={collapsedGroups}
          handleCollapsedGroups={handleCollapsedGroups}
          loadMoreIssues={loadMoreIssues}
          showEmptyGroup={showEmptyGroup}
          handleOnDrop={handleOnDrop}
          disableIssueCreation={disableIssueCreation}
          enableQuickIssueCreate={enableQuickIssueCreate}
          addIssuesToView={addIssuesToView}
          canEditProperties={canEditProperties}
          quickAddCallback={quickAddCallback}
          scrollableContainerRef={scrollableContainerRef}
          isEpic={isEpic}
        />
      )}
    </div>
  );
});
