/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { useTranslation } from "@plane/i18n";
import { CheckIcon, ChevronDownIcon, CloseIcon, PlusIcon } from "@plane/propel/icons";
import { setPromiseToast } from "@plane/propel/toast";
import type { TIssue } from "@plane/types";
import { EIssueServiceType, HIERARCHY_LEVEL_SUB_TASK } from "@plane/types";
import { CustomMenu } from "@plane/ui";
import { createIssuePayload } from "@plane/utils";
import { MemberDropdown } from "@/components/dropdowns/member/dropdown";
import { resolveTodoStateId } from "@/components/issues/issue-detail-widgets/sub-issues/quick-action-button";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useIssues } from "@/hooks/store/use-issues";
import { useProjectHierarchyType } from "@/hooks/store/use-project-hierarchy-type";
import { useProjectState } from "@/hooks/store/use-project-state";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
import useKeypress from "@/hooks/use-keypress";
import { store } from "@/lib/store-context";

type Props = {
  parentIssueId: string;
  stateId: string;
  quickAddCallback?: (projectId: string | null | undefined, data: TIssue) => Promise<TIssue | undefined>;
};

type TForm = {
  name: string;
};

export const ScrumbanKanbanQuickAdd = observer(function ScrumbanKanbanQuickAdd(props: Props) {
  const { parentIssueId, stateId, quickAddCallback } = props;
  const { t } = useTranslation();
  const { workspaceSlug, projectId } = useParams();
  const storeType = useIssueStoreType();
  const { issues: layoutIssues } = useIssues(storeType);
  const { getActiveProjectTypes, getTypeById, fetchProjectTypes, fetchedMap } = useProjectHierarchyType();
  const { createSubIssues } = useIssueDetail(EIssueServiceType.ISSUES);
  const {
    issue: { getIssueById },
  } = useIssueDetail(EIssueServiceType.ISSUES);
  const { getProjectStates } = useProjectState();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);

  useEffect(() => {
    if (!workspaceSlug || !projectId || fetchedMap[projectId.toString()]) return;
    void fetchProjectTypes(workspaceSlug.toString(), projectId.toString());
  }, [workspaceSlug, projectId, fetchedMap, fetchProjectTypes]);

  const types = projectId ? (getActiveProjectTypes(projectId.toString(), HIERARCHY_LEVEL_SUB_TASK) ?? []) : [];
  const selectedType = selectedTypeId ? getTypeById(selectedTypeId) : null;

  const {
    reset,
    handleSubmit,
    setFocus,
    register,
    formState: { isSubmitting },
  } = useForm<TForm>({ defaultValues: { name: "" } });

  useEffect(() => {
    if (isOpen && selectedTypeId) setFocus("name");
  }, [isOpen, selectedTypeId, setFocus]);

  const closeForm = () => {
    setIsOpen(false);
    setSelectedTypeId(null);
    setAssigneeIds([]);
    reset({ name: "" });
  };

  useKeypress("Escape", closeForm);

  const handleTypeSelect = (typeId: string) => {
    setSelectedTypeId(typeId);
    setIsOpen(true);
  };

  const onSubmit = async (formData: TForm) => {
    if (isSubmitting || !projectId || !quickAddCallback || !selectedType) return;
    const name = formData.name.trim();
    if (!name) return;

    const resolvedAssignees = [...assigneeIds];
    closeForm();

    const resolvedStateId = resolveTodoStateId(getProjectStates, projectId.toString(), selectedType.name) ?? stateId;

    const payload = createIssuePayload(projectId.toString(), {
      name,
      parent_id: parentIssueId,
      state_id: resolvedStateId,
      hierarchy_type_id: selectedType.id,
      hierarchy_level: HIERARCHY_LEVEL_SUB_TASK,
      sub_work_item_category_id: selectedType.id,
      assignee_ids: resolvedAssignees,
    });

    // Create with parent_id, then link via sub-issues API so L3 parent is persisted
    // and the parent's child list / counts stay in sync.
    const createPromise = quickAddCallback(projectId.toString(), { ...payload }).then(async (created) => {
      if (!created?.id || !workspaceSlug) return created;

      const needsParentLink = created.parent_id !== parentIssueId;
      try {
        await createSubIssues(workspaceSlug.toString(), projectId.toString(), parentIssueId, [created.id]);
      } catch (error) {
        // Refresh-only failure is fine when create already parented the L4
        if (needsParentLink) throw error;
      }

      // Ensure the board card is the real server issue (sequence_id, no tempId, parent set)
      const linked: TIssue = {
        ...created,
        ...getIssueById(created.id),
        parent_id: parentIssueId,
        hierarchy_level: HIERARCHY_LEVEL_SUB_TASK,
        hierarchy_type_id: selectedType.id,
        sub_work_item_category_id: selectedType.id,
        state_id: created.state_id ?? resolvedStateId,
      };
      delete linked.tempId;

      // Map first (grouping reads parent_id / hierarchy_level), then force board list insert
      store.issue.issues.addIssue([linked]);
      layoutIssues.removeIssueFromList(linked.id);
      layoutIssues.addIssueToList(linked.id);

      return linked;
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

  if (!projectId) return null;

  const menuPortal = typeof document !== "undefined" ? document.body : null;

  if (!isOpen || !selectedType) {
    return (
      <CustomMenu
        placement="bottom-start"
        closeOnSelect
        className="w-full"
        portalElement={menuPortal}
        menuItemsClassName="z-50"
        optionsClassName="z-50"
        customButton={
          <div className="flex w-full cursor-pointer items-center gap-2 rounded-lg bg-layer-1 px-2 py-1.5 hover:bg-layer-1-hover">
            <PlusIcon className="h-3.5 w-3.5 stroke-2" />
            <span className="text-13 font-medium">{t("issue.add.sub_issue")}</span>
          </div>
        }
        customButtonClassName="w-full"
        disabled={types.length === 0}
      >
        {types.map((item) => (
          <CustomMenu.MenuItem key={item.id} onClick={() => handleTypeSelect(item.id)}>
            <div className="flex items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
              <span>{item.name}</span>
            </div>
          </CustomMenu.MenuItem>
        ))}
      </CustomMenu>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="overflow-hidden rounded-lg border border-subtle bg-layer-2 p-2 shadow-raised-100"
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <CustomMenu
          placement="bottom-start"
          closeOnSelect
          className="shrink-0"
          portalElement={menuPortal}
          menuItemsClassName="z-50"
          optionsClassName="z-50"
          customButton={
            <button
              type="button"
              className="flex h-6 max-w-24 items-center gap-1 rounded-sm px-1.5 text-11 font-medium text-white hover:opacity-90"
              style={{ backgroundColor: selectedType.color }}
            >
              <span className="truncate">{selectedType.name}</span>
              <ChevronDownIcon className="size-3 shrink-0 opacity-80" />
            </button>
          }
        >
          {types.map((item) => (
            <CustomMenu.MenuItem key={item.id} onClick={() => setSelectedTypeId(item.id)}>
              <div className="flex w-full items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="flex-1 truncate">{item.name}</span>
                {selectedTypeId === item.id && <CheckIcon className="size-3.5 shrink-0 text-secondary" />}
              </div>
            </CustomMenu.MenuItem>
          ))}
        </CustomMenu>
        <input
          autoComplete="off"
          placeholder={t("issue.title.label")}
          {...register("name", { required: true })}
          className="min-w-0 flex-1 bg-transparent py-1 text-13 font-medium text-secondary outline-none placeholder:text-placeholder"
        />
        <div
          className="h-6 shrink-0"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="presentation"
        >
          <MemberDropdown
            value={assigneeIds}
            onChange={(val) => setAssigneeIds(val)}
            projectId={projectId.toString()}
            multiple
            buttonVariant={assigneeIds.length > 0 ? "transparent-without-text" : "border-without-text"}
            buttonClassName={assigneeIds.length > 0 ? "hover:bg-transparent px-0 h-6" : "h-6"}
            placeholder={t("common.assignees")}
            showTooltip
          />
        </div>
        <button
          type="button"
          onClick={closeForm}
          className="flex size-6 shrink-0 items-center justify-center rounded text-placeholder hover:bg-layer-1 hover:text-secondary"
          aria-label={t("close")}
        >
          <CloseIcon className="size-3.5" />
        </button>
      </div>
      <p className="mt-1 text-11 text-tertiary italic">{t("issue.add.press_enter")}</p>
    </form>
  );
});
