/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import type { SyntheticEvent } from "react";
import { useMemo } from "react";
import { observer } from "mobx-react";
import { isStagedGateScrumbanMode } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { StartDatePropertyIcon, DueDatePropertyIcon } from "@plane/propel/icons";
import type { IIssueDisplayProperties, TIssue } from "@plane/types";
import { EIssuesStoreType, HIERARCHY_LEVEL_SUB_TASK } from "@plane/types";
import { getDate, renderFormattedPayloadDate, shouldHighlightIssueDueDate } from "@plane/utils";
// components
import { CycleDropdown } from "@/components/dropdowns/cycle";
import { DateDropdown } from "@/components/dropdowns/date";
import { DateRangeDropdown } from "@/components/dropdowns/date-range";
import { EstimateDropdown } from "@/components/dropdowns/estimate";
import { MemberDropdown } from "@/components/dropdowns/member/dropdown";
import { PriorityDropdown } from "@/components/dropdowns/priority";
import { StateDropdown } from "@/components/dropdowns/state/dropdown";
import { filterStateIdsForL4 } from "@/components/issues/hierarchy-status";
import {
  canEditCycle,
  getHierarchyLevel,
  shouldShowCycleProperty,
} from "@/components/issues/issue-detail-widgets/sub-issues/depth";
// hooks
import { WithDisplayPropertiesHOC } from "@/components/issues/issue-layouts/properties/with-display-properties-HOC";
import { useProjectEstimates } from "@/hooks/store/estimates";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useIssues } from "@/hooks/store/use-issues";
import { useProject } from "@/hooks/store/use-project";
import { useProjectHierarchyType } from "@/hooks/store/use-project-hierarchy-type";
import { useProjectState } from "@/hooks/store/use-project-state";

type Props = {
  workspaceSlug: string;
  parentIssueId: string;
  issueId: string;
  canEdit: boolean;
  updateSubIssue: (
    workspaceSlug: string,
    projectId: string,
    parentIssueId: string,
    issueId: string,
    issueData: Partial<TIssue>,
    oldIssue?: Partial<TIssue>
  ) => Promise<void>;
  displayProperties?: IIssueDisplayProperties;
  issue: TIssue;
};

const handleEventPropagation = (e: SyntheticEvent<HTMLDivElement>) => {
  e.stopPropagation();
  e.preventDefault();
};

export const SubIssuesListItemProperties = observer(function SubIssuesListItemProperties(props: Props) {
  const { workspaceSlug, parentIssueId, issueId, canEdit, updateSubIssue, displayProperties, issue } = props;
  const { t } = useTranslation();
  const { getStateById, getProjectStateIds } = useProjectState();
  const { getProjectById } = useProject();
  const { getCategoryById } = useProjectHierarchyType();
  const { areEstimateEnabledByProjectId } = useProjectEstimates();
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  const {
    issues: { addCycleToIssue, removeCycleFromIssue },
  } = useIssues(EIssuesStoreType.PROJECT);

  const handleStartDate = (date: Date | null) => {
    if (issue.project_id) {
      updateSubIssue(workspaceSlug, issue.project_id, parentIssueId, issueId, {
        start_date: date ? renderFormattedPayloadDate(date) : null,
      });
    }
  };

  const handleTargetDate = (date: Date | null) => {
    if (issue.project_id) {
      updateSubIssue(workspaceSlug, issue.project_id, parentIssueId, issueId, {
        target_date: date ? renderFormattedPayloadDate(date) : null,
      });
    }
  };

  //derived values
  const stateDetails = useMemo(() => getStateById(issue.state_id), [getStateById, issue.state_id]);
  const shouldHighlight = useMemo(
    () => shouldHighlightIssueDueDate(issue.target_date, stateDetails?.group),
    [issue.target_date, stateDetails?.group]
  );
  // date range is enabled only when both dates are available and both dates are enabled
  const isDateRangeEnabled: boolean = Boolean(
    issue.start_date && issue.target_date && displayProperties?.start_date && displayProperties?.due_date
  );

  const projectDetails = issue.project_id ? getProjectById(issue.project_id) : undefined;
  const isStagedGateScrumban = isStagedGateScrumbanMode(projectDetails?.workflow_mode);
  const hierarchyLevel = getHierarchyLevel(issue);
  const hierarchyType = getCategoryById(issue.hierarchy_type_id ?? "");
  const isL4 = isStagedGateScrumban && hierarchyLevel === HIERARCHY_LEVEL_SUB_TASK;
  const projectStateIds = getProjectStateIds(issue.project_id ?? undefined) ?? [];
  const eligibleStateIds = isL4
    ? filterStateIdsForL4(projectStateIds, getStateById, hierarchyType?.name)
    : projectStateIds;
  const parentIssue = issue.parent_id ? getIssueById(issue.parent_id) : undefined;
  // L3 uses its own cycle; L4 inherits from parent when missing
  const cycleId = canEditCycle(hierarchyLevel)
    ? (issue.cycle_id ?? null)
    : (issue.cycle_id ?? parentIssue?.cycle_id ?? null);
  // Scrumban surfaces cycle on every L3/L4 row; classic sub-item rows have no cycle column
  const showCycle =
    isStagedGateScrumban && Boolean(projectDetails?.cycle_view) && shouldShowCycleProperty(hierarchyLevel);
  const cycleEditable = canEdit && canEditCycle(hierarchyLevel);

  const handleCycleChange = async (nextCycleId: string | null) => {
    if (!cycleEditable || !issue.project_id || issue.cycle_id === nextCycleId) return;
    if (nextCycleId) {
      await addCycleToIssue(workspaceSlug, issue.project_id, nextCycleId, issue.id);
    } else {
      await removeCycleFromIssue(workspaceSlug, issue.project_id, issue.id);
    }
  };

  if (!displayProperties) return <></>;

  const maxDate = getDate(issue.target_date);
  const minDate = getDate(issue.start_date);

  return (
    <div className="relative flex items-center gap-2">
      <WithDisplayPropertiesHOC displayProperties={displayProperties} displayPropertyKey="state">
        <div className="h-5 flex-shrink-0">
          <StateDropdown
            value={issue.state_id}
            projectId={issue.project_id ?? undefined}
            onChange={(val) =>
              issue.project_id &&
              updateSubIssue(
                workspaceSlug,
                issue.project_id,
                parentIssueId,
                issueId,
                {
                  state_id: val,
                },
                { ...issue }
              )
            }
            disabled={!canEdit}
            buttonVariant="transparent-without-text"
            buttonClassName="hover:bg-transparent px-0"
            iconSize="size-5"
            showTooltip
            stateIds={isL4 ? eligibleStateIds : undefined}
          />
        </div>
      </WithDisplayPropertiesHOC>

      <WithDisplayPropertiesHOC displayProperties={displayProperties} displayPropertyKey="priority">
        <div className="h-5 flex-shrink-0">
          <PriorityDropdown
            value={issue.priority}
            onChange={(val) =>
              issue.project_id &&
              updateSubIssue(workspaceSlug, issue.project_id, parentIssueId, issueId, {
                priority: val,
              })
            }
            disabled={!canEdit}
            buttonVariant="border-without-text"
            showTooltip
          />
        </div>
      </WithDisplayPropertiesHOC>

      {/* merged dates */}
      <WithDisplayPropertiesHOC
        displayProperties={displayProperties}
        displayPropertyKey={["start_date", "due_date"]}
        shouldRenderProperty={() => isDateRangeEnabled}
      >
        {/* oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions */}
        <div className="h-5" onFocus={handleEventPropagation} onClick={handleEventPropagation}>
          <DateRangeDropdown
            value={{
              from: getDate(issue.start_date) || undefined,
              to: getDate(issue.target_date) || undefined,
            }}
            placement="top-end"
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
            buttonClassName={shouldHighlight ? "text-danger-primary" : ""}
            disabled={!canEdit}
            showTooltip
            customTooltipHeading="Date Range"
            renderPlaceholder={false}
            renderInPortal
          />
        </div>
      </WithDisplayPropertiesHOC>

      {/* start date */}
      <WithDisplayPropertiesHOC
        displayProperties={displayProperties}
        displayPropertyKey="start_date"
        shouldRenderProperty={() => !isDateRangeEnabled}
      >
        <div className="h-5">
          <DateDropdown
            value={issue.start_date ?? null}
            onChange={handleStartDate}
            maxDate={maxDate}
            placeholder={t("common.order_by.start_date")}
            icon={<StartDatePropertyIcon className="h-3 w-3 flex-shrink-0" />}
            buttonVariant={issue.start_date ? "border-with-text" : "border-without-text"}
            optionsClassName="z-30"
            disabled={!canEdit}
            showTooltip
          />
        </div>
      </WithDisplayPropertiesHOC>

      {/* target/due date */}
      <WithDisplayPropertiesHOC
        displayProperties={displayProperties}
        displayPropertyKey="due_date"
        shouldRenderProperty={() => !isDateRangeEnabled}
      >
        <div className="h-5">
          <DateDropdown
            value={issue?.target_date ?? null}
            onChange={handleTargetDate}
            minDate={minDate}
            placeholder={t("common.order_by.due_date")}
            icon={<DueDatePropertyIcon className="h-3 w-3 flex-shrink-0" />}
            buttonVariant={issue.target_date ? "border-with-text" : "border-without-text"}
            buttonClassName={shouldHighlight ? "text-danger-primary" : ""}
            clearIconClassName="text-primary"
            optionsClassName="z-30"
            disabled={!canEdit}
            showTooltip
          />
        </div>
      </WithDisplayPropertiesHOC>

      <WithDisplayPropertiesHOC displayProperties={displayProperties} displayPropertyKey="assignee">
        <div className="h-5 flex-shrink-0">
          <MemberDropdown
            value={issue.assignee_ids}
            projectId={issue.project_id ?? undefined}
            onChange={(val) =>
              issue.project_id &&
              updateSubIssue(workspaceSlug, issue.project_id, parentIssueId, issueId, {
                assignee_ids: val,
              })
            }
            disabled={!canEdit}
            multiple
            buttonVariant={(issue?.assignee_ids || []).length > 0 ? "transparent-without-text" : "border-without-text"}
            buttonClassName={(issue?.assignee_ids || []).length > 0 ? "hover:bg-transparent px-0" : ""}
          />
        </div>
      </WithDisplayPropertiesHOC>

      {issue.project_id && areEstimateEnabledByProjectId(issue.project_id) && (
        <WithDisplayPropertiesHOC displayProperties={displayProperties} displayPropertyKey="estimate">
          {/* oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions */}
          <div className="h-5 flex-shrink-0" onFocus={handleEventPropagation} onClick={handleEventPropagation}>
            <EstimateDropdown
              value={issue.estimate_point ?? undefined}
              onChange={(val) =>
                issue.project_id &&
                updateSubIssue(workspaceSlug, issue.project_id, parentIssueId, issueId, {
                  estimate_point: val,
                })
              }
              projectId={issue.project_id}
              disabled={!canEdit}
              buttonVariant="border-with-text"
              showTooltip
            />
          </div>
        </WithDisplayPropertiesHOC>
      )}

      {showCycle && (
        <>
          {/* oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions */}
          <div className="h-5 flex-shrink-0" onFocus={handleEventPropagation} onClick={handleEventPropagation}>
            <CycleDropdown
              projectId={issue.project_id ?? undefined}
              value={cycleId}
              onChange={(nextCycleId) => void handleCycleChange(nextCycleId)}
              disabled={!cycleEditable}
              buttonVariant="border-without-text"
              buttonClassName="h-5"
              placeholder={t("cycle.label", { count: 1 })}
              nameMaxLength={7}
              showTooltip
            />
          </div>
        </>
      )}
    </div>
  );
});
