/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import {
  DESIGN_DEV_BOARD_KEYS,
  L3_PROGRESS_STATUS_OPTIONS,
  QA_BOARD_KEYS,
  boardStateKeyFromExternalId,
  type THierarchyBoardStateKey,
} from "@plane/constants";
import type { IState, TIssueMap } from "@plane/types";

export const isQaHierarchyTypeName = (name: string | null | undefined): boolean =>
  (name ?? "").trim().toLowerCase() === "qa";

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
export const L3_TERMINAL_DONE_COLOR = "#16A34A";

export const getL3ProgressStatusColor = (
  progressStatus: string | null | undefined,
  phaseColors: Record<string, string>
): string => {
  if (isL3DoneProgressStatus(progressStatus)) return L3_TERMINAL_DONE_COLOR;
  const option = L3_PROGRESS_STATUS_OPTIONS.find((item) => item.value === progressStatus);
  return option ? (phaseColors[option.phase] ?? "var(--text-color-tertiary)") : "var(--text-color-tertiary)";
};
