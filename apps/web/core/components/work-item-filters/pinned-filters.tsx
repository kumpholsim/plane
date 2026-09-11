/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useMemo } from "react";
import { observer } from "mobx-react";
import { ChevronDownIcon } from "lucide-react";
import { MembersPropertyIcon, StatePropertyIcon, WorkItemsIcon } from "@plane/propel/icons";
import type { IWorkItemFilterInstance } from "@plane/shared-state";
import type { ICustomSearchSelectOption, TWorkItemFilterProperty } from "@plane/types";
import {
  COLLECTION_OPERATOR,
  HIERARCHY_LEVEL_DELIVERY,
  HIERARCHY_LEVEL_SUB_TASK,
  LOGICAL_OPERATOR,
} from "@plane/types";
import { Avatar, CustomSearchSelect } from "@plane/ui";
import { cn, getFileURL, toFilterArray } from "@plane/utils";
import { L3_PROGRESS_PHASE_FALLBACK_COLORS, L3_PROGRESS_STATUS_OPTIONS } from "@plane/constants";
import { MemberDropdown } from "@/components/dropdowns/member/dropdown";
import { GroupExpandCollapseControls } from "@/components/issues/issue-layouts/expand-collapse";
import { getL3ProgressStatusOptionClassName } from "@/components/issues/hierarchy-status";
import { COMMON_FILTER_ITEM_BORDER_CLASSNAME } from "@/components/rich-filters/shared";
import { useMember } from "@/hooks/store/use-member";
import { useProjectHierarchyType } from "@/hooks/store/use-project-hierarchy-type";

type Props = {
  filter: IWorkItemFilterInstance;
  projectId: string;
};

function FilterChipShell(props: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex h-7 min-w-0 items-stretch overflow-hidden rounded-sm border border-subtle bg-surface-1",
        props.className
      )}
    >
      {props.children}
    </div>
  );
}

function FilterChipLabel(props: { icon: React.FC<React.SVGAttributes<SVGElement>>; label: string }) {
  const Icon = props.icon;
  return (
    <div
      className={cn(
        "flex h-full shrink-0 items-center gap-1 px-2 text-13 font-regular text-secondary",
        COMMON_FILTER_ITEM_BORDER_CLASSNAME
      )}
    >
      <Icon className="size-3.5 shrink-0" />
      <span className="whitespace-nowrap">{props.label}</span>
    </div>
  );
}

function FilterChipTrigger(props: { children: React.ReactNode; className?: string; showChevron?: boolean }) {
  return (
    <div
      className={cn(
        "flex h-full max-w-64 min-w-[7rem] items-center gap-1 px-2 text-13 font-regular text-secondary hover:bg-layer-1",
        props.className
      )}
    >
      <span className="min-w-0 flex-1 truncate text-left">{props.children}</span>
      {props.showChevron !== false && <ChevronDownIcon className="size-3 shrink-0 text-placeholder" />}
    </div>
  );
}

export const WorkItemPinnedFilters = observer(function WorkItemPinnedFilters(props: Props) {
  const { filter, projectId } = props;
  const {
    getUserDetails,
    project: { getProjectMemberIds },
  } = useMember();
  const { getActiveProjectTypes } = useProjectHierarchyType();

  // Read via computed display conditions so MobX tracks expression updates.
  const conditions = filter.allConditionsForDisplay;
  const categoryCondition = conditions.find(
    (condition) => condition.property === "hierarchy_type_id" && condition.operator === COLLECTION_OPERATOR.IN
  );
  const assigneeCondition = conditions.find(
    (condition) => condition.property === "assignee_id" && condition.operator === COLLECTION_OPERATOR.IN
  );
  const l3StatusCondition = conditions.find(
    (condition) => condition.property === "progress_status" && condition.operator === COLLECTION_OPERATOR.IN
  );

  // Drop leftover Sub-task / legacy State filters — pinned bar is Story progress only.
  useEffect(() => {
    const condition = filter.findFirstConditionByPropertyAndOperator("state_id", COLLECTION_OPERATOR.IN);
    if (condition) filter.removeCondition(condition.id);
  }, [filter]);

  const l3CategoryTypes = useMemo(
    () => getActiveProjectTypes(projectId, HIERARCHY_LEVEL_DELIVERY) ?? [],
    [getActiveProjectTypes, projectId]
  );
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

  const memberIds = useMemo(() => getProjectMemberIds(projectId, false) ?? [], [getProjectMemberIds, projectId]);

  const categoryOptions: ICustomSearchSelectOption[] = useMemo(
    () =>
      l3CategoryTypes.map((type) => ({
        value: type.id,
        query: type.name.toLowerCase(),
        content: (
          <span className="flex w-full items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: type.color || "#6B7280" }}
              aria-hidden
            />
            <span className="truncate">{type.name}</span>
          </span>
        ),
      })),
    [l3CategoryTypes]
  );

  const l3StatusOptions: ICustomSearchSelectOption[] = useMemo(
    () =>
      L3_PROGRESS_STATUS_OPTIONS.map((option) => ({
        value: option.value,
        query: option.label.toLowerCase(),
        content: (
          <span
            className={cn(
              "-mx-1 flex w-full items-center gap-2 rounded px-1 py-0.5",
              getL3ProgressStatusOptionClassName(option.value)
            )}
          >
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: phaseColors[option.phase] }}
              aria-hidden
            />
            <span>{option.label}</span>
          </span>
        ),
      })),
    [phaseColors]
  );

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

  const handleCategoryChange = useCallback(
    (values: string[]) => {
      updateCollectionFilter("hierarchy_type_id", toFilterArray(values).map(String));
    },
    [updateCollectionFilter]
  );

  const handleStoryStatusChange = useCallback(
    (values: string[]) => {
      updateCollectionFilter("progress_status", toFilterArray(values).map(String));
    },
    [updateCollectionFilter]
  );

  const handleAssigneeChange = useCallback(
    (values: string[]) => {
      updateCollectionFilter("assignee_id", toFilterArray(values).map(String));
    },
    [updateCollectionFilter]
  );

  const selectedCategoryValues = toFilterArray(categoryCondition?.value).map(String);

  const categoryValueLabel = useMemo(() => {
    const labelMap = new Map(l3CategoryTypes.map((type) => [type.id, type.name]));
    const selected = selectedCategoryValues
      .map((value) => labelMap.get(value))
      .filter((value): value is string => !!value);
    if (selected.length === 0) return "Any";
    if (selected.length === 1) return selected[0] ?? "Any";
    if (selected.length === 2) return selected.join(", ");
    return `${selected[0]}, +${selected.length - 1}`;
  }, [l3CategoryTypes, selectedCategoryValues]);

  const selectedStatusValues = toFilterArray(l3StatusCondition?.value).map(String);

  const statusValueLabel = useMemo(() => {
    const labelMap = new Map(L3_PROGRESS_STATUS_OPTIONS.map((option) => [option.value, option.label]));
    const selected = selectedStatusValues
      .map((value) => labelMap.get(value))
      .filter((value): value is string => !!value);
    if (selected.length === 0) return "Any";
    if (selected.length === 1) return selected[0] ?? "Any";
    if (selected.length === 2) return selected.join(", ");
    return `${selected[0]}, +${selected.length - 1}`;
  }, [selectedStatusValues]);

  const selectedAssigneeIds = toFilterArray(assigneeCondition?.value).map(String);
  const selectedAssignees = useMemo(
    () =>
      selectedAssigneeIds
        .map((id) => getUserDetails(id))
        .filter((member): member is NonNullable<typeof member> => Boolean(member?.id)),
    [selectedAssigneeIds, getUserDetails]
  );

  const assigneeValueLabel = useMemo(() => {
    if (selectedAssigneeIds.length === 0) return "Any";
    if (selectedAssignees.length === 0) {
      return selectedAssigneeIds.length === 1 ? "1 selected" : `${selectedAssigneeIds.length} selected`;
    }
    if (selectedAssignees.length === 1) return selectedAssignees[0]?.display_name ?? "1 selected";
    if (selectedAssignees.length === 2) {
      return selectedAssignees.map((member) => member.display_name).join(", ");
    }
    return `${selectedAssignees[0]?.display_name}, +${selectedAssignees.length - 1}`;
  }, [selectedAssigneeIds.length, selectedAssignees]);

  return (
    <>
      <GroupExpandCollapseControls />
      <div className="flex flex-wrap items-center gap-2">
        <FilterChipShell>
          <FilterChipLabel icon={WorkItemsIcon} label="Category" />
          <CustomSearchSelect
            value={selectedCategoryValues}
            onChange={(values: string[] | string) => handleCategoryChange(toFilterArray(values).map(String))}
            options={categoryOptions}
            multiple
            className="min-w-0"
            customButton={<FilterChipTrigger>{categoryValueLabel}</FilterChipTrigger>}
            customButtonClassName="h-full min-w-[7rem] text-13 font-regular"
            optionsClassName="w-56"
          />
        </FilterChipShell>

        <FilterChipShell>
          <FilterChipLabel icon={StatePropertyIcon} label="State" />
          <CustomSearchSelect
            value={selectedStatusValues}
            onChange={(values: string[] | string) => handleStoryStatusChange(toFilterArray(values).map(String))}
            options={l3StatusOptions}
            multiple
            className="min-w-0"
            customButton={<FilterChipTrigger>{statusValueLabel}</FilterChipTrigger>}
            customButtonClassName="h-full min-w-[7rem] text-13 font-regular"
            optionsClassName="w-72"
          />
        </FilterChipShell>

        <FilterChipShell>
          <FilterChipLabel icon={MembersPropertyIcon} label="Assignees" />
          <MemberDropdown
            projectId={projectId}
            memberIds={memberIds}
            value={selectedAssigneeIds}
            onChange={handleAssigneeChange}
            multiple
            button={
              <FilterChipTrigger>
                <span className="flex min-w-0 items-center gap-1.5">
                  {selectedAssignees.length > 0 && (
                    <span className="flex shrink-0 -space-x-1">
                      {selectedAssignees.slice(0, 2).map((member) => (
                        <Avatar
                          key={member.id}
                          name={member.display_name}
                          src={getFileURL(member.avatar_url ?? "")}
                          size="sm"
                          showTooltip={false}
                          className="ring-surface-1 ring-1"
                        />
                      ))}
                    </span>
                  )}
                  <span className="truncate">{assigneeValueLabel}</span>
                </span>
              </FilterChipTrigger>
            }
            buttonVariant="transparent-with-text"
            buttonContainerClassName="h-full min-w-[7rem]"
            buttonClassName="h-full px-0 text-13 font-regular text-secondary hover:bg-transparent"
            // Above board fullscreen shell (z-[25]) so the menu stays usable when zoomed in
            optionsClassName="z-[100]"
          />
        </FilterChipShell>
      </div>
    </>
  );
});
