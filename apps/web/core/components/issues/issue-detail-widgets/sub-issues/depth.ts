/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { MAX_SUB_TASK_DEPTH } from "@plane/constants";
import type { TIssue } from "@plane/types";
import {
  HIERARCHY_LEVEL_DELIVERY,
  HIERARCHY_LEVEL_EPIC,
  HIERARCHY_LEVEL_MILESTONE,
  HIERARCHY_LEVEL_SUB_TASK,
} from "@plane/types";

/**
 * Count ancestors for an issue (0 = top-level work item).
 */
export const getIssueDepth = (
  issue: TIssue | undefined | null,
  getIssueById: (id: string) => TIssue | undefined
): number => {
  let depth = 0;
  let current = issue;
  const visited = new Set<string>();

  while (current?.parent_id) {
    if (visited.has(current.parent_id)) break;
    visited.add(current.parent_id);
    depth += 1;
    current = getIssueById(current.parent_id);
    if (depth > 50) break;
  }

  return depth;
};

/** Hierarchy level on the issue (default delivery / L3; epics → L2). */
export const getHierarchyLevel = (issue: TIssue | undefined | null): number => {
  if (issue?.hierarchy_level != null && issue.hierarchy_level !== "") {
    const level = Number(issue.hierarchy_level);
    if (!Number.isNaN(level) && level > 0) return level;
  }
  if (issue?.is_epic) return HIERARCHY_LEVEL_EPIC;
  return HIERARCHY_LEVEL_DELIVERY;
};

/** Milestone (L1) or Epic (L2) — owned by the Modules tab. */
export const isModulesTabWorkItem = (issue: TIssue | undefined | null): boolean => {
  if (!issue) return false;
  if (issue.is_epic) return true;
  const level = getHierarchyLevel(issue);
  return level === HIERARCHY_LEVEL_MILESTONE || level === HIERARCHY_LEVEL_EPIC;
};

/** Epic for detail/service routing (legacy is_epic or hierarchy L2). */
export const isEpicWorkItem = (issue: TIssue | undefined | null): boolean => {
  if (!issue) return false;
  if (issue.is_epic) return true;
  return getHierarchyLevel(issue) === HIERARCHY_LEVEL_EPIC;
};

/** Next child level under parent (capped at sub-task). */
export const getChildHierarchyLevel = (parent: TIssue | undefined | null): number =>
  Math.min(getHierarchyLevel(parent) + 1, HIERARCHY_LEVEL_SUB_TASK);

/** Whether more children can be added under this issue. */
export const canAddSubTasks = (depth: number, hierarchyLevel?: number): boolean => {
  if (hierarchyLevel != null && hierarchyLevel >= HIERARCHY_LEVEL_SUB_TASK) return false;
  return depth < MAX_SUB_TASK_DEPTH;
};

export const childCreateLabelKey = (childLevel: number): string => {
  switch (childLevel) {
    case 2:
      return "issue.add.child_level_2";
    case 3:
      return "issue.add.child_level_3";
    case 4:
    default:
      return "issue.add.sub_issue";
  }
};

export const childrenSectionTitleKey = (parentLevel: number, isEpicService: boolean): string => {
  if (isEpicService) return "issue.label";
  switch (parentLevel) {
    case 1:
      return "issue.children.level_2";
    case 2:
      return "issue.children.level_3";
    case 3:
    default:
      return "common.sub_work_items";
  }
};

/** L3 delivery and L4 sub-tasks can assign cycle; L1/L2 cannot. */
export const canEditCycle = (level: number | null | undefined): boolean =>
  level === HIERARCHY_LEVEL_DELIVERY || level === HIERARCHY_LEVEL_SUB_TASK;

/** L4 may inherit cycle from L3 when unset — still editable. */
export const inheritsCycleFromParent = (level: number | null | undefined): boolean =>
  level === HIERARCHY_LEVEL_SUB_TASK;

/** Whether the cycle property should appear (L3 and L4). */
export const shouldShowCycleProperty = (level: number | null | undefined): boolean => canEditCycle(level);

/** Milestones (L1) are always roots — they cannot have a parent. */
export const canHaveParent = (issue: TIssue | undefined | null): boolean =>
  getHierarchyLevel(issue) > HIERARCHY_LEVEL_MILESTONE;

/** L4 sub-tasks keep a fixed L3 parent — show parent, but do not allow changing it. */
export const canChangeParent = (issue: TIssue | undefined | null): boolean =>
  canHaveParent(issue) && getHierarchyLevel(issue) < HIERARCHY_LEVEL_SUB_TASK;

/**
 * Resolve ancestor epic id for display/filter: self (L2), parent (L3), or grandparent (L4).
 * Falls back to ``module_ids[0]`` when present (API may annotate epic id there).
 */
export const getAncestorEpicId = (
  issue: TIssue | undefined | null,
  getIssueById?: (id: string) => TIssue | undefined
): string | null => {
  if (!issue) return null;
  const level = getHierarchyLevel(issue);
  if (level === HIERARCHY_LEVEL_EPIC) return issue.id;
  if (level === HIERARCHY_LEVEL_DELIVERY) return issue.parent_id ?? null;
  if (level === HIERARCHY_LEVEL_SUB_TASK) {
    if (issue.parent_id && getIssueById) {
      const parent = getIssueById(issue.parent_id);
      if (parent?.parent_id) return parent.parent_id;
      if (parent && getHierarchyLevel(parent) === HIERARCHY_LEVEL_EPIC) return parent.id;
    }
    return issue.module_ids?.[0] ?? null;
  }
  return issue.module_ids?.[0] ?? null;
};
