/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { boardKeyForL3ProgressStatus, boardStateKeyFromExternalId, HIERARCHY_BOARD_STATE_KEYS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Tooltip } from "@plane/propel/tooltip";
import type {
  GroupByColumnTypes,
  IGroupByColumn,
  IIssueDisplayProperties,
  IIssueMap,
  TDeliveryProgressStatus,
  TGroupedIssues,
  TIssue,
  TIssueKanbanFilters,
  TSubGroupedIssues,
} from "@plane/types";
import { HIERARCHY_LEVEL_SUB_TASK } from "@plane/types";
import { cn } from "@plane/utils";
import { ProgressStatusDropdown } from "@/components/dropdowns/progress-status";
import { isFullyDoneL3ForCycleHighlight } from "@/components/issues/hierarchy-status";
import { HierarchyTypeBadge } from "@/components/issues/hierarchy-type-badge";
import { getHierarchyLevel } from "@/components/issues/issue-detail-widgets/sub-issues/depth";
import { IssueIdentifier } from "@/components/issues/issue-detail/issue-identifier";
import { IssuePropertyLabels } from "@/components/issues/issue-layouts/properties/labels";
import { ParentEpicBadge } from "@/components/issues/parent-epic-badge";
import { useProjectState } from "@/hooks/store/use-project-state";
import { useIssueStoreType, useIssuesStore } from "@/hooks/use-issue-layout-store";
import useIssuePeekOverviewRedirection from "@/hooks/use-issue-peek-overview-redirection";
import { usePlatformOS } from "@/hooks/use-platform-os";
import { IssueProperties } from "../properties/all-properties";
import { ScrumbanKanbanQuickAdd } from "../quick-add";
import { collectGroupedIssueIds, getGroupByColumns, isWorkspaceLevel } from "../utils";
import { SCRUMBAN_KANBAN_COLUMN_BODY_CLASS, SCRUMBAN_KANBAN_COLUMN_CLASS } from "./scrumban-board-layout";

type TUpdateIssue = ((projectId: string | null, issueId: string, data: Partial<TIssue>) => Promise<void>) | undefined;

type TStoryRow = { issueId: string; stateId: string };

export interface IKanBanStoryView {
  issuesMap: IIssueMap;
  groupedIssueIds: TGroupedIssues | TSubGroupedIssues;
  getGroupIssueCount: (
    groupId: string | undefined,
    subGroupId: string | undefined,
    isSubGroupCumulative: boolean
  ) => number | undefined;
  displayProperties: IIssueDisplayProperties | undefined;
  updateIssue: TUpdateIssue;
  collapsedGroups: TIssueKanbanFilters;
  handleCollapsedGroups: (toggle: "group_by" | "sub_group_by", value: string) => void;
  loadMoreIssues: (groupId?: string, subGroupId?: string) => void;
  enableQuickIssueCreate?: boolean;
  quickAddCallback?: (projectId: string | null | undefined, data: TIssue) => Promise<TIssue | undefined>;
  disableIssueCreation?: boolean;
  canEditProperties: (projectId: string | undefined) => boolean;
  isEpic?: boolean;
}

const NO_STORY_ID = "None";

/** Sub-task rows keep the same controls as the swimlane card; dates, module, cycle and counts are dropped. */
const getSubTaskRowDisplayProperties = (
  displayProperties: IIssueDisplayProperties | undefined
): IIssueDisplayProperties => ({
  state: displayProperties?.state ?? true,
  labels: displayProperties?.labels ?? true,
  priority: displayProperties?.priority ?? true,
  assignee: displayProperties?.assignee ?? true,
  estimate: displayProperties?.estimate ?? true,
  start_date: false,
  due_date: false,
  modules: false,
  cycle: false,
  sub_issue_count: false,
  link: false,
  attachment_count: false,
});

/** Sub-task rows for one story, ordered by board column (To Do first). */
const getStoryRows = (
  groupedIssueIds: TSubGroupedIssues,
  stateColumns: IGroupByColumn[],
  storyId: string
): TStoryRow[] =>
  stateColumns.flatMap((column) =>
    (groupedIssueIds?.[column.id]?.[storyId] ?? []).map((issueId) => ({ issueId, stateId: column.id }))
  );

const StoryBoardSubTaskRow = observer(function StoryBoardSubTaskRow(props: {
  issue: TIssue;
  displayProperties: IIssueDisplayProperties | undefined;
  updateIssue: TUpdateIssue;
  isReadOnly: boolean;
  onOpen: (issue: TIssue) => void;
}) {
  const { issue, displayProperties, updateIssue, isReadOnly, onOpen } = props;
  const { isMobile } = usePlatformOS();

  return (
    <div className="flex flex-col gap-1 rounded-md border-[0.5px] border-subtle bg-layer-2 px-2 py-1.5">
      <div className="flex min-w-0 items-center gap-1.5 leading-none">
        <HierarchyTypeBadge issue={issue} disabled={isReadOnly} updateIssue={updateIssue} />
        {issue.project_id && (
          <div className="shrink-0">
            <IssueIdentifier issueId={issue.id} projectId={issue.project_id} size="xs" variant="tertiary" />
          </div>
        )}
        <Tooltip tooltipContent={issue.name} isMobile={isMobile} renderByDefault={false}>
          <button
            type="button"
            className="min-w-0 flex-1 truncate text-left text-body-xs-medium text-primary hover:underline"
            onClick={() => onOpen(issue)}
          >
            {issue.name}
          </button>
        </Tooltip>
      </div>
      <IssueProperties
        className="flex min-w-0 flex-wrap items-center gap-1.5 text-tertiary"
        issue={issue}
        displayProperties={getSubTaskRowDisplayProperties(displayProperties)}
        activeLayout="List"
        updateIssue={updateIssue}
        isReadOnly={isReadOnly}
      />
    </div>
  );
});

type TStoryBoxProps = {
  storyId: string;
  rows: TStoryRow[];
  todoStateId: string | undefined;
  props: IKanBanStoryView;
  onOpen: (issue: TIssue) => void;
};

const StoryBoardStoryBox = observer(function StoryBoardStoryBox({
  storyId,
  rows,
  todoStateId,
  props,
  onOpen,
}: TStoryBoxProps) {
  const {
    issuesMap,
    getGroupIssueCount,
    displayProperties,
    updateIssue,
    collapsedGroups,
    handleCollapsedGroups,
    loadMoreIssues,
    enableQuickIssueCreate,
    quickAddCallback,
    disableIssueCreation,
    canEditProperties,
  } = props;
  const { t } = useTranslation();
  const { isMobile } = usePlatformOS();
  const {
    issues: { getPaginationData },
  } = useIssuesStore();

  const story = storyId === NO_STORY_ID ? undefined : issuesMap[storyId];
  const isCollapsed = collapsedGroups?.sub_group_by?.includes(storyId) ?? false;
  const canEditStory = !!story && canEditProperties(story.project_id ?? undefined);
  const count = story ? (getGroupIssueCount(undefined, storyId, true) ?? rows.length) : rows.length;
  const stateIdsWithMore = Array.from(new Set(rows.map((row) => row.stateId))).filter(
    (stateId) => !!getPaginationData(stateId, storyId)?.nextPageResults
  );

  const handleProgressChange = async (value: TDeliveryProgressStatus) => {
    if (!updateIssue || !story?.project_id) return;
    await updateIssue(story.project_id, story.id, { progress_status: value });
  };

  const handleLabelChange = async (labelIds: string[]) => {
    if (!updateIssue || !story?.project_id) return;
    await updateIssue(story.project_id, story.id, { label_ids: labelIds });
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-md border-[0.5px] border-subtle bg-layer-3 p-1.5",
        story && isFullyDoneL3ForCycleHighlight(story, issuesMap) && "bg-success-subtle"
      )}
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <button
            type="button"
            className="flex size-5 shrink-0 items-center justify-center rounded-sm text-tertiary hover:bg-layer-transparent-hover"
            onClick={() => handleCollapsedGroups("sub_group_by", storyId)}
            aria-label={isCollapsed ? "Expand story" : "Collapse story"}
          >
            <ChevronRight className={cn("size-3.5 transition-transform", !isCollapsed && "rotate-90")} />
          </button>
          {story ? (
            <>
              <HierarchyTypeBadge issue={story} disabled={!canEditStory} updateIssue={updateIssue} />
              {story.project_id && (
                <div className="min-w-0 flex-1">
                  <IssueIdentifier issueId={story.id} projectId={story.project_id} size="xs" variant="tertiary" />
                </div>
              )}
            </>
          ) : (
            <span className="min-w-0 flex-1 truncate text-body-sm-medium text-secondary">No story</span>
          )}
          <span className="shrink-0 text-caption-sm-regular text-tertiary">{count}</span>
        </div>
        {story && (
          <Tooltip tooltipContent={story.name} isMobile={isMobile} renderByDefault={false}>
            <button
              type="button"
              className="line-clamp-2 w-full text-left text-body-sm-medium break-words text-primary hover:underline"
              onClick={() => onOpen(story)}
            >
              {story.name}
            </button>
          </Tooltip>
        )}
        {story && (
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <ParentEpicBadge issue={story} />
            <ProgressStatusDropdown
              value={story.progress_status}
              onChange={handleProgressChange}
              projectId={story.project_id}
              disabled={!canEditStory}
              buttonVariant="border-with-text"
              buttonContainerClassName="truncate max-w-48"
              className="h-5 max-w-48"
              showTooltip
            />
            <IssuePropertyLabels
              projectId={story.project_id}
              value={story.label_ids || []}
              onChange={handleLabelChange}
              disabled={!canEditStory}
              hideDropdownArrow
              maxRender={2}
              renderByDefault={isMobile}
            />
          </div>
        )}
      </div>

      {!isCollapsed && (
        <div className="flex flex-col gap-1">
          {rows.map(({ issueId }) => {
            const issue = issuesMap[issueId];
            if (!issue) return null;
            return (
              <StoryBoardSubTaskRow
                key={issueId}
                issue={issue}
                displayProperties={displayProperties}
                updateIssue={updateIssue}
                isReadOnly={!canEditProperties(issue.project_id ?? undefined) || !!issue.tempId}
                onOpen={onOpen}
              />
            );
          })}
          {stateIdsWithMore.length > 0 && (
            <button
              type="button"
              className="w-full px-1 py-1 text-left text-13 font-medium text-accent-primary hover:text-accent-secondary hover:underline"
              onClick={() => stateIdsWithMore.forEach((stateId) => loadMoreIssues(stateId, storyId))}
            >
              {t("common.load_more")} &darr;
            </button>
          )}
          {story && enableQuickIssueCreate && !disableIssueCreation && todoStateId && (
            <ScrumbanKanbanQuickAdd
              parentIssueId={story.id}
              stateId={todoStateId}
              quickAddCallback={quickAddCallback}
            />
          )}
        </div>
      )}
    </div>
  );
});

/**
 * Display-only Scrumban board: each L3 is a box in the column of its progress stage,
 * with its L4 sub-tasks listed inside. No drag and drop.
 */
export const KanBanStoryView = observer(function KanBanStoryView(props: IKanBanStoryView) {
  const { groupedIssueIds, issuesMap, isEpic = false } = props;
  const { workspaceSlug } = useParams();
  const storeType = useIssueStoreType();
  const { getStateById } = useProjectState();
  const { handleRedirection } = useIssuePeekOverviewRedirection(isEpic);
  const { isMobile } = usePlatformOS();

  const stateColumns =
    getGroupByColumns({
      groupBy: "state" as GroupByColumnTypes,
      includeNone: true,
      isWorkspaceLevel: isWorkspaceLevel(storeType),
      isEpic,
    }) ?? [];
  const storyColumns =
    getGroupByColumns({
      groupBy: "module" as GroupByColumnTypes,
      includeNone: true,
      isWorkspaceLevel: isWorkspaceLevel(storeType),
      isEpic,
      asSubGroup: true,
      issueIds: collectGroupedIssueIds(groupedIssueIds as TGroupedIssues),
    }) ?? [];

  if (stateColumns.length === 0) return null;

  const subGroupedIssueIds = groupedIssueIds as TSubGroupedIssues;
  const columnKeyById = new Map(
    stateColumns.map((column) => [column.id, boardStateKeyFromExternalId(getStateById(column.id)?.external_id)])
  );
  const todoStateId =
    stateColumns.find((column) => columnKeyById.get(column.id) === HIERARCHY_BOARD_STATE_KEYS.DESIGN_DEV_TODO)?.id ??
    stateColumns[0]?.id;

  const storyIdsByColumn = new Map<string, string[]>(stateColumns.map((column) => [column.id, []]));
  storyColumns.forEach((storyColumn) => {
    if (storyColumn.id === NO_STORY_ID) return;
    const targetKey = boardKeyForL3ProgressStatus(issuesMap[storyColumn.id]?.progress_status);
    const columnId = stateColumns.find((column) => columnKeyById.get(column.id) === targetKey)?.id ?? todoStateId ?? "";
    storyIdsByColumn.get(columnId)?.push(storyColumn.id);
  });

  const handleOpen = (issue: TIssue) => handleRedirection(workspaceSlug?.toString(), issue, isMobile);

  return (
    <div className="relative w-full">
      <div className="sticky top-0 z-[4] flex h-[50px] w-full items-center gap-4 bg-surface-2">
        {stateColumns.map((column) => (
          <div key={column.id} className={cn("flex items-center gap-1 py-1.5", SCRUMBAN_KANBAN_COLUMN_CLASS)}>
            <div className="flex size-5 flex-shrink-0 items-center justify-center overflow-hidden rounded-xs">
              {column.icon}
            </div>
            <span className="truncate font-medium text-primary">{column.name}</span>
            <span className="pl-2 text-13 font-medium text-tertiary">
              {storyIdsByColumn.get(column.id)?.length ?? 0}
            </span>
          </div>
        ))}
      </div>

      <div className="flex w-full items-start gap-4 pb-4">
        {stateColumns.map((column) => {
          const storyIds = storyIdsByColumn.get(column.id) ?? [];
          const orphanRows = (subGroupedIssueIds?.[column.id]?.[NO_STORY_ID] ?? [])
            .filter((issueId) => getHierarchyLevel(issuesMap[issueId]) === HIERARCHY_LEVEL_SUB_TASK)
            .map((issueId) => ({ issueId, stateId: column.id }));
          return (
            <div
              key={column.id}
              className={cn(
                "flex min-h-[120px] flex-col gap-1.5 pt-1.5",
                SCRUMBAN_KANBAN_COLUMN_CLASS,
                SCRUMBAN_KANBAN_COLUMN_BODY_CLASS
              )}
            >
              {storyIds.map((storyId) => (
                <StoryBoardStoryBox
                  key={storyId}
                  storyId={storyId}
                  rows={getStoryRows(subGroupedIssueIds, stateColumns, storyId)}
                  todoStateId={todoStateId}
                  props={props}
                  onOpen={handleOpen}
                />
              ))}
              {orphanRows.length > 0 && (
                <StoryBoardStoryBox
                  storyId={NO_STORY_ID}
                  rows={orphanRows}
                  todoStateId={todoStateId}
                  props={props}
                  onOpen={handleOpen}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
