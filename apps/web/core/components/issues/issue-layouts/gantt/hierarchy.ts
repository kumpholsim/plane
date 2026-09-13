/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TIssue } from "@plane/types";
import { HIERARCHY_LEVEL_DELIVERY, HIERARCHY_LEVEL_EPIC, HIERARCHY_LEVEL_SUB_TASK } from "@plane/types";
import { getHierarchyLevel } from "@/components/issues/issue-detail-widgets/sub-issues/depth";

export type TGanttHierarchyMode = "l2_l3" | "l3_l4";

export type TGanttHierarchyMeta = {
  depth: 0 | 1;
  parentId: string | null;
  hasChildren: boolean;
  childIds: string[];
};

type TBuildArgs = {
  issueIds: string[];
  getIssueById: (id: string) => TIssue | undefined;
  mode: TGanttHierarchyMode;
  expandedIds: Set<string>;
};

const sortBySortOrder = (a: TIssue, b: TIssue) => (a.sort_order ?? 0) - (b.sort_order ?? 0);

/** Min start / max target across children for parent timeline bars. */
export const rollupChildDates = (
  childIds: string[],
  getIssueById: (id: string) => TIssue | undefined
): { start_date?: string; target_date?: string } => {
  const starts: string[] = [];
  const ends: string[] = [];
  for (const id of childIds) {
    const issue = getIssueById(id);
    if (issue?.start_date) starts.push(issue.start_date);
    if (issue?.target_date) ends.push(issue.target_date);
  }
  const sortedStarts = starts.toSorted();
  const sortedEnds = ends.toSorted();
  return {
    start_date: sortedStarts[0],
    target_date: sortedEnds[sortedEnds.length - 1],
  };
};

/**
 * Build flat gantt block order with optional nested children for Scrumban hierarchy modes.
 * - l2_l3: Epic (L2) rows with Delivery (L3) children
 * - l3_l4: Delivery (L3) rows with Sub-task (L4) children
 */
export const buildScrumbanGanttHierarchy = (
  args: TBuildArgs
): {
  blockIds: string[];
  metaById: Record<string, TGanttHierarchyMeta>;
  parentChildMap: Record<string, string[]>;
} => {
  const { issueIds, getIssueById, mode, expandedIds } = args;
  const issues = issueIds.map((id) => getIssueById(id)).filter((issue): issue is TIssue => !!issue);

  const metaById: Record<string, TGanttHierarchyMeta> = {};
  const parentChildMap: Record<string, string[]> = {};
  const blockIds: string[] = [];

  if (mode === "l3_l4") {
    const parents = issues
      .filter((issue) => getHierarchyLevel(issue) === HIERARCHY_LEVEL_DELIVERY)
      .toSorted(sortBySortOrder);
    const childrenByParent = new Map<string, TIssue[]>();
    const orphanChildren: TIssue[] = [];

    for (const issue of issues) {
      if (getHierarchyLevel(issue) !== HIERARCHY_LEVEL_SUB_TASK) continue;
      if (issue.parent_id) {
        const list = childrenByParent.get(issue.parent_id) ?? [];
        list.push(issue);
        childrenByParent.set(issue.parent_id, list);
      } else {
        orphanChildren.push(issue);
      }
    }

    for (const parent of parents) {
      const children = (childrenByParent.get(parent.id) ?? []).toSorted(sortBySortOrder);
      const childIds = children.map((child) => child.id);
      parentChildMap[parent.id] = childIds;
      metaById[parent.id] = {
        depth: 0,
        parentId: null,
        hasChildren: childIds.length > 0,
        childIds,
      };
      blockIds.push(parent.id);
      if (expandedIds.has(parent.id)) {
        for (const child of children) {
          metaById[child.id] = {
            depth: 1,
            parentId: parent.id,
            hasChildren: false,
            childIds: [],
          };
          blockIds.push(child.id);
        }
      }
    }

    for (const child of orphanChildren.toSorted(sortBySortOrder)) {
      metaById[child.id] = {
        depth: 0,
        parentId: null,
        hasChildren: false,
        childIds: [],
      };
      blockIds.push(child.id);
    }

    return { blockIds, metaById, parentChildMap };
  }

  // l2_l3 — Epics with Delivery children (ignore L4 in the timeline)
  const deliveries = issues
    .filter((issue) => getHierarchyLevel(issue) === HIERARCHY_LEVEL_DELIVERY)
    .toSorted(sortBySortOrder);
  const deliveriesByEpic = new Map<string, TIssue[]>();
  const ungrouped: TIssue[] = [];

  for (const delivery of deliveries) {
    if (delivery.parent_id) {
      const list = deliveriesByEpic.get(delivery.parent_id) ?? [];
      list.push(delivery);
      deliveriesByEpic.set(delivery.parent_id, list);
    } else {
      ungrouped.push(delivery);
    }
  }

  const epicIds = Array.from(deliveriesByEpic.keys()).toSorted((a, b) => {
    const epicA = getIssueById(a);
    const epicB = getIssueById(b);
    return (epicA?.sort_order ?? 0) - (epicB?.sort_order ?? 0) || (epicA?.name ?? "").localeCompare(epicB?.name ?? "");
  });

  for (const epicId of epicIds) {
    const children = (deliveriesByEpic.get(epicId) ?? []).toSorted(sortBySortOrder);
    const childIds = children.map((child) => child.id);
    parentChildMap[epicId] = childIds;
    metaById[epicId] = {
      depth: 0,
      parentId: null,
      hasChildren: childIds.length > 0,
      childIds,
    };
    blockIds.push(epicId);
    if (expandedIds.has(epicId)) {
      for (const child of children) {
        metaById[child.id] = {
          depth: 1,
          parentId: epicId,
          hasChildren: false,
          childIds: [],
        };
        blockIds.push(child.id);
      }
    }
  }

  for (const delivery of ungrouped) {
    metaById[delivery.id] = {
      depth: 0,
      parentId: null,
      hasChildren: false,
      childIds: [],
    };
    blockIds.push(delivery.id);
  }

  return { blockIds, metaById, parentChildMap };
};

/** Ensure epic placeholders exist in the issue map with rolled-up dates for timeline bars. */
export const ensureGanttEpicPlaceholders = (args: {
  parentChildMap: Record<string, string[]>;
  getIssueById: (id: string) => TIssue | undefined;
  addIssue: (issues: TIssue[]) => void;
  projectId: string | undefined;
}) => {
  const { parentChildMap, getIssueById, addIssue, projectId } = args;
  const toUpsert: TIssue[] = [];

  for (const [parentId, childIds] of Object.entries(parentChildMap)) {
    const existing = getIssueById(parentId);
    const rollup = rollupChildDates(childIds, getIssueById);
    const sampleChild = childIds.map((id) => getIssueById(id)).find(Boolean);
    const resolvedProjectId = existing?.project_id ?? sampleChild?.project_id ?? projectId;
    if (!resolvedProjectId) continue;

    if (!existing) {
      toUpsert.push({
        id: parentId,
        name: "Epic",
        project_id: resolvedProjectId,
        hierarchy_level: HIERARCHY_LEVEL_EPIC,
        is_epic: true,
        start_date: rollup.start_date ?? null,
        target_date: rollup.target_date ?? null,
        sequence_id: 0,
        sort_order: 0,
        state_id: sampleChild?.state_id ?? null,
        priority: "none",
        label_ids: [],
        assignee_ids: [],
        module_ids: [],
      } as TIssue);
      continue;
    }

    const needsStart = !existing.start_date && rollup.start_date;
    const needsTarget = !existing.target_date && rollup.target_date;
    if (needsStart || needsTarget) {
      toUpsert.push({
        ...existing,
        start_date: existing.start_date ?? rollup.start_date ?? null,
        target_date: existing.target_date ?? rollup.target_date ?? null,
      });
    }
  }

  if (toUpsert.length) addIssue(toUpsert);
};
