/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react";
import { StatePropertyIcon } from "@plane/propel/icons";
import type { IWorkItemFilterInstance } from "@plane/shared-state";
import type { ICustomSearchSelectOption, TWorkItemFilterProperty } from "@plane/types";
import { COLLECTION_OPERATOR, HIERARCHY_LEVEL_SUB_TASK, LOGICAL_OPERATOR } from "@plane/types";
import { CustomSearchSelect } from "@plane/ui";
import { cn } from "@plane/utils";
import {
  L3_PROGRESS_PHASE_FALLBACK_COLORS,
  L3_PROGRESS_STATUS_OPTIONS,
  L4_BOARD_STATE_OPTIONS,
} from "@plane/constants";
import { MemberDropdown } from "@/components/dropdowns/member/dropdown";
import { GroupExpandCollapseControls } from "@/components/issues/issue-layouts/expand-collapse";
import { getL3ProgressStatusColor } from "@/components/issues/hierarchy-status";
import { useMember } from "@/hooks/store/use-member";
import { useProjectHierarchyType } from "@/hooks/store/use-project-hierarchy-type";
import { useProjectState } from "@/hooks/store/use-project-state";

type Props = {
  filter: IWorkItemFilterInstance;
  projectId: string;
};

type TStateFilterMode = "l3" | "l4";

const FILTER_BUTTON_CLASS_NAME =
  "h-8 rounded-md border border-subtle bg-surface-1 px-2.5 text-12 text-secondary hover:bg-surface-2";

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export const WorkItemPinnedFilters = observer(function WorkItemPinnedFilters(props: Props) {
  const { filter, projectId } = props;
  const { getProjectStates } = useProjectState();
  const {
    getUserDetails,
    project: { getProjectMemberIds },
  } = useMember();
  const { getActiveProjectTypes } = useProjectHierarchyType();

  const assigneeCondition = filter.findFirstConditionByPropertyAndOperator("assignee_id", COLLECTION_OPERATOR.IN);
  const l4StateCondition = filter.findFirstConditionByPropertyAndOperator("state_id", COLLECTION_OPERATOR.IN);
  const l3StatusCondition = filter.findFirstConditionByPropertyAndOperator("progress_status", COLLECTION_OPERATOR.IN);

  const [selectedMode, setSelectedMode] = useState<TStateFilterMode>(() =>
    toStringArray(l3StatusCondition?.value).length > 0 ? "l3" : "l4"
  );

  useEffect(() => {
    if (toStringArray(l3StatusCondition?.value).length > 0) {
      setSelectedMode("l3");
    }
  }, [l3StatusCondition?.value]);

  const projectTypes = useMemo(
    () => getActiveProjectTypes(projectId, HIERARCHY_LEVEL_SUB_TASK) ?? [],
    [getActiveProjectTypes, projectId]
  );
  const phaseColors = useMemo(() => {
    const colors = {
      design: L3_PROGRESS_PHASE_FALLBACK_COLORS.design ?? "#F97316",
      dev: L3_PROGRESS_PHASE_FALLBACK_COLORS.dev ?? "#3B82F6",
      qa: L3_PROGRESS_PHASE_FALLBACK_COLORS.qa ?? "#22C55E",
    };

    for (const type of projectTypes) {
      const key = (type.name ?? "").trim().toLowerCase();
      if (key === "design" || key === "dev" || key === "qa") {
        colors[key] = type.color || colors[key];
      }
    }

    return colors;
  }, [projectTypes]);

  const l4States = useMemo(() => {
    const orderMap = new Map<string, number>(L4_BOARD_STATE_OPTIONS.map((option, index) => [option.key, index]));
    return (getProjectStates(projectId) ?? [])
      .filter((state) => typeof state.external_id === "string" && orderMap.has(state.external_id))
      .toSorted((a, b) => (orderMap.get(a.external_id ?? "") ?? 0) - (orderMap.get(b.external_id ?? "") ?? 0));
  }, [getProjectStates, projectId]);

  const memberIds = useMemo(() => getProjectMemberIds(projectId, false) ?? [], [getProjectMemberIds, projectId]);
  const members = useMemo(
    () => memberIds.map((memberId) => getUserDetails(memberId)).filter(Boolean),
    [memberIds, getUserDetails]
  );

  const modeOptions: ICustomSearchSelectOption[] = [
    { value: "l4", query: "l4 state", content: "L4 State" },
    { value: "l3", query: "l3 status", content: "L3 Status" },
  ];

  const l4StateOptions: ICustomSearchSelectOption[] = l4States.map((state) => ({
    value: state.id,
    query: state.name.toLowerCase(),
    content: (
      <span className="flex items-center gap-2">
        <span className="size-2.5 rounded-full" style={{ backgroundColor: state.color }} aria-hidden />
        <span>{state.name}</span>
      </span>
    ),
  }));

  const l3StatusOptions: ICustomSearchSelectOption[] = L3_PROGRESS_STATUS_OPTIONS.map((option) => ({
    value: option.value,
    query: option.label.toLowerCase(),
    content: (
      <span className="flex items-center gap-2">
        <span
          className="size-2.5 rounded-full"
          style={{ backgroundColor: getL3ProgressStatusColor(option.value, phaseColors) }}
          aria-hidden
        />
        <span>{option.label}</span>
      </span>
    ),
  }));

  const updateCollectionFilter = useCallback(
    (property: TWorkItemFilterProperty, values: string[]) => {
      const condition = filter.findFirstConditionByPropertyAndOperator(property, COLLECTION_OPERATOR.IN);
      if (condition) {
        filter.updateConditionValue(condition.id, values);
        return;
      }

      filter.addCondition(
        LOGICAL_OPERATOR.AND,
        {
          property,
          operator: COLLECTION_OPERATOR.IN,
          value: values,
        },
        false
      );
    },
    [filter]
  );

  const handleModeChange = useCallback(
    (value: TStateFilterMode) => {
      if (value === selectedMode) return;
      setSelectedMode(value);
      if (l4StateCondition) filter.removeCondition(l4StateCondition.id);
      if (l3StatusCondition) filter.removeCondition(l3StatusCondition.id);
    },
    [selectedMode, l4StateCondition, l3StatusCondition, filter]
  );

  const handleStateValuesChange = useCallback(
    (values: string[]) => {
      updateCollectionFilter(selectedMode === "l3" ? "progress_status" : "state_id", values);
    },
    [selectedMode, updateCollectionFilter]
  );

  const handleAssigneeChange = useCallback(
    (values: string[]) => {
      updateCollectionFilter("assignee_id", values);
    },
    [updateCollectionFilter]
  );

  const selectedStateValues =
    selectedMode === "l3" ? toStringArray(l3StatusCondition?.value) : toStringArray(l4StateCondition?.value);

  const stateButtonLabel = useMemo(() => {
    const labelMap = new Map(
      (selectedMode === "l3" ? L3_PROGRESS_STATUS_OPTIONS : l4States).map((option) => [
        "label" in option ? option.value : option.id,
        "label" in option ? option.label : option.name,
      ])
    );
    const selected = selectedStateValues
      .map((value) => labelMap.get(value))
      .filter((value): value is string => !!value);
    if (selected.length === 0) return selectedMode === "l3" ? "All L3 statuses" : "All L4 states";
    if (selected.length === 1) return selected[0] ?? "";
    return `${selected.length} selected`;
  }, [selectedMode, selectedStateValues, l4States]);

  const stateButton = (
    <div className={cn(FILTER_BUTTON_CLASS_NAME, "inline-flex items-center gap-2")}>
      <StatePropertyIcon className="size-3.5 shrink-0" />
      <span className="truncate">{stateButtonLabel}</span>
    </div>
  );

  const assigneeButtonLabel = useMemo(() => {
    const selectedAssignees = new Set(toStringArray(assigneeCondition?.value));
    const selected = members.filter((member) => member?.id && selectedAssignees.has(member.id));
    if (selected.length === 0) return "All assignees";
    if (selected.length === 1) return selected[0]?.display_name ?? "1 assignee";
    return `${selected.length} assignees`;
  }, [members, assigneeCondition?.value]);

  return (
    <>
      <GroupExpandCollapseControls />
      <div className="flex items-center gap-2">
        <CustomSearchSelect
          value={selectedMode}
          onChange={(value: TStateFilterMode) => handleModeChange(value)}
          options={modeOptions}
          customButton={
            <div className={FILTER_BUTTON_CLASS_NAME}>{selectedMode === "l3" ? "L3 Status" : "L4 State"}</div>
          }
          customButtonClassName="h-8"
          optionsClassName="w-32"
        />
        <CustomSearchSelect
          value={selectedStateValues}
          onChange={(values: string[]) => handleStateValuesChange(values)}
          options={selectedMode === "l3" ? l3StatusOptions : l4StateOptions}
          multiple
          customButton={stateButton}
          customButtonClassName="h-8"
          optionsClassName="w-72"
        />
        <MemberDropdown
          projectId={projectId}
          value={toStringArray(assigneeCondition?.value)}
          onChange={handleAssigneeChange}
          multiple
          button={
            <div className={cn(FILTER_BUTTON_CLASS_NAME, "inline-flex items-center gap-2")}>
              <span>Assignee</span>
              <span className="truncate">{assigneeButtonLabel}</span>
            </div>
          }
          buttonVariant="transparent-with-text"
          optionsClassName="z-20"
        />
      </div>
    </>
  );
});
