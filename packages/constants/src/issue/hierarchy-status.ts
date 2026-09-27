/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

/** Stable State.external_id prefix for hierarchy board columns */
export const HIERARCHY_BOARD_STATE_PREFIX = "hierarchy_board:";

export const HIERARCHY_BOARD_STATE_KEYS = {
  DESIGN_DEV_TODO: "design_dev_todo",
  DESIGN_DEV_IN_PROGRESS: "design_dev_in_progress",
  DESIGN_DEV_UNDER_REVIEW: "design_dev_under_review",
  DONE: "done",
  /** @deprecated Soft-deleted; kept for legacy external_id parsing */
  QA_TODO: "qa_todo",
  /** @deprecated Soft-deleted; kept for legacy external_id parsing */
  QA_IN_PROGRESS: "qa_in_progress",
} as const;

export type THierarchyBoardStateKey = (typeof HIERARCHY_BOARD_STATE_KEYS)[keyof typeof HIERARCHY_BOARD_STATE_KEYS];

/** Shared L4 board columns for Design, Dev, and QA */
export const L4_BOARD_KEYS: THierarchyBoardStateKey[] = [
  HIERARCHY_BOARD_STATE_KEYS.DESIGN_DEV_TODO,
  HIERARCHY_BOARD_STATE_KEYS.DESIGN_DEV_IN_PROGRESS,
  HIERARCHY_BOARD_STATE_KEYS.DESIGN_DEV_UNDER_REVIEW,
  HIERARCHY_BOARD_STATE_KEYS.DONE,
];

/** @deprecated Use L4_BOARD_KEYS — all L4 types share the same columns */
export const DESIGN_DEV_BOARD_KEYS = L4_BOARD_KEYS;

/** @deprecated Use L4_BOARD_KEYS — all L4 types share the same columns */
export const QA_BOARD_KEYS = L4_BOARD_KEYS;

export const L3_PROGRESS_STATUS_OPTIONS = [
  { value: "design_todo", label: "Design To Do", phase: "design", exitGate: false },
  { value: "design_in_progress", label: "Design In Progress", phase: "design", exitGate: false },
  { value: "design_under_review", label: "Design Under Review", phase: "design", exitGate: false },
  { value: "design_done", label: "Design Done", phase: "design", exitGate: false },
  { value: "design_done_no_dev", label: "Design Done (No Dev Needed)", phase: "design", exitGate: true },
  { value: "dev_todo", label: "Dev To Do", phase: "dev", exitGate: false },
  { value: "dev_in_progress", label: "Dev In Progress", phase: "dev", exitGate: false },
  { value: "dev_under_review", label: "Dev Under Review", phase: "dev", exitGate: false },
  { value: "dev_done", label: "Dev Done", phase: "dev", exitGate: false },
  { value: "dev_done_no_qa", label: "Dev Done (No QA Needed)", phase: "dev", exitGate: true },
  { value: "qa_todo", label: "QA To Do", phase: "qa", exitGate: false },
  { value: "qa_in_progress", label: "QA In Progress", phase: "qa", exitGate: false },
  { value: "qa_done", label: "QA Done", phase: "qa", exitGate: true },
] as const;

export type TL3ProgressPhase = (typeof L3_PROGRESS_STATUS_OPTIONS)[number]["phase"];

/** Terminal L3 exit gates only — Design Done / Dev Done are intermediate and not included. */
export const L3_EXIT_GATE_PROGRESS_STATUSES = L3_PROGRESS_STATUS_OPTIONS.filter((option) => option.exitGate).map(
  (option) => option.value
);

/** Fallback colors matching default L4 Design / Dev / QA hierarchy types */
export const L3_PROGRESS_PHASE_FALLBACK_COLORS: Record<TL3ProgressPhase, string> = {
  design: "#F97316",
  dev: "#3B82F6",
  qa: "#22C55E",
};

/** L4 board column labels (project states) — order matters */
export const L4_BOARD_STATE_OPTIONS = [
  { key: "design_dev_todo", label: "To Do" },
  { key: "design_dev_in_progress", label: "In Progress" },
  { key: "design_dev_under_review", label: "Under Review" },
  { key: "done", label: "Done" },
] as const;

export const QA_OUTCOME_OPTIONS = [
  { value: "pass", label: "Done pass" },
  { value: "failed", label: "Done failed" },
] as const;

export const boardStateKeyFromExternalId = (externalId: string | null | undefined): THierarchyBoardStateKey | null => {
  if (!externalId?.startsWith(HIERARCHY_BOARD_STATE_PREFIX)) return null;
  return externalId.slice(HIERARCHY_BOARD_STATE_PREFIX.length) as THierarchyBoardStateKey;
};
