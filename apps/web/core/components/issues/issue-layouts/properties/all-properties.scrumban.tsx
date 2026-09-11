/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { SyntheticEvent } from "react";
import { useCallback, useMemo } from "react";
import { xor } from "lodash-es";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// icons
import { Paperclip } from "lucide-react";
// i18n
import { useTranslation } from "@plane/i18n";
import { LinkIcon, StartDatePropertyIcon, ViewsIcon, DueDatePropertyIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Tooltip } from "@plane/propel/tooltip";
import type { TIssue, IIssueDisplayProperties, TIssuePriorities, TDeliveryProgressStatus } from "@plane/types";
import { HIERARCHY_LEVEL_DELIVERY, HIERARCHY_LEVEL_SUB_TASK } from "@plane/types";
// ui
import {
  cn,
  getDate,
  renderFormattedPayloadDate,
  generateWorkItemLink,
  shouldHighlightIssueDueDate,
} from "@plane/utils";
// components
import { CycleDropdown } from "@/components/dropdowns/cycle";
import { ModuleDropdown } from "@/components/dropdowns/module/dropdown";
import { DateDropdown } from "@/components/dropdowns/date";
import { DateRangeDropdown } from "@/components/dropdowns/date-range";
import { EstimateDropdown } from "@/components/dropdowns/estimate";
import { MemberDropdown } from "@/components/dropdowns/member/dropdown";
import { PriorityDropdown } from "@/components/dropdowns/priority";
import { ProgressStatusDropdown } from "@/components/dropdowns/progress-status";
import { StateDropdown } from "@/components/dropdowns/state/dropdown";
import {
  canEditCycle,
  getHierarchyLevel,
  shouldShowCycleProperty,
} from "@/components/issues/issue-detail-widgets/sub-issues/depth";
import { filterStateIdsForL4, getL4LeaveTodoRequirementError } from "@/components/issues/hierarchy-status";
import { useProjectHierarchyType } from "@/hooks/store/use-project-hierarchy-type";
// hooks
import { useProjectEstimates } from "@/hooks/store/estimates";
import { useIssues } from "@/hooks/store/use-issues";
import { useLabel } from "@/hooks/store/use-label";
import { useProject } from "@/hooks/store/use-project";
import { useProjectState } from "@/hooks/store/use-project-state";
import { useAppRouter } from "@/hooks/use-app-router";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
import { usePlatformOS } from "@/hooks/use-platform-os";
// local components
import { IssuePropertyLabels } from "./labels";
import { WithDisplayPropertiesHOC } from "./with-display-properties-HOC";

export interface IIssueProperties {
  issue: TIssue;
  updateIssue: ((projectId: string | null, issueId: string, data: Partial<TIssue>) => Promise<void>) | undefined;
  displayProperties: IIssueDisplayProperties | undefined;
  isReadOnly: boolean;
  className: string;
  activeLayout: string;
  isEpic?: boolean;
}

export const ScrumbanIssueProperties = observer(function ScrumbanIssueProperties(props: IIssueProperties) {
  const { issue, updateIssue, displayProperties, isReadOnly, className, activeLayout, isEpic = false } = props;
  // i18n
  const { t } = useTranslation();
  // store hooks
  const { getProjectById } = useProject();
  const { labelMap } = useLabel();
  const storeType = useIssueStoreType();
  const {
    issues: { changeModulesInIssue, addCycleToIssue, removeCycleFromIssue },
  } = useIssues(storeType);
  const { areEstimateEnabledByProjectId } = useProjectEstimates();
  const { getStateById, getProjectStateIds } = useProjectState();
  const { getCategoryById } = useProjectHierarchyType();
  const { isMobile } = usePlatformOS();
  const projectDetails = getProjectById(issue.project_id);

  // router
  const router = useAppRouter();
  const { workspaceSlug, projectId } = useParams();

  // derived values
  const stateDetails = getStateById(issue.state_id);
  const subIssueCount = issue?.sub_issues_count ?? 0;
  const hierarchyLevel = getHierarchyLevel(issue);
  const isL3 = hierarchyLevel === HIERARCHY_LEVEL_DELIVERY;
  const isL4 = hierarchyLevel === HIERARCHY_LEVEL_SUB_TASK;
  const hierarchyType = getCategoryById(issue.hierarchy_type_id ?? "");
  const projectStateIds = getProjectStateIds(issue.project_id ?? undefined) ?? [];
  const l4StateIds = isL4 ? filterStateIdsForL4(projectStateIds, getStateById, hierarchyType?.name) : projectStateIds;
  // Board L4 cards: hide start/due dates and cycle to keep swimlane cards compact
  const hideBoardSubTaskMeta = activeLayout === "Kanban" && hierarchyLevel === HIERARCHY_LEVEL_SUB_TASK;
  const showCycle = projectDetails?.cycle_view && shouldShowCycleProperty(hierarchyLevel) && !hideBoardSubTaskMeta;
  const cycleReadOnly = isReadOnly || !canEditCycle(hierarchyLevel);

  const issueOperations = useMemo(
    () => ({
      addModulesToIssue: async (moduleIds: string[]) => {
        if (!workspaceSlug || !issue.project_id || !issue.id) return;
        await changeModulesInIssue?.(workspaceSlug.toString(), issue.project_id, issue.id, moduleIds, []);
      },
      removeModulesFromIssue: async (moduleIds: string[]) => {
        if (!workspaceSlug || !issue.project_id || !issue.id) return;
        await changeModulesInIssue?.(workspaceSlug.toString(), issue.project_id, issue.id, [], moduleIds);
      },
      addIssueToCycle: async (cycleId: string) => {
        if (!workspaceSlug || !issue.project_id || !issue.id) return;
        await addCycleToIssue?.(workspaceSlug.toString(), issue.project_id, cycleId, issue.id);
      },
      removeIssueFromCycle: async () => {
        if (!workspaceSlug || !issue.project_id || !issue.id) return;
        await removeCycleFromIssue?.(workspaceSlug.toString(), issue.project_id, issue.id);
      },
    }),
    [workspaceSlug, issue, changeModulesInIssue, addCycleToIssue, removeCycleFromIssue]
  );

  const handleState = async (stateId: string) => {
    const leaveTodoError = getL4LeaveTodoRequirementError({
      hierarchyLevel,
      hierarchyTypeName: hierarchyType?.name,
      currentStateExternalId: stateDetails?.external_id,
      nextStateExternalId: getStateById(stateId)?.external_id,
      currentStateId: issue.state_id,
      nextStateId: stateId,
      assigneeIds: issue.assignee_ids,
      estimatePoint: issue.estimate_point ?? null,
    });
    if (leaveTodoError) {
      setToast({
        type: TOAST_TYPE.WARNING,
        title: "Cannot change status",
        message: leaveTodoError,
      });
      return;
    }
    if (updateIssue) await updateIssue(issue.project_id, issue.id, { state_id: stateId });
  };

  const handleProgress = async (value: TDeliveryProgressStatus) => {
    if (updateIssue) await updateIssue(issue.project_id, issue.id, { progress_status: value });
  };

  const handlePriority = async (value: TIssuePriorities) => {
    if (updateIssue) await updateIssue(issue.project_id, issue.id, { priority: value });
  };

  const handleLabel = async (ids: string[]) => {
    if (updateIssue) await updateIssue(issue.project_id, issue.id, { label_ids: ids });
  };

  const handleAssignee = async (ids: string[]) => {
    if (updateIssue) await updateIssue(issue.project_id, issue.id, { assignee_ids: ids });
  };

  const handleModule = useCallback(
    (moduleIds: string[] | null) => {
      if (!issue || !issue.module_ids || !moduleIds) return;

      const updatedModuleIds = xor(issue.module_ids, moduleIds);
      const modulesToAdd: string[] = [];
      const modulesToRemove: string[] = [];
      for (const moduleId of updatedModuleIds)
        if (issue.module_ids.includes(moduleId)) modulesToRemove.push(moduleId);
        else modulesToAdd.push(moduleId);
      if (modulesToAdd.length > 0) issueOperations.addModulesToIssue(modulesToAdd);
      if (modulesToRemove.length > 0) issueOperations.removeModulesFromIssue(modulesToRemove);
    },
    [issueOperations, issue]
  );

  const handleCycle = useCallback(
    (cycleId: string | null) => {
      if (!issue || issue.cycle_id === cycleId) return;
      if (cycleId) issueOperations.addIssueToCycle?.(cycleId);
      else issueOperations.removeIssueFromCycle?.();
    },
    [issue, issueOperations]
  );

  const handleStartDate = async (date: Date | null) => {
    if (updateIssue)
      await updateIssue(issue.project_id, issue.id, { start_date: date ? renderFormattedPayloadDate(date) : null });
  };

  const handleTargetDate = async (date: Date | null) => {
    if (updateIssue)
      await updateIssue(issue.project_id, issue.id, { target_date: date ? renderFormattedPayloadDate(date) : null });
  };

  const handleEstimate = async (value: string | undefined) => {
    if (updateIssue) await updateIssue(issue.project_id, issue.id, { estimate_point: value });
  };

  const workItemLink = generateWorkItemLink({
    workspaceSlug: workspaceSlug?.toString(),
    projectId: issue?.project_id,
    issueId: issue?.id,
    projectIdentifier: projectDetails?.identifier,
    sequenceId: issue?.sequence_id,
    isArchived: !!issue?.archived_at,
    isEpic,
  });

  const redirectToIssueDetail = () => router.push(`${workItemLink}#sub-issues`);

  if (!displayProperties || !issue.project_id) return null;

  // date range is enabled only when both dates are available and both dates are enabled
  const isDateRangeEnabled: boolean = Boolean(
    issue.start_date && issue.target_date && displayProperties.start_date && displayProperties.due_date
  );

  const defaultLabelOptions =
    issue?.label_ids?.flatMap((id) => {
      const label = labelMap[id];
      return label ? [label] : [];
    }) || [];

  const minDate = getDate(issue.start_date);
  const maxDate = getDate(issue.target_date);

  // oxlint-disable-next-line unicorn/consistent-function-scoping
  const handleEventPropagation = (e: SyntheticEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
  };

  return (
    <div className={className}>
      {/* state / L3 progress */}
      <WithDisplayPropertiesHOC displayProperties={displayProperties} displayPropertyKey="state">
        {/* oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions */}
        <div className="h-5" onFocus={handleEventPropagation} onClick={handleEventPropagation}>
          {isL3 ? (
            <ProgressStatusDropdown
              value={issue.progress_status}
              onChange={handleProgress}
              projectId={issue.project_id}
              disabled={isReadOnly}
              buttonVariant="border-with-text"
              buttonContainerClassName="truncate max-w-48"
              className="h-5 max-w-48"
              showTooltip
            />
          ) : (
            <StateDropdown
              buttonContainerClassName="truncate max-w-40"
              value={issue.state_id}
              onChange={handleState}
              projectId={issue.project_id}
              disabled={isReadOnly}
              buttonVariant="border-with-text"
              renderByDefault={isMobile}
              showTooltip
              stateIds={isL4 ? l4StateIds : undefined}
            />
          )}
        </div>
      </WithDisplayPropertiesHOC>

      {/* priority */}
      <WithDisplayPropertiesHOC displayProperties={displayProperties} displayPropertyKey="priority">
        {/* oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions */}
        <div className="h-5" onFocus={handleEventPropagation} onClick={handleEventPropagation}>
          <PriorityDropdown
            value={issue?.priority}
            onChange={handlePriority}
            disabled={isReadOnly}
            buttonVariant="border-without-text"
            renderByDefault={isMobile}
            showTooltip
          />
        </div>
      </WithDisplayPropertiesHOC>

      {/* merged dates */}
      <WithDisplayPropertiesHOC
        displayProperties={displayProperties}
        displayPropertyKey={["start_date", "due_date"]}
        shouldRenderProperty={() => isDateRangeEnabled && !hideBoardSubTaskMeta}
      >
        {/* oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions */}
        <div className="h-5" onFocus={handleEventPropagation} onClick={handleEventPropagation}>
          <DateRangeDropdown
            value={{
              from: getDate(issue.start_date) || undefined,
              to: getDate(issue.target_date) || undefined,
            }}
            onSelect={(range) => {
              handleStartDate(range?.from ?? null);
              handleTargetDate(range?.to ?? null);
            }}
            hideIcon={{
              from: false,
            }}
            isClearable
            mergeDates
            buttonVariant={issue.start_date || issue.target_date ? "border-with-text" : "border-without-text"}
            buttonClassName={
              shouldHighlightIssueDueDate(issue.target_date, stateDetails?.group) ? "text-danger-primary" : ""
            }
            clearIconClassName="text-primary!"
            disabled={isReadOnly}
            renderByDefault={isMobile}
            showTooltip
            renderPlaceholder={false}
            customTooltipHeading="Date Range"
          />
        </div>
      </WithDisplayPropertiesHOC>

      {/* start date */}
      <WithDisplayPropertiesHOC
        displayProperties={displayProperties}
        displayPropertyKey="start_date"
        shouldRenderProperty={() => !isDateRangeEnabled && !hideBoardSubTaskMeta}
      >
        {/* oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions */}
        <div className="h-5" onFocus={handleEventPropagation} onClick={handleEventPropagation}>
          <DateDropdown
            value={issue.start_date ?? null}
            onChange={handleStartDate}
            maxDate={maxDate}
            placeholder={t("common.order_by.start_date")}
            icon={<StartDatePropertyIcon className="h-3 w-3 flex-shrink-0" />}
            buttonVariant={issue.start_date ? "border-with-text" : "border-without-text"}
            optionsClassName="z-10"
            disabled={isReadOnly}
            renderByDefault={isMobile}
            showTooltip
            labelClassName="text-caption-sm-regular"
          />
        </div>
      </WithDisplayPropertiesHOC>

      {/* target/due date */}
      <WithDisplayPropertiesHOC
        displayProperties={displayProperties}
        displayPropertyKey="due_date"
        shouldRenderProperty={() => !isDateRangeEnabled && !hideBoardSubTaskMeta}
      >
        {/* oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions */}
        <div className="h-5" onFocus={handleEventPropagation} onClick={handleEventPropagation}>
          <DateDropdown
            value={issue?.target_date ?? null}
            onChange={handleTargetDate}
            minDate={minDate}
            placeholder={t("common.order_by.due_date")}
            icon={<DueDatePropertyIcon className="h-3 w-3 shrink-0" />}
            buttonVariant={issue.target_date ? "border-with-text" : "border-without-text"}
            buttonClassName={
              shouldHighlightIssueDueDate(issue.target_date, stateDetails?.group) ? "text-danger-primary" : ""
            }
            clearIconClassName="text-primary!"
            optionsClassName="z-10"
            disabled={isReadOnly}
            renderByDefault={isMobile}
            showTooltip
            labelClassName="text-caption-sm-regular"
          />
        </div>
      </WithDisplayPropertiesHOC>

      {/* assignee — list renders after labels; board uses card footer */}
      {activeLayout !== "Kanban" && activeLayout !== "List" && (
        <WithDisplayPropertiesHOC displayProperties={displayProperties} displayPropertyKey="assignee">
          {/* oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions */}
          <div className="h-5" onFocus={handleEventPropagation} onClick={handleEventPropagation}>
            <MemberDropdown
              projectId={issue?.project_id}
              value={issue?.assignee_ids}
              onChange={handleAssignee}
              disabled={isReadOnly}
              multiple
              buttonVariant={issue.assignee_ids?.length > 0 ? "transparent-without-text" : "border-without-text"}
              buttonClassName={issue.assignee_ids?.length > 0 ? "hover:bg-transparent px-0" : ""}
              showTooltip={issue?.assignee_ids?.length === 0}
              placeholder={t("common.assignees")}
              optionsClassName="z-10"
              tooltipContent=""
              renderByDefault={isMobile}
            />
          </div>
        </WithDisplayPropertiesHOC>
      )}

      <>
        {!isEpic && (
          <>
            {projectDetails?.module_view && !hideBoardSubTaskMeta && (
              <WithDisplayPropertiesHOC displayProperties={displayProperties} displayPropertyKey="modules">
                {/* oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions */}
                <div className="h-5" onFocus={handleEventPropagation} onClick={handleEventPropagation}>
                  <ModuleDropdown
                    buttonContainerClassName="truncate max-w-40"
                    projectId={issue?.project_id}
                    value={issue?.module_ids ?? []}
                    onChange={handleModule}
                    disabled={isReadOnly}
                    renderByDefault={isMobile}
                    multiple
                    buttonVariant="border-with-text"
                    showCount
                    showTooltip
                  />
                </div>
              </WithDisplayPropertiesHOC>
            )}

            {/* cycles */}
            {showCycle && (
              <WithDisplayPropertiesHOC displayProperties={displayProperties} displayPropertyKey="cycle">
                {/* oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions */}
                <div className="h-5" onFocus={handleEventPropagation} onClick={handleEventPropagation}>
                  <CycleDropdown
                    buttonContainerClassName="truncate max-w-40"
                    projectId={issue?.project_id}
                    value={issue?.cycle_id}
                    onChange={handleCycle}
                    disabled={cycleReadOnly}
                    buttonVariant="border-with-text"
                    renderByDefault={isMobile}
                    showTooltip
                  />
                </div>
              </WithDisplayPropertiesHOC>
            )}
          </>
        )}
      </>

      {/* estimates — list renders after labels; board uses card footer */}
      {projectId &&
        areEstimateEnabledByProjectId(projectId?.toString()) &&
        activeLayout !== "Kanban" &&
        activeLayout !== "List" && (
          <WithDisplayPropertiesHOC displayProperties={displayProperties} displayPropertyKey="estimate">
            {/* oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions */}
            <div className="h-5" onFocus={handleEventPropagation} onClick={handleEventPropagation}>
              <EstimateDropdown
                value={issue.estimate_point ?? undefined}
                onChange={handleEstimate}
                projectId={issue.project_id}
                disabled={isReadOnly}
                buttonVariant="border-with-text"
                renderByDefault={isMobile}
                showTooltip
              />
            </div>
          </WithDisplayPropertiesHOC>
        )}

      {/* extra render properties */}
      {/* sub-issues */}
      {!isEpic && (
        <WithDisplayPropertiesHOC
          displayProperties={displayProperties}
          displayPropertyKey="sub_issue_count"
          shouldRenderProperty={(properties) => !!properties.sub_issue_count && !!subIssueCount}
        >
          <Tooltip
            tooltipHeading={t("common.sub_work_items")}
            tooltipContent={`${subIssueCount}`}
            isMobile={isMobile}
            renderByDefault={false}
          >
            {/* oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions */}
            <div
              onFocus={handleEventPropagation}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (subIssueCount) redirectToIssueDetail();
              }}
              className={cn(
                "flex h-5 flex-shrink-0 items-center justify-center gap-2 overflow-hidden rounded-sm border-[0.5px] border-strong px-2.5 py-1",
                {
                  "cursor-pointer hover:bg-layer-1": subIssueCount,
                }
              )}
            >
              <ViewsIcon className="h-3 w-3 flex-shrink-0" strokeWidth={2} />
              <div className="text-caption-sm-regular">{subIssueCount}</div>
            </div>
          </Tooltip>
        </WithDisplayPropertiesHOC>
      )}

      {/* attachments */}
      <WithDisplayPropertiesHOC
        displayProperties={displayProperties}
        displayPropertyKey="attachment_count"
        shouldRenderProperty={(properties) => !!properties.attachment_count && !!issue.attachment_count}
      >
        <Tooltip
          tooltipHeading={t("common.attachments")}
          tooltipContent={`${issue.attachment_count}`}
          isMobile={isMobile}
          renderByDefault={false}
        >
          {/* oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions */}
          <div
            className="flex h-5 flex-shrink-0 items-center justify-center gap-2 overflow-hidden rounded-sm border-[0.5px] border-strong px-2.5 py-1"
            onFocus={handleEventPropagation}
            onClick={handleEventPropagation}
          >
            <Paperclip className="h-3 w-3 flex-shrink-0" strokeWidth={2} />
            <div className="text-caption-sm-regular">{issue.attachment_count}</div>
          </div>
        </Tooltip>
      </WithDisplayPropertiesHOC>

      {/* link */}
      <WithDisplayPropertiesHOC
        displayProperties={displayProperties}
        displayPropertyKey="link"
        shouldRenderProperty={(properties) => !!properties.link && !!issue.link_count}
      >
        <Tooltip
          tooltipHeading={t("common.links")}
          tooltipContent={`${issue.link_count}`}
          isMobile={isMobile}
          renderByDefault={false}
        >
          {/* oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions */}
          <div
            className="flex h-5 flex-shrink-0 items-center justify-center gap-2 overflow-hidden rounded-sm border-[0.5px] border-strong px-2.5 py-1"
            onFocus={handleEventPropagation}
            onClick={handleEventPropagation}
          >
            <LinkIcon className="h-3 w-3 flex-shrink-0" strokeWidth={2} />
            <div className="text-caption-sm-regular">{issue.link_count}</div>
          </div>
        </Tooltip>
      </WithDisplayPropertiesHOC>

      {/* label */}
      <WithDisplayPropertiesHOC displayProperties={displayProperties} displayPropertyKey="labels">
        <IssuePropertyLabels
          projectId={issue?.project_id || null}
          value={issue?.label_ids || []}
          defaultOptions={defaultLabelOptions}
          onChange={handleLabel}
          disabled={isReadOnly}
          renderByDefault={isMobile}
          hideDropdownArrow
          maxRender={3}
        />
      </WithDisplayPropertiesHOC>

      {/* list: assignee + estimate rightmost after labels for easier scanning */}
      {activeLayout === "List" && (
        <>
          <WithDisplayPropertiesHOC displayProperties={displayProperties} displayPropertyKey="assignee">
            {/* oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions */}
            <div className="h-5" onFocus={handleEventPropagation} onClick={handleEventPropagation}>
              <MemberDropdown
                projectId={issue?.project_id}
                value={issue?.assignee_ids}
                onChange={handleAssignee}
                disabled={isReadOnly}
                multiple
                buttonVariant={issue.assignee_ids?.length > 0 ? "transparent-without-text" : "border-without-text"}
                buttonClassName={issue.assignee_ids?.length > 0 ? "hover:bg-transparent px-0" : ""}
                showTooltip={issue?.assignee_ids?.length === 0}
                placeholder={t("common.assignees")}
                optionsClassName="z-10"
                tooltipContent=""
                renderByDefault={isMobile}
              />
            </div>
          </WithDisplayPropertiesHOC>

          {projectId && areEstimateEnabledByProjectId(projectId?.toString()) && (
            <WithDisplayPropertiesHOC displayProperties={displayProperties} displayPropertyKey="estimate">
              {/* oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions */}
              <div className="h-5" onFocus={handleEventPropagation} onClick={handleEventPropagation}>
                <EstimateDropdown
                  value={issue.estimate_point ?? undefined}
                  onChange={handleEstimate}
                  projectId={issue.project_id}
                  disabled={isReadOnly}
                  buttonVariant="border-with-text"
                  renderByDefault={isMobile}
                  showTooltip
                />
              </div>
            </WithDisplayPropertiesHOC>
          )}
        </>
      )}
    </div>
  );
});
