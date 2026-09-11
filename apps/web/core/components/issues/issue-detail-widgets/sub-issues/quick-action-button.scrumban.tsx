/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useEffect } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { useTranslation } from "@plane/i18n";
import {
  HIERARCHY_BOARD_STATE_KEYS,
  HIERARCHY_BOARD_STATE_PREFIX,
  boardStateKeyFromExternalId,
} from "@plane/constants";
import { PlusIcon, WorkItemsIcon } from "@plane/propel/icons";
import type { IState, TIssueServiceType } from "@plane/types";
import { CustomMenu } from "@plane/ui";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useProjectState } from "@/hooks/store/use-project-state";
import { useProjectHierarchyType } from "@/hooks/store/use-project-hierarchy-type";
import { canAddSubTasks, childCreateLabelKey, getChildHierarchyLevel, getHierarchyLevel, getIssueDepth } from "./depth";

type Props = {
  issueId: string;
  customButton?: React.ReactNode;
  customButtonClassName?: string;
  disabled?: boolean;
  issueServiceType: TIssueServiceType;
};

/** Default board column for a new L4 sub-task (shared To Do for Design / Dev / QA). */
export const resolveTodoStateId = (
  getProjectStates: (projectId: string | null | undefined) => IState[] | undefined,
  projectId: string | null | undefined,
  _hierarchyTypeName?: string | null
): string | undefined => {
  const states = getProjectStates(projectId);
  if (!states?.length) return undefined;

  const preferredKey = HIERARCHY_BOARD_STATE_KEYS.DESIGN_DEV_TODO;
  const preferredExternalId = `${HIERARCHY_BOARD_STATE_PREFIX}${preferredKey}`;

  const byExternalId = states.find((state) => state.external_id === preferredExternalId);
  if (byExternalId) return byExternalId.id;

  const byKey = states.find((state) => boardStateKeyFromExternalId(state.external_id) === preferredKey);
  if (byKey) return byKey.id;

  const byName = states.find((state) => (state.name ?? "").trim().toLowerCase() === "to do");
  if (byName) return byName.id;

  // Last resort: first unstarted shared To Do (or any unstarted)
  const unstarted = states.find((state) => {
    if (state.group !== "unstarted") return false;
    const key = boardStateKeyFromExternalId(state.external_id);
    if (!key) return true;
    return key === HIERARCHY_BOARD_STATE_KEYS.DESIGN_DEV_TODO;
  });
  return unstarted?.id;
};

export const ScrumbanSubIssuesActionButton = observer(function ScrumbanSubIssuesActionButton(props: Props) {
  const { issueId, customButton, customButtonClassName, disabled = false, issueServiceType } = props;
  const { t } = useTranslation();
  const {
    issue: { getIssueById },
    toggleSubIssuesModal,
    setIssueCrudOperationState,
    issueCrudOperationState,
    setLastWidgetAction,
  } = useIssueDetail(issueServiceType);
  const { workspaceSlug } = useParams() as { workspaceSlug: string };
  const { fetchProjectStates } = useProjectState();
  const { getActiveProjectTypes, fetchProjectTypes, fetchedMap } = useProjectHierarchyType();

  const issue = getIssueById(issueId);
  const projectId = issue?.project_id;
  const issueDepth = getIssueDepth(issue, getIssueById);
  const parentLevel = getHierarchyLevel(issue);
  const childLevel = getChildHierarchyLevel(issue);
  const allowAddSubTasks = canAddSubTasks(issueDepth, parentLevel);

  useEffect(() => {
    if (!workspaceSlug || !projectId || fetchedMap[projectId]) return;
    void fetchProjectTypes(workspaceSlug, projectId);
  }, [workspaceSlug, projectId, fetchedMap, fetchProjectTypes]);

  useEffect(() => {
    if (!workspaceSlug || !projectId) return;
    void fetchProjectStates(workspaceSlug, projectId);
  }, [workspaceSlug, projectId, fetchProjectStates]);

  if (!issue || !projectId) return <></>;
  if (!allowAddSubTasks) return <></>;

  const childTypes = getActiveProjectTypes(projectId, childLevel) ?? [];

  const handleCreateWithType = (typeId: string) => {
    setIssueCrudOperationState({
      ...issueCrudOperationState,
      create: {
        toggle: true,
        parentIssueId: issueId,
        issue: undefined,
        categoryId: typeId,
      },
    });
    setLastWidgetAction("sub-work-items");
  };

  const handleAddExisting = () => {
    setIssueCrudOperationState({
      ...issueCrudOperationState,
      existing: {
        toggle: true,
        parentIssueId: issueId,
        issue: undefined,
        categoryId: null,
      },
    });
    toggleSubIssuesModal(issue.id);
  };

  const customButtonElement = customButton ? <>{customButton}</> : <PlusIcon className="h-4 w-4" />;

  return (
    <CustomMenu
      customButton={customButtonElement}
      customButtonClassName={customButtonClassName}
      className={customButton ? "w-full" : undefined}
      placement="bottom-start"
      disabled={disabled}
      closeOnSelect
      ariaLabel={t(childCreateLabelKey(childLevel))}
    >
      {childTypes.map((item) => (
        <CustomMenu.MenuItem key={item.id} onClick={() => handleCreateWithType(item.id)}>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
            <span>{item.name}</span>
          </div>
        </CustomMenu.MenuItem>
      ))}
      <CustomMenu.MenuItem onClick={handleAddExisting}>
        <div className="flex items-center gap-2">
          <WorkItemsIcon className="h-3 w-3" />
          <span>{t("common.add_existing")}</span>
        </div>
      </CustomMenu.MenuItem>
    </CustomMenu>
  );
});
