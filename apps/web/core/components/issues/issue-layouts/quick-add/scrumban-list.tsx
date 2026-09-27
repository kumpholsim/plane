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
import { EIssueServiceType, HIERARCHY_LEVEL_DELIVERY } from "@plane/types";
import { CustomMenu } from "@plane/ui";
import { createIssuePayload } from "@plane/utils";
import { MemberDropdown } from "@/components/dropdowns/member/dropdown";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useIssues } from "@/hooks/store/use-issues";
import { useProjectHierarchyType } from "@/hooks/store/use-project-hierarchy-type";
import { useProjectState } from "@/hooks/store/use-project-state";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
import useKeypress from "@/hooks/use-keypress";
import { store } from "@/lib/store-context";

type Props = {
  /** Epic (L2) id — new L3 delivery items are parented under this epic */
  parentIssueId: string;
  quickAddCallback?: (projectId: string | null | undefined, data: TIssue) => Promise<TIssue | undefined>;
};

type TForm = {
  name: string;
};

/**
 * List-layout quick add for Scrumban epic groups: creates an L3 under the L2 epic
 * (parent_id + hierarchy_level), then ensures grouping stays under that epic column.
 */
export const ScrumbanListQuickAdd = observer(function ScrumbanListQuickAdd(props: Props) {
  const { parentIssueId, quickAddCallback } = props;
  const { t } = useTranslation();
  const { workspaceSlug, projectId } = useParams();
  const storeType = useIssueStoreType();
  const { issues: layoutIssues } = useIssues(storeType);
  const { getActiveProjectTypes, getTypeById, fetchProjectTypes, fetchedMap } = useProjectHierarchyType();
  const { createSubIssues } = useIssueDetail(EIssueServiceType.ISSUES);
  const {
    issue: { getIssueById },
  } = useIssueDetail(EIssueServiceType.ISSUES);
  const { projectStates } = useProjectState();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);

  useEffect(() => {
    if (!workspaceSlug || !projectId || fetchedMap[projectId.toString()]) return;
    void fetchProjectTypes(workspaceSlug.toString(), projectId.toString());
  }, [workspaceSlug, projectId, fetchedMap, fetchProjectTypes]);

  const types = projectId ? (getActiveProjectTypes(projectId.toString(), HIERARCHY_LEVEL_DELIVERY) ?? []) : [];
  const selectedType = selectedTypeId ? getTypeById(selectedTypeId) : null;
  const defaultStateId = projectStates?.find((state) => state.default)?.id;

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

    const payload = createIssuePayload(projectId.toString(), {
      name,
      parent_id: parentIssueId,
      state_id: defaultStateId,
      hierarchy_type_id: selectedType.id,
      hierarchy_level: HIERARCHY_LEVEL_DELIVERY,
      // Client-only epic grouping key (list group_by=module); not a Plane Module id
      module_ids: [parentIssueId],
      assignee_ids: resolvedAssignees,
    });

    const createPromise = quickAddCallback(projectId.toString(), { ...payload }).then(async (created) => {
      if (!created?.id || !workspaceSlug) return created;

      const needsParentLink = created.parent_id !== parentIssueId;
      try {
        await createSubIssues(workspaceSlug.toString(), projectId.toString(), parentIssueId, [created.id]);
      } catch (error) {
        if (needsParentLink) throw error;
      }

      const linked: TIssue = {
        ...created,
        ...getIssueById(created.id),
        parent_id: parentIssueId,
        hierarchy_level: HIERARCHY_LEVEL_DELIVERY,
        hierarchy_type_id: selectedType.id,
        // Keep list epic column grouping in sync (same as drag-and-drop)
        module_ids: [parentIssueId],
        state_id: created.state_id ?? defaultStateId ?? null,
      };
      delete linked.tempId;

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
          <div className="flex w-full cursor-pointer items-center gap-2 px-2 py-3 hover:bg-layer-transparent-hover">
            <PlusIcon className="h-3.5 w-3.5 stroke-2" />
            <span className="text-13 font-medium">{t("issue.new")}</span>
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
      className="overflow-hidden border-t border-b border-subtle bg-surface-1 p-2"
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
