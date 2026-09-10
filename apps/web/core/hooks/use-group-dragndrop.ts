/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useParams } from "next/navigation";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { EIssuesStoreType, TIssue, TIssueGroupByOptions, TIssueOrderByOptions } from "@plane/types";
import { getL4LeaveTodoRequirementError } from "@/components/issues/hierarchy-status";
import { filterIssueIdsByPinBand, getIssuePinLevel } from "@/components/issues/issue-layouts/list/epic-list-sections";
import type { GroupDropLocation } from "@/components/issues/issue-layouts/utils";
import { handleGroupDragDrop } from "@/components/issues/issue-layouts/utils";
import { ISSUE_FILTER_DEFAULT_DATA } from "@/store/issue/helpers/base-issues.store";
import { useIssueDetail } from "./store/use-issue-detail";
import { useIssues } from "./store/use-issues";
import { useProjectHierarchyType } from "./store/use-project-hierarchy-type";
import { useProjectState } from "./store/use-project-state";
import { useIssuesActions } from "./use-issues-actions";
import { useIsStagedGateScrumban } from "./use-workflow-mode";

type DNDStoreType =
  | EIssuesStoreType.PROJECT
  | EIssuesStoreType.MODULE
  | EIssuesStoreType.CYCLE
  | EIssuesStoreType.PROJECT_VIEW
  | EIssuesStoreType.PROFILE
  | EIssuesStoreType.ARCHIVED
  | EIssuesStoreType.WORKSPACE_DRAFT
  | EIssuesStoreType.TEAM
  | EIssuesStoreType.TEAM_VIEW
  | EIssuesStoreType.EPIC
  | EIssuesStoreType.TEAM_PROJECT_WORK_ITEMS;

export const useGroupIssuesDragNDrop = (
  storeType: DNDStoreType,
  orderBy: TIssueOrderByOptions | undefined,
  groupBy: TIssueGroupByOptions | undefined,
  subGroupBy?: TIssueGroupByOptions
) => {
  const { workspaceSlug } = useParams();

  const {
    issue: { getIssueById },
  } = useIssueDetail();
  const { updateIssue } = useIssuesActions(storeType);
  const {
    issues: { getIssueIds, addCycleToIssue, removeCycleFromIssue, changeModulesInIssue },
  } = useIssues(storeType);
  const { getStateById } = useProjectState();
  const { getTypeById } = useProjectHierarchyType();
  const isStagedGateScrumban = useIsStagedGateScrumban();

  /**
   * update Issue on Drop, checks if modules or cycles are changed and then calls appropriate functions
   * @param projectId
   * @param issueId
   * @param data
   * @param issueUpdates
   */
  const updateIssueOnDrop = async (
    projectId: string,
    issueId: string,
    data: Partial<TIssue>,
    issueUpdates: {
      [groupKey: string]: {
        ADD: string[];
        REMOVE: string[];
      };
    }
  ) => {
    const errorToastProps = {
      type: TOAST_TYPE.ERROR,
      title: "Error!",
      message: "Error while updating work item",
    };
    const moduleKey = ISSUE_FILTER_DEFAULT_DATA["module"];
    const cycleKey = ISSUE_FILTER_DEFAULT_DATA["cycle"];

    const isModuleChanged = Object.keys(data).includes(moduleKey);
    const isCycleChanged = Object.keys(data).includes(cycleKey);

    if (isCycleChanged && workspaceSlug) {
      if (data[cycleKey]) {
        addCycleToIssue(workspaceSlug.toString(), projectId, data[cycleKey]?.toString() ?? "", issueId).catch(() =>
          setToast(errorToastProps)
        );
      } else {
        removeCycleFromIssue(workspaceSlug.toString(), projectId, issueId).catch(() => setToast(errorToastProps));
      }
      delete data[cycleKey];
    }

    if (isModuleChanged && workspaceSlug && issueUpdates[moduleKey]) {
      if (isStagedGateScrumban) {
        // Group-by "module" is Epic (L2) in Scrumban — moving between columns reparents the item
        const addIds = issueUpdates[moduleKey].ADD;
        const newEpicId = addIds.find((id) => id && id !== "None") ?? null;
        data.parent_id = newEpicId;
        // Keep module_ids as the epic id so client-side epic grouping stays in sync
        data.module_ids = newEpicId ? [newEpicId] : [];
      } else {
        changeModulesInIssue(
          workspaceSlug.toString(),
          projectId,
          issueId,
          issueUpdates[moduleKey].ADD,
          issueUpdates[moduleKey].REMOVE
        ).catch(() => setToast(errorToastProps));
        delete data[moduleKey];
      }
    }

    if (updateIssue) {
      await updateIssue(projectId, issueId, data).catch((err) => {
        const apiMessage =
          err?.error ||
          err?.detail ||
          err?.state_id?.[0] ||
          (typeof err?.state_id === "string" ? err.state_id : undefined);
        setToast({
          ...errorToastProps,
          message: apiMessage || errorToastProps.message,
        });
      });
    }
  };

  const handleOnDrop = async (source: GroupDropLocation, destination: GroupDropLocation) => {
    if (
      source.columnId &&
      destination.columnId &&
      destination.columnId === source.columnId &&
      destination.id === source.id
    )
      return;

    const sourceIssue = source.id ? getIssueById(source.id) : undefined;
    const destinationIssue = destination.id ? getIssueById(destination.id) : undefined;

    // Scrumban: Dev/QA cannot leave To Do without assignee + estimate
    if (
      isStagedGateScrumban &&
      sourceIssue &&
      groupBy === "state" &&
      source.groupId &&
      destination.groupId &&
      source.groupId !== destination.groupId
    ) {
      const hierarchyType = getTypeById(sourceIssue.hierarchy_type_id ?? sourceIssue.sub_work_item_category_id ?? "");
      const leaveTodoError = getL4LeaveTodoRequirementError({
        hierarchyLevel: sourceIssue.hierarchy_level,
        hierarchyTypeName: hierarchyType?.name,
        currentStateExternalId: getStateById(source.groupId)?.external_id,
        nextStateExternalId: getStateById(destination.groupId)?.external_id,
        currentStateId: source.groupId,
        nextStateId: destination.groupId,
        assigneeIds: sourceIssue.assignee_ids,
        estimatePoint: sourceIssue.estimate_point ?? null,
      });
      if (leaveTodoError) {
        setToast({
          type: TOAST_TYPE.WARNING,
          title: "Cannot move work item",
          message: leaveTodoError,
        });
        return;
      }
    }

    // Epic list: reorder only within High Priority (pinned) or the unpinned band
    if (isStagedGateScrumban && groupBy === "module" && source.groupId === destination.groupId && sourceIssue) {
      if (destinationIssue) {
        const sourcePinned = getIssuePinLevel(sourceIssue) > 0;
        const destinationPinned = getIssuePinLevel(destinationIssue) > 0;
        if (sourcePinned !== destinationPinned) {
          setToast({
            type: TOAST_TYPE.WARNING,
            title: "Cannot move work item",
            message: "Use the pin controls to move items in or out of High Priority",
          });
          return;
        }
      }
    }

    const getPinAwareIssueIds = (groupId?: string, subGroupId?: string) => {
      const ids = getIssueIds(groupId, subGroupId);
      if (!isStagedGateScrumban || groupBy !== "module" || !sourceIssue || !ids) return ids;
      if (source.groupId !== destination.groupId) return ids;
      return filterIssueIdsByPinBand(ids, getIssuePinLevel(sourceIssue) > 0, getIssueById);
    };

    await handleGroupDragDrop(
      source,
      destination,
      getIssueById,
      getPinAwareIssueIds,
      updateIssueOnDrop,
      groupBy,
      subGroupBy,
      orderBy !== "sort_order"
    ).catch((err) => {
      setToast({
        title: "Error!",
        type: TOAST_TYPE.ERROR,
        message: err?.detail ?? "Failed to perform this action",
      });
    });
  };

  return handleOnDrop;
};
