/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import {
  DESIGN_DEV_BOARD_KEYS,
  HIERARCHY_BOARD_STATE_KEYS,
  L3_PROGRESS_STATUS_OPTIONS,
  QA_BOARD_KEYS,
  boardStateKeyFromExternalId,
  type THierarchyBoardStateKey,
} from "@plane/constants";
import type { IState, TIssueMap } from "@plane/types";

export const isQaHierarchyTypeName = (name: string | null | undefined): boolean =>
  (name ?? "").trim().toLowerCase() === "qa";

export const isDevHierarchyTypeName = (name: string | null | undefined): boolean =>
  (name ?? "").trim().toLowerCase() === "dev";

export const isDevOrQaHierarchyTypeName = (name: string | null | undefined): boolean =>
  isDevHierarchyTypeName(name) || isQaHierarchyTypeName(name);

export const todoBoardKeyForL4Type = (hierarchyTypeName: string | null | undefined): THierarchyBoardStateKey =>
  isQaHierarchyTypeName(hierarchyTypeName)
    ? HIERARCHY_BOARD_STATE_KEYS.QA_TODO
    : HIERARCHY_BOARD_STATE_KEYS.DESIGN_DEV_TODO;

export const L4_LEAVE_TODO_REQUIRES_ASSIGNEE_AND_ESTIMATE =
  "Add an assignee and estimate before moving this sub-task out of To Do.";

/** Dev/QA L4 cannot leave their To Do column without both assignee and estimate. */
export const getL4LeaveTodoRequirementError = (params: {
  hierarchyLevel?: number | string | null;
  hierarchyTypeName?: string | null;
  currentStateExternalId?: string | null;
  nextStateExternalId?: string | null;
  currentStateId?: string | null;
  nextStateId?: string | null;
  assigneeIds?: string[] | null;
  estimatePoint?: string | null;
}): string | null => {
  const {
    hierarchyLevel,
    hierarchyTypeName,
    currentStateExternalId,
    nextStateExternalId,
    currentStateId,
    nextStateId,
    assigneeIds,
    estimatePoint,
  } = params;

  if (Number(hierarchyLevel ?? 0) !== 4 || !isDevOrQaHierarchyTypeName(hierarchyTypeName)) return null;

  const todoKey = todoBoardKeyForL4Type(hierarchyTypeName);
  const currentKey = boardStateKeyFromExternalId(currentStateExternalId);
  const nextKey = boardStateKeyFromExternalId(nextStateExternalId);

  if (currentKey !== todoKey) return null;
  if (nextKey === todoKey || (currentStateId && nextStateId && currentStateId === nextStateId)) return null;

  const hasAssignee = (assigneeIds?.length ?? 0) > 0;
  const hasEstimate = Boolean(estimatePoint);
  if (hasAssignee && hasEstimate) return null;

  return L4_LEAVE_TODO_REQUIRES_ASSIGNEE_AND_ESTIMATE;
};

export const allowedBoardKeysForL4Type = (hierarchyTypeName: string | null | undefined): THierarchyBoardStateKey[] =>
  isQaHierarchyTypeName(hierarchyTypeName) ? [...QA_BOARD_KEYS] : [...DESIGN_DEV_BOARD_KEYS];

export const filterStateIdsForL4 = (
  stateIds: string[],
  getStateById: (id: string | null | undefined) => IState | undefined,
  hierarchyTypeName: string | null | undefined
): string[] => {
  const allowed = new Set(allowedBoardKeysForL4Type(hierarchyTypeName));
  const filtered = stateIds.filter((id) => {
    const state = getStateById(id);
    if (!state) return false;
    const key = boardStateKeyFromExternalId(state.external_id);
    // If project has no hierarchy board markers yet, keep all states
    if (key === null) {
      const anyHierarchyBoard = stateIds.some(
        (sid) => boardStateKeyFromExternalId(getStateById(sid)?.external_id) !== null
      );
      return !anyHierarchyBoard;
    }
    return allowed.has(key);
  });
  return filtered.length > 0 ? filtered : stateIds;
};

export const isDoneBoardState = (state: IState | undefined): boolean =>
  boardStateKeyFromExternalId(state?.external_id) === "done" ||
  (state?.group === "completed" && (state?.name ?? "").toLowerCase() === "done");

export const L3_DONE_PROGRESS_STATUSES = new Set(["design_done_no_dev", "dev_done_no_qa", "qa_done"]);

export const isL3DoneProgressStatus = (progressStatus: string | null | undefined): boolean =>
  !!progressStatus && L3_DONE_PROGRESS_STATUSES.has(progressStatus);

/**
 * UI approximation of backend "fully done" for cycle list highlighting:
 * L3 is in a terminal done-progress status and every loaded L4 child is in a completed state.
 */
export const isFullyDoneL3ForCycleHighlight = (
  issue: {
    id: string;
    hierarchy_level?: number | string | null;
    progress_status?: string | null;
    sub_issues_count?: number | null;
  },
  issuesMap: TIssueMap
): boolean => {
  if (Number(issue.hierarchy_level ?? 3) !== 3) return false;
  if (!isL3DoneProgressStatus(issue.progress_status)) return false;

  const l4Children = Object.values(issuesMap).filter(
    (candidate) => candidate?.parent_id === issue.id && Number(candidate?.hierarchy_level ?? 3) === 4
  );
  const expectedChildren = issue.sub_issues_count ?? 0;
  if (expectedChildren > 0 && l4Children.length < expectedChildren) return false;
  if (l4Children.length === 0) return true;

  return l4Children.every((child) => child.state__group === "completed");
};

export const L3_TERMINAL_DONE_STATUSES = ["design_done_no_dev", "dev_done_no_qa", "qa_done"] as const;

/** Dot / accent color: always the phase color (design / dev / qa). */
export const getL3ProgressStatusColor = (
  progressStatus: string | null | undefined,
  phaseColors: Record<string, string>
): string => {
  const option = L3_PROGRESS_STATUS_OPTIONS.find((item) => item.value === progressStatus);
  return option ? (phaseColors[option.phase] ?? "var(--text-color-tertiary)") : "var(--text-color-tertiary)";
};

/** Soft green row background only for the three terminal done statuses. */
export const getL3ProgressStatusOptionClassName = (progressStatus: string | null | undefined): string =>
  isL3DoneProgressStatus(progressStatus) ? "bg-success-subtle" : "";
