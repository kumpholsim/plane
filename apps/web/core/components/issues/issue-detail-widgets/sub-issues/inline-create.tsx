/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "@plane/i18n";
import { CheckIcon, ChevronDownIcon, CloseIcon, ParentPropertyIcon } from "@plane/propel/icons";
import { setPromiseToast } from "@plane/propel/toast";
import type { ISearchIssueResponse, IProjectHierarchyType, TIssuePriorities, TIssueServiceType } from "@plane/types";
import { EIssuesStoreType } from "@plane/types";
import { CustomMenu, Tooltip } from "@plane/ui";
import { createIssuePayload } from "@plane/utils";
// components
import { CycleDropdown } from "@/components/dropdowns/cycle";
import { MemberDropdown } from "@/components/dropdowns/member/dropdown";
import { PriorityDropdown } from "@/components/dropdowns/priority";
import { ParentIssuesListModal } from "@/components/issues/parent-issues-list-modal";
// hooks
import { useIssues } from "@/hooks/store/use-issues";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useProject } from "@/hooks/store/use-project";
import { useProjectState } from "@/hooks/store/use-project-state";
import { useProjectHierarchyType } from "@/hooks/store/use-project-hierarchy-type";
import useKeypress from "@/hooks/use-keypress";
// local
import { getChildHierarchyLevel, canEditCycle } from "./depth";
import { useSubIssueOperations } from "./helper";
import { resolveTodoStateId } from "./quick-action-button";

type Props = {
  workspaceSlug: string;
  projectId: string;
  parentIssueId: string;
  category: IProjectHierarchyType | null;
  issueServiceType: TIssueServiceType;
  onClose: () => void;
  onCategoryChange?: (categoryId: string) => void;
};

type TInlineForm = {
  name: string;
  priority: TIssuePriorities;
  assignee_ids: string[];
  cycle_id: string | null;
  module_ids: string[];
  parent_id: string;
};

export const InlineCreateSubTask = observer(function InlineCreateSubTask(props: Props) {
  const { workspaceSlug, projectId, parentIssueId, category, issueServiceType, onClose, onCategoryChange } = props;
  const { t } = useTranslation();
  const { getProjectById } = useProject();
  const { getProjectStates } = useProjectState();
  const { getActiveProjectTypes, getTypeById } = useProjectHierarchyType();
  const {
    issues: { createIssue, addIssueToCycle, changeModulesInIssue },
  } = useIssues(EIssuesStoreType.PROJECT);
  const subIssueOperations = useSubIssueOperations(issueServiceType);
  const {
    setLastWidgetAction,
    issue: { getIssueById },
  } = useIssueDetail(issueServiceType);

  const projectDetail = getProjectById(projectId);
  const defaultParent = getIssueById(parentIssueId);
  const childLevel = getChildHierarchyLevel(defaultParent);
  const showCyclePicker = projectDetail?.cycle_view && canEditCycle(childLevel);
  const categories = getActiveProjectTypes(projectId, childLevel) ?? [];
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(category?.id ?? null);
  const [parentIssueListModalOpen, setParentIssueListModalOpen] = useState(false);
  const [selectedParentIssue, setSelectedParentIssue] = useState<ISearchIssueResponse | null>(null);

  useEffect(() => {
    setSelectedCategoryId(category?.id ?? null);
  }, [category?.id]);

  const selectedCategory = selectedCategoryId ? (getTypeById(selectedCategoryId) ?? category) : category;

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    onCategoryChange?.(categoryId);
  };

  const {
    control,
    reset,
    handleSubmit,
    setFocus,
    setValue,
    register,
    formState: { isSubmitting },
  } = useForm<TInlineForm>({
    defaultValues: {
      name: "",
      priority: "none",
      assignee_ids: [],
      cycle_id: null,
      module_ids: [],
      parent_id: parentIssueId,
    },
  });

  useEffect(() => {
    setFocus("name");
  }, [setFocus, selectedCategoryId]);

  useEffect(() => {
    setValue("parent_id", parentIssueId);
  }, [parentIssueId, setValue]);

  useKeypress("Escape", onClose);

  const onSubmit = async (formData: TInlineForm) => {
    if (isSubmitting || !formData.name.trim()) return;

    const todoStateId = resolveTodoStateId(getProjectStates, projectId, selectedCategory?.name);
    const resolvedParentId = formData.parent_id;
    const payload = createIssuePayload(projectId, {
      name: formData.name.trim(),
      parent_id: resolvedParentId,
      project_id: projectId,
      priority: formData.priority,
      assignee_ids: formData.assignee_ids,
      hierarchy_type_id: selectedCategory?.id ?? null,
      hierarchy_level: selectedCategory?.level ?? childLevel,
      sub_work_item_category_id: selectedCategory?.id ?? null,
      ...(todoStateId ? { state_id: todoStateId } : {}),
    });

    const cycleId = formData.cycle_id;
    const moduleIds = formData.module_ids ?? [];

    reset({
      name: "",
      priority: "none",
      assignee_ids: [],
      cycle_id: null,
      module_ids: [],
      parent_id: parentIssueId,
    });
    setSelectedParentIssue(null);
    setFocus("name");
    setLastWidgetAction("sub-work-items");

    const createPromise = createIssue(workspaceSlug, projectId, payload).then(async (response) => {
      if (!response?.id) return response;

      await subIssueOperations.addSubIssue(workspaceSlug, projectId, resolvedParentId, [response.id]);

      // Assign cycle when provided (L3 and L4 are assignable)
      if (cycleId && canEditCycle(selectedCategory?.level ?? childLevel)) {
        await addIssueToCycle(workspaceSlug, projectId, cycleId, [response.id]);
      }
      if (moduleIds.length > 0) {
        await changeModulesInIssue(workspaceSlug, projectId, response.id, moduleIds, []);
      }

      return response;
    });

    setPromiseToast(createPromise, {
      loading: t("issue.adding"),
      success: {
        title: t("common.success"),
        message: () => t("issue.create.success"),
      },
      error: {
        title: t("common.error.label"),
        message: (err) => err?.error || err?.message || t("common.error.message"),
      },
    });

    await createPromise;
  };

  const parentTooltip =
    selectedParentIssue?.name ??
    defaultParent?.name ??
    (selectedParentIssue || defaultParent
      ? `${selectedParentIssue?.project__identifier ?? projectDetail?.identifier}-${selectedParentIssue?.sequence_id ?? defaultParent?.sequence_id}`
      : t("change_parent_issue"));

  return (
    <div className="border-t border-subtle">
      <form onSubmit={handleSubmit(onSubmit)} className="px-3 py-2">
        {/* Title row */}
        <div className="flex w-full min-w-0 items-center gap-2">
          {categories.length > 0 && (
            <CustomMenu
              placement="bottom-start"
              closeOnSelect
              className="flex-shrink-0"
              customButton={
                <Tooltip tooltipContent={selectedCategory?.name ?? t("common.select")} position="top">
                  <button
                    type="button"
                    className="flex h-6 items-center gap-1 rounded-sm px-1.5 text-11 font-medium text-white hover:opacity-90"
                    style={{ backgroundColor: selectedCategory?.color ?? "#6b7280" }}
                  >
                    <span className="max-w-16 truncate">{selectedCategory?.name ?? t("common.select")}</span>
                    <ChevronDownIcon className="size-3 flex-shrink-0 opacity-80" />
                  </button>
                </Tooltip>
              }
            >
              {categories.map((item) => (
                <CustomMenu.MenuItem key={item.id} onClick={() => handleCategorySelect(item.id)}>
                  <div className="flex w-full items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="flex-1 truncate">{item.name}</span>
                    {selectedCategoryId === item.id && <CheckIcon className="size-3.5 flex-shrink-0 text-secondary" />}
                  </div>
                </CustomMenu.MenuItem>
              ))}
            </CustomMenu>
          )}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="flex-shrink-0 text-11 font-medium text-placeholder">
              {projectDetail?.identifier ?? "..."}
            </span>
            <input
              type="text"
              autoComplete="off"
              placeholder={t("issue.title.label")}
              {...register("name", { required: true })}
              className="w-full min-w-0 bg-transparent py-1.5 text-13 leading-5 font-medium text-secondary outline-none placeholder:text-placeholder"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-6 flex-shrink-0 items-center justify-center rounded text-placeholder hover:bg-layer-1 hover:text-secondary"
            aria-label={t("close")}
          >
            <CloseIcon className="size-3.5" />
          </button>
        </div>

        {/* Compact property icons — fits narrow detail columns */}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Controller
            control={control}
            name="priority"
            render={({ field: { value, onChange } }) => (
              <div className="h-6 flex-shrink-0">
                <PriorityDropdown
                  value={value}
                  onChange={onChange}
                  buttonVariant="border-without-text"
                  buttonClassName="h-6"
                  showTooltip
                />
              </div>
            )}
          />
          <Controller
            control={control}
            name="assignee_ids"
            render={({ field: { value, onChange } }) => (
              <div className="h-6 flex-shrink-0">
                <MemberDropdown
                  projectId={projectId}
                  value={value}
                  onChange={onChange}
                  buttonVariant="border-without-text"
                  buttonClassName="h-6"
                  placeholder={t("assignees")}
                  multiple
                  showTooltip
                />
              </div>
            )}
          />
          {showCyclePicker && (
            <Controller
              control={control}
              name="cycle_id"
              render={({ field: { value, onChange } }) => (
                <div className="h-6 flex-shrink-0">
                  <CycleDropdown
                    projectId={projectId}
                    value={value}
                    onChange={onChange}
                    placeholder={t("cycle.label", { count: 1 })}
                    buttonVariant="border-without-text"
                    buttonClassName="h-6"
                    showTooltip
                  />
                </div>
              )}
            />
          )}
          <div className="h-6 flex-shrink-0">
            <Tooltip tooltipContent={parentTooltip} position="top">
              <button
                type="button"
                className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-sm border-[0.5px] border-strong text-secondary hover:bg-layer-1"
                onClick={() => setParentIssueListModalOpen(true)}
                aria-label={t("change_parent_issue")}
              >
                <ParentPropertyIcon className="size-3.5" />
              </button>
            </Tooltip>
          </div>
          <Controller
            control={control}
            name="parent_id"
            render={({ field: { onChange } }) => (
              <ParentIssuesListModal
                isOpen={parentIssueListModalOpen}
                handleClose={() => setParentIssueListModalOpen(false)}
                onChange={(issue) => {
                  onChange(issue.id);
                  setSelectedParentIssue(issue);
                }}
                projectId={projectId}
              />
            )}
          />
          <span className="basis-full text-11 text-placeholder italic sm:ml-auto sm:basis-auto">
            {t("issue.add.press_enter")}
          </span>
        </div>
      </form>
    </div>
  );
});
