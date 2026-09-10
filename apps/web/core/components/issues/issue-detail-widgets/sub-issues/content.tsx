/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useEffect, useState, useCallback } from "react";
import { observer } from "mobx-react";
import { useTranslation } from "@plane/i18n";
import { PlusIcon } from "@plane/propel/icons";
import type { TIssue, TIssueServiceType } from "@plane/types";
import { EIssueServiceType, EIssuesStoreType } from "@plane/types";
// components
import { DeleteIssueModal } from "@/components/issues/delete-issue-modal";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useSubWorkItemCategory } from "@/hooks/store/use-sub-work-item-category";
import { useIsStagedGateScrumban } from "@/hooks/use-workflow-mode";
// local imports
import { CreateUpdateIssueModal } from "../../issue-modal/modal";
import { canAddSubTasks, childCreateLabelKey, getChildHierarchyLevel, getHierarchyLevel, getIssueDepth } from "./depth";
import { useSubIssueOperations } from "./helper";
import { InlineCreateSubTask } from "./inline-create";
import { SubIssuesListRoot } from "./issues-list/root";
import { SubIssuesActionButton } from "./quick-action-button";

type Props = {
  workspaceSlug: string;
  projectId: string;
  parentIssueId: string;
  disabled: boolean;
  issueServiceType?: TIssueServiceType;
};

type TIssueCrudState = { toggle: boolean; parentIssueId: string | undefined; issue: TIssue | undefined };

export const SubIssuesCollapsibleContent = observer(function SubIssuesCollapsibleContent(props: Props) {
  const { workspaceSlug, projectId, parentIssueId, disabled, issueServiceType = EIssueServiceType.ISSUES } = props;
  const { t } = useTranslation();
  // state
  const [issueCrudState, setIssueCrudState] = useState<{
    create: TIssueCrudState;
    existing: TIssueCrudState;
    update: TIssueCrudState;
    delete: TIssueCrudState;
  }>({
    create: {
      toggle: false,
      parentIssueId: undefined,
      issue: undefined,
    },
    existing: {
      toggle: false,
      parentIssueId: undefined,
      issue: undefined,
    },
    update: {
      toggle: false,
      parentIssueId: undefined,
      issue: undefined,
    },
    delete: {
      toggle: false,
      parentIssueId: undefined,
      issue: undefined,
    },
  });
  // store hooks
  const {
    toggleCreateIssueModal,
    toggleDeleteIssueModal,
    issueCrudOperationState,
    setIssueCrudOperationState,
    issue: { getIssueById },
    subIssues: { subIssueHelpersByIssueId, setSubIssueHelpers },
  } = useIssueDetail(issueServiceType);
  const { getCategoryById } = useSubWorkItemCategory();
  // Classic adds sub-items from the widget action bar; Scrumban adds them inline with a hierarchy type
  const isStagedGateScrumban = useIsStagedGateScrumban(projectId);

  // helpers
  const subIssueOperations = useSubIssueOperations(issueServiceType);
  const subIssueHelpers = subIssueHelpersByIssueId(`${parentIssueId}_root`);
  const parentIssue = getIssueById(parentIssueId);
  const parentDepth = getIssueDepth(parentIssue, getIssueById);
  const parentLevel = getHierarchyLevel(parentIssue);
  const childLevel = getChildHierarchyLevel(parentIssue);
  const allowAddSubTasks = isStagedGateScrumban && !disabled && canAddSubTasks(parentDepth, parentLevel);

  // handler
  const handleIssueCrudState = useCallback(
    (key: "create" | "existing" | "update" | "delete", _parentIssueId: string | null, issue: TIssue | null = null) => {
      setIssueCrudState({
        ...issueCrudState,
        [key]: {
          toggle: !issueCrudState[key].toggle,
          parentIssueId: _parentIssueId,
          issue,
        },
      });
    },
    [issueCrudState]
  );

  const handleCloseInlineCreate = useCallback(() => {
    setIssueCrudOperationState({
      ...issueCrudOperationState,
      create: {
        toggle: false,
        parentIssueId: undefined,
        issue: undefined,
        categoryId: null,
      },
    });
  }, [issueCrudOperationState, setIssueCrudOperationState]);

  const handleInlineCategoryChange = useCallback(
    (categoryId: string) => {
      setIssueCrudOperationState({
        ...issueCrudOperationState,
        create: {
          ...issueCrudOperationState.create,
          categoryId,
        },
      });
    },
    [issueCrudOperationState, setIssueCrudOperationState]
  );

  const handleFetchSubIssues = useCallback(async () => {
    const helperKey = `${parentIssueId}_root`;
    const currentSubIssueHelpers = subIssueHelpersByIssueId(helperKey);
    // Already fetched for this parent — nothing to do.
    if (currentSubIssueHelpers.issue_visibility.includes(parentIssueId)) return;

    try {
      if (!currentSubIssueHelpers.preview_loader.includes(parentIssueId)) {
        setSubIssueHelpers(helperKey, "preview_loader", parentIssueId);
      }
      await subIssueOperations.fetchSubIssues(workspaceSlug, projectId, parentIssueId);
      // setSubIssueHelpers toggles; only add visibility if it is not already present
      // (avoids Strict Mode double-effect clearing the flag).
      if (!subIssueHelpersByIssueId(helperKey).issue_visibility.includes(parentIssueId)) {
        setSubIssueHelpers(helperKey, "issue_visibility", parentIssueId);
      }
    } catch (error) {
      console.error("Error fetching sub-tasks:", error);
    } finally {
      if (subIssueHelpersByIssueId(helperKey).preview_loader.includes(parentIssueId)) {
        setSubIssueHelpers(helperKey, "preview_loader", parentIssueId);
      }
    }
  }, [parentIssueId, projectId, setSubIssueHelpers, subIssueHelpersByIssueId, subIssueOperations, workspaceSlug]);

  useEffect(() => {
    void handleFetchSubIssues();
  }, [handleFetchSubIssues]);

  // render conditions
  const shouldRenderDeleteIssueModal =
    issueCrudState?.delete?.toggle &&
    issueCrudState?.delete?.issue &&
    issueCrudState.delete.parentIssueId &&
    issueCrudState.delete.issue.id;

  const shouldRenderUpdateIssueModal = issueCrudState?.update?.toggle && issueCrudState?.update?.issue;

  const showInlineCreate =
    allowAddSubTasks &&
    issueCrudOperationState?.create?.toggle &&
    issueCrudOperationState?.create?.parentIssueId === parentIssueId;

  const inlineCategoryId = issueCrudOperationState?.create?.categoryId ?? null;
  const inlineCategory = inlineCategoryId ? getCategoryById(inlineCategoryId) : null;

  return (
    <>
      {(isStagedGateScrumban || subIssueHelpers.issue_visibility.includes(parentIssueId)) && (
        <SubIssuesListRoot
          storeType={EIssuesStoreType.PROJECT}
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          parentIssueId={parentIssueId}
          rootIssueId={parentIssueId}
          spacingLeft={6}
          canEdit={!disabled}
          handleIssueCrudState={handleIssueCrudState}
          subIssueOperations={subIssueOperations}
          issueServiceType={issueServiceType}
        />
      )}

      {/* Bottom Add sub-task — quiet list-style affordance, not a solid button */}
      {allowAddSubTasks &&
        (showInlineCreate ? (
          <InlineCreateSubTask
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            parentIssueId={parentIssueId}
            category={inlineCategory}
            issueServiceType={issueServiceType}
            onClose={handleCloseInlineCreate}
            onCategoryChange={handleInlineCategoryChange}
          />
        ) : (
          <div className="border-t border-subtle">
            <SubIssuesActionButton
              issueId={parentIssueId}
              disabled={disabled}
              issueServiceType={issueServiceType}
              customButtonClassName="w-full hover:bg-layer-1 disabled:cursor-not-allowed disabled:opacity-50"
              customButton={
                <span className="flex w-full items-center gap-2 px-3 py-2.5 text-13 font-medium whitespace-nowrap text-placeholder hover:text-secondary">
                  <PlusIcon className="size-3.5 flex-shrink-0 stroke-2" />
                  <span>{t(childCreateLabelKey(childLevel))}</span>
                </span>
              }
            />
          </div>
        ))}

      {shouldRenderDeleteIssueModal && (
        <DeleteIssueModal
          isOpen={issueCrudState?.delete?.toggle}
          handleClose={() => {
            handleIssueCrudState("delete", null, null);
            toggleDeleteIssueModal(null);
          }}
          data={issueCrudState?.delete?.issue as TIssue}
          onSubmit={async () =>
            await subIssueOperations.deleteSubIssue(
              workspaceSlug,
              projectId,
              issueCrudState?.delete?.parentIssueId as string,
              issueCrudState?.delete?.issue?.id as string
            )
          }
          isSubIssue
        />
      )}

      {shouldRenderUpdateIssueModal && (
        <CreateUpdateIssueModal
          isOpen={issueCrudState?.update?.toggle}
          onClose={() => {
            handleIssueCrudState("update", null, null);
            toggleCreateIssueModal(false);
          }}
          data={issueCrudState?.update?.issue ?? undefined}
          onSubmit={async (_issue: TIssue) => {
            await subIssueOperations.updateSubIssue(
              workspaceSlug,
              projectId,
              parentIssueId,
              _issue.id,
              _issue,
              issueCrudState?.update?.issue,
              true
            );
          }}
        />
      )}
    </>
  );
});
