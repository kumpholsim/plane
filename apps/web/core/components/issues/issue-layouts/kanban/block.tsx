/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { MutableRefObject } from "react";
import { useEffect, useRef, useState } from "react";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { draggable, dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane helpers
import { MoreHorizontal } from "lucide-react";
import { useOutsideClickDetector } from "@plane/hooks";
// types
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Tooltip } from "@plane/propel/tooltip";
import type { TIssue, IIssueDisplayProperties, IIssueMap } from "@plane/types";
import { EIssueServiceType, EIssuesStoreType, HIERARCHY_LEVEL_SUB_TASK } from "@plane/types";
// ui
import { ControlLink, DropIndicator } from "@plane/ui";
import { cn, generateWorkItemLink } from "@plane/utils";
// components
import RenderIfVisible from "@/components/core/render-if-visible-HOC";
import { EstimateDropdown } from "@/components/dropdowns/estimate";
import { MemberDropdown } from "@/components/dropdowns/member/dropdown";
import { isFullyDoneL3ForCycleHighlight } from "@/components/issues/hierarchy-status";
import { HIGHLIGHT_CLASS, getIssueBlockId } from "@/components/issues/issue-layouts/utils";
import { IssueIdentifier } from "@/components/issues/issue-detail/issue-identifier";
import { HierarchyTypeBadge } from "@/components/issues/hierarchy-type-badge";
import { getHierarchyLevel } from "@/components/issues/issue-detail-widgets/sub-issues/depth";
// hooks
import { useProjectEstimates } from "@/hooks/store/estimates";
import { useEstimate } from "@/hooks/store/estimates/use-estimate";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useKanbanView } from "@/hooks/store/use-kanban-view";
import { useProject } from "@/hooks/store/use-project";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
import useIssuePeekOverviewRedirection from "@/hooks/use-issue-peek-overview-redirection";
import { usePlatformOS } from "@/hooks/use-platform-os";
import { useIsStagedGateScrumban } from "@/hooks/use-workflow-mode";
import { useTranslation } from "@plane/i18n";
// local components
import type { TRenderQuickActions } from "../list/list-view-types";
import { IssueProperties } from "../properties/all-properties";

interface IssueBlockProps {
  issueId: string;
  groupId: string;
  subGroupId: string;
  issuesMap: IIssueMap;
  displayProperties: IIssueDisplayProperties | undefined;
  draggableId: string;
  canDropOverIssue: boolean;
  canDragIssuesInCurrentGrouping: boolean;
  updateIssue: ((projectId: string | null, issueId: string, data: Partial<TIssue>) => Promise<void>) | undefined;
  quickActions: TRenderQuickActions;
  canEditProperties: (projectId: string | undefined) => boolean;
  scrollableContainerRef?: MutableRefObject<HTMLDivElement | null>;
  shouldRenderByDefault?: boolean;
  isEpic?: boolean;
}

interface IssueDetailsBlockProps {
  cardRef: React.RefObject<HTMLElement>;
  issue: TIssue;
  displayProperties: IIssueDisplayProperties | undefined;
  updateIssue: ((projectId: string | null, issueId: string, data: Partial<TIssue>) => Promise<void>) | undefined;
  quickActions: TRenderQuickActions;
  isReadOnly: boolean;
  isEpic?: boolean;
  isCompact?: boolean;
}

const KanbanCardFooter = observer(function KanbanCardFooter(props: {
  issue: TIssue;
  displayProperties: IIssueDisplayProperties | undefined;
  updateIssue: IssueDetailsBlockProps["updateIssue"];
  isReadOnly: boolean;
}) {
  const { issue, displayProperties, updateIssue, isReadOnly } = props;
  const { t } = useTranslation();
  const { isMobile } = usePlatformOS();
  const { getProjectById } = useProject();
  const { areEstimateEnabledByProjectId, currentActiveEstimateIdByProjectId, estimates } = useProjectEstimates();
  const projectDetails = issue.project_id ? getProjectById(issue.project_id) : undefined;
  const activeEstimateId =
    projectDetails?.estimate ?? (issue.project_id ? currentActiveEstimateIdByProjectId(issue.project_id) : undefined);
  const { estimatePointById } = useEstimate(activeEstimateId ?? undefined);

  const estimatePointId = issue.estimate_point ?? undefined;
  const selectedEstimate = estimatePointId
    ? (estimatePointById?.(estimatePointId) ??
      Object.values(estimates ?? {})
        .map((estimate) => estimate.estimatePointById?.(estimatePointId))
        .find(Boolean))
    : undefined;
  const estimateDisplayValue = selectedEstimate?.value;
  const hasEstimateValue = Boolean(estimatePointId);

  const showAssignee = Boolean(displayProperties?.assignee && issue.project_id);
  const showEstimate =
    Boolean(displayProperties?.estimate && issue.project_id) &&
    Boolean(issue.project_id && areEstimateEnabledByProjectId(issue.project_id));

  if (!showAssignee && !showEstimate) return null;

  const handleEstimate = async (value: string | undefined) => {
    if (updateIssue) await updateIssue(issue.project_id, issue.id, { estimate_point: value });
  };

  const handleAssignee = async (ids: string[]) => {
    if (updateIssue) await updateIssue(issue.project_id, issue.id, { assignee_ids: ids });
  };

  // oxlint-disable-next-line unicorn/consistent-function-scoping
  const stopPropagation = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };

  return (
    // oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions
    <div className="mt-1.5 flex items-center gap-2" onFocus={stopPropagation} onClick={stopPropagation}>
      {showAssignee && issue.project_id && (
        <div className="min-w-0 shrink">
          <MemberDropdown
            projectId={issue.project_id}
            value={issue.assignee_ids}
            onChange={handleAssignee}
            disabled={isReadOnly}
            multiple
            buttonVariant={issue.assignee_ids?.length > 0 ? "transparent-without-text" : "border-without-text"}
            buttonClassName={issue.assignee_ids?.length > 0 ? "hover:bg-transparent px-0" : ""}
            showTooltip={issue.assignee_ids?.length === 0}
            placeholder={t("common.assignees")}
            tooltipContent=""
            renderByDefault={isMobile}
          />
        </div>
      )}

      {showEstimate && issue.project_id && (
        <div className="ml-auto shrink-0">
          <EstimateDropdown
            value={estimatePointId}
            onChange={handleEstimate}
            projectId={issue.project_id}
            disabled={isReadOnly}
            buttonVariant="transparent-without-text"
            button={
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-subtle px-1.5 text-11 font-semibold text-secondary">
                {estimateDisplayValue || (hasEstimateValue ? "…" : "–")}
              </span>
            }
          />
        </div>
      )}
    </div>
  );
});

const KanbanIssueDetailsBlock = observer(function KanbanIssueDetailsBlock(props: IssueDetailsBlockProps) {
  const {
    cardRef,
    issue,
    updateIssue,
    quickActions,
    isReadOnly,
    displayProperties,
    isEpic = false,
    isCompact = false,
  } = props;
  // refs
  const menuActionRef = useRef<HTMLDivElement | null>(null);
  // states
  const [isMenuActive, setIsMenuActive] = useState(false);
  // hooks
  const { isMobile } = usePlatformOS();
  const isStagedGateScrumban = useIsStagedGateScrumban(issue.project_id);
  const hierarchyLevel = getHierarchyLevel(issue);
  const isL4Card = isStagedGateScrumban && hierarchyLevel === HIERARCHY_LEVEL_SUB_TASK;
  // Scrumban pins assignee/estimate to the card footer instead of the properties row
  const showCardFooter = isStagedGateScrumban && Boolean(displayProperties?.assignee || displayProperties?.estimate);

  const customActionButton = (
    // oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions
    <div
      ref={menuActionRef}
      className={`flex h-full w-full cursor-pointer items-center rounded-sm p-1 text-placeholder hover:bg-layer-1 ${
        isMenuActive ? "bg-layer-1 text-primary" : "text-secondary"
      }`}
      onClick={() => setIsMenuActive(!isMenuActive)}
    >
      <MoreHorizontal className="h-3.5 w-3.5" />
    </div>
  );

  // oxlint-disable-next-line unicorn/consistent-function-scoping
  const handleEventPropagation = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };

  useOutsideClickDetector(menuActionRef, () => setIsMenuActive(false));

  return (
    <div className="relative">
      <div className={cn("relative", isStagedGateScrumban && "flex items-center gap-1.5 leading-none")}>
        {isStagedGateScrumban && <HierarchyTypeBadge issue={issue} disabled={isReadOnly} updateIssue={updateIssue} />}
        {issue.project_id && (
          <IssueIdentifier
            issueId={issue.id}
            projectId={issue.project_id}
            size="xs"
            variant="tertiary"
            displayProperties={displayProperties}
          />
        )}
        {/* oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions */}
        <div
          className={cn("absolute -top-1 right-0", {
            "hidden group-hover/kanban-block:block": !isMobile,
            "!block": isMenuActive,
          })}
          onClick={handleEventPropagation}
        >
          {quickActions({
            issue,
            parentRef: cardRef,
            customActionButton,
          })}
        </div>
      </div>

      <Tooltip tooltipContent={issue.name} isMobile={isMobile} renderByDefault={false}>
        <div
          className={cn(
            "w-full text-body-sm-medium text-primary",
            isL4Card ? "py-3 leading-5 break-words whitespace-normal" : "line-clamp-1"
          )}
        >
          <span>{isL4Card && issue.name.length > 100 ? `${issue.name.slice(0, 100)}…` : issue.name}</span>
        </div>
      </Tooltip>

      <IssueProperties
        className={cn(
          "flex flex-wrap items-center whitespace-nowrap text-tertiary",
          isCompact ? "gap-1.5 pt-1" : "gap-2 pt-1.5"
        )}
        issue={issue}
        displayProperties={displayProperties}
        activeLayout="Kanban"
        updateIssue={updateIssue}
        isReadOnly={isReadOnly}
        isEpic={isEpic}
      />

      {showCardFooter && (
        <KanbanCardFooter
          issue={issue}
          displayProperties={displayProperties}
          updateIssue={updateIssue}
          isReadOnly={isReadOnly}
        />
      )}
    </div>
  );
});

export const KanbanIssueBlock = observer(function KanbanIssueBlock(props: IssueBlockProps) {
  const {
    issueId,
    groupId,
    subGroupId,
    issuesMap,
    displayProperties,
    canDropOverIssue,
    canDragIssuesInCurrentGrouping,
    updateIssue,
    quickActions,
    canEditProperties,
    scrollableContainerRef,
    shouldRenderByDefault,
    isEpic = false,
  } = props;

  const cardRef = useRef<HTMLAnchorElement | null>(null);
  // router
  const { workspaceSlug: routerWorkspaceSlug } = useParams();
  const workspaceSlug = routerWorkspaceSlug?.toString();
  // hooks
  const storeType = useIssueStoreType();
  const isStagedGateScrumban = useIsStagedGateScrumban(issuesMap[issueId]?.project_id);
  const isCompact = isStagedGateScrumban && storeType === EIssuesStoreType.CYCLE;
  const { getProjectIdentifierById } = useProject();
  const { getIsIssuePeeked } = useIssueDetail(isEpic ? EIssueServiceType.EPICS : EIssueServiceType.ISSUES);
  const { handleRedirection } = useIssuePeekOverviewRedirection(isEpic);
  const { isMobile } = usePlatformOS();

  // handlers
  const handleIssuePeekOverview = (issue: TIssue) => handleRedirection(workspaceSlug, issue, isMobile);

  const issue = issuesMap[issueId];

  const { setIsDragging: setIsKanbanDragging } = useKanbanView();

  const [isDraggingOverBlock, setIsDraggingOverBlock] = useState(false);
  const [isCurrentBlockDragging, setIsCurrentBlockDragging] = useState(false);

  const canEditIssueProperties = canEditProperties(issue?.project_id ?? undefined);

  const isDragAllowed = canDragIssuesInCurrentGrouping && !issue?.tempId && canEditIssueProperties;
  const projectIdentifier = getProjectIdentifierById(issue?.project_id);

  const workItemLink = generateWorkItemLink({
    workspaceSlug,
    projectId: issue?.project_id,
    issueId,
    projectIdentifier,
    sequenceId: issue?.sequence_id,
    isEpic,
    isArchived: !!issue?.archived_at,
  });

  useOutsideClickDetector(cardRef, () => {
    cardRef?.current?.classList?.remove(HIGHLIGHT_CLASS);
  });

  // Make Issue block both as as Draggable and,
  // as a DropTarget for other issues being dragged to get the location of drop
  useEffect(() => {
    const element = cardRef.current;

    if (!element) return;

    return combine(
      draggable({
        element,
        dragHandle: element,
        canDrag: () => isDragAllowed,
        getInitialData: () => ({ id: issue?.id, type: "ISSUE" }),
        onDragStart: () => {
          setIsCurrentBlockDragging(true);
          setIsKanbanDragging(true);
        },
        onDrop: () => {
          setIsKanbanDragging(false);
          setIsCurrentBlockDragging(false);
        },
      }),
      dropTargetForElements({
        element,
        canDrop: ({ source }) => source?.data?.id !== issue?.id && canDropOverIssue,
        getData: () => ({ id: issue?.id, type: "ISSUE" }),
        onDragEnter: () => {
          setIsDraggingOverBlock(true);
        },
        onDragLeave: () => {
          setIsDraggingOverBlock(false);
        },
        onDrop: () => {
          setIsDraggingOverBlock(false);
        },
      })
    );
    // oxlint-disable-next-line eslint-plugin-react-hooks/exhaustive-deps
  }, [cardRef?.current, issue?.id, isDragAllowed, canDropOverIssue, setIsCurrentBlockDragging, setIsDraggingOverBlock]);

  if (!issue) return null;

  const shouldHighlightCycleDoneCard = isCompact && isFullyDoneL3ForCycleHighlight(issue, issuesMap);

  return (
    <div className={cn("min-w-0", !isStagedGateScrumban && (isCompact ? "mb-1.5" : "mb-2"))}>
      <DropIndicator isVisible={!isCurrentBlockDragging && isDraggingOverBlock} />
      <div
        id={`issue-${issueId}`}
        // make Z-index higher at the beginning of drag, to have a issue drag image of issue block without any overlaps
        className={cn("group/kanban-block relative", {
          "z-[1]": isCurrentBlockDragging,
        })}
        onDragStart={() => {
          if (isDragAllowed) setIsCurrentBlockDragging(true);
          else {
            setToast({
              type: TOAST_TYPE.WARNING,
              title: "Cannot move work item",
              message: !canEditIssueProperties
                ? "You are not allowed to move this work item"
                : "Drag and drop is disabled for the current grouping",
            });
          }
        }}
      >
        <ControlLink
          id={getIssueBlockId(issueId, groupId, subGroupId)}
          href={workItemLink}
          ref={cardRef}
          className={cn(
            "block w-full rounded-lg border border-subtle bg-layer-2 text-13 shadow-raised-100 outline-[0.5px] outline-transparent transition-all hover:border-strong hover:shadow-raised-200",
            isCompact ? "p-2" : "p-3",
            { "hover:cursor-pointer": isDragAllowed },
            { "border border-accent-strong hover:border-accent-strong": getIsIssuePeeked(issue.id) },
            { "z-[100] bg-layer-1": isCurrentBlockDragging },
            {
              "border-success-subtle bg-success-subtle hover:border-success-strong": shouldHighlightCycleDoneCard,
            }
          )}
          onClick={() => handleIssuePeekOverview(issue)}
          disabled={!!issue?.tempId}
        >
          <RenderIfVisible
            classNames={isCompact ? "space-y-1.5" : "space-y-2"}
            root={scrollableContainerRef}
            defaultHeight={isCompact ? "80px" : "100px"}
            horizontalOffset={100}
            verticalOffset={200}
            defaultValue={shouldRenderByDefault}
          >
            <KanbanIssueDetailsBlock
              cardRef={cardRef}
              issue={issue}
              displayProperties={displayProperties}
              updateIssue={updateIssue}
              quickActions={quickActions}
              isReadOnly={!canEditIssueProperties || !!issue?.tempId}
              isEpic={isEpic}
              isCompact={isCompact}
            />
          </RenderIfVisible>
        </ControlLink>
      </div>
    </div>
  );
});
