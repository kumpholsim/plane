/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TIssue, TIssueMap } from "@plane/types";

export const getIssuePinLevel = (issue: TIssue | undefined): number => {
  const level = issue?.pin_level ?? 0;
  if (level >= 2) return 2;
  if (level === 1) return 1;
  return 0;
};

const sortBySortOrder = (issueIds: string[], issuesMap: TIssueMap): string[] =>
  [...issueIds].toSorted((a, b) => {
    const issueA = issuesMap[a];
    const issueB = issuesMap[b];
    const pinA = getIssuePinLevel(issueA);
    const pinB = getIssuePinLevel(issueB);
    // Within high-priority: double pin above single pin
    if (pinA !== pinB) return pinB - pinA;
    const sortA = issueA?.sort_order ?? 0;
    const sortB = issueB?.sort_order ?? 0;
    if (sortA !== sortB) return sortA - sortB;
    return (issueA?.sequence_id ?? 0) - (issueB?.sequence_id ?? 0);
  });

export type TEpicListBand = {
  key: "high-priority" | "default";
  label: string | null;
  issueIds: string[];
};

/**
 * Flat epic list with an optional High Priority band for pinned items.
 * The High Priority section is omitted when nothing is pinned.
 */
export const buildEpicListBands = (issueIds: string[] | undefined, issuesMap: TIssueMap): TEpicListBand[] => {
  const pinned: string[] = [];
  const unpinned: string[] = [];
  const ids = Array.isArray(issueIds) ? issueIds : [];

  for (const id of ids) {
    if (getIssuePinLevel(issuesMap[id]) > 0) pinned.push(id);
    else unpinned.push(id);
  }

  const bands: TEpicListBand[] = [];

  if (pinned.length > 0) {
    bands.push({
      key: "high-priority",
      label: "High Priority",
      issueIds: sortBySortOrder(pinned, issuesMap),
    });
  }

  if (unpinned.length > 0 || pinned.length === 0) {
    bands.push({
      key: "default",
      label: null,
      issueIds: sortBySortOrder(unpinned, issuesMap),
    });
  }

  return bands;
};

/** @deprecated Prefer buildEpicListBands — kept for callers that need a flat id list */
export const sortEpicListIssueIds = (issueIds: string[] | undefined, issuesMap: TIssueMap): string[] =>
  buildEpicListBands(issueIds, issuesMap).flatMap((band) => band.issueIds);

/** DnD siblings: pinned vs unpinned reorder separately */
export const filterIssueIdsByPinBand = (
  issueIds: string[],
  isPinned: boolean,
  getIssueById: (issueId: string) => TIssue | undefined
): string[] =>
  issueIds.filter((id) => {
    const pinned = getIssuePinLevel(getIssueById(id)) > 0;
    return isPinned ? pinned : !pinned;
  });

export const filterIssueIdsByPinLevel = (
  issueIds: string[],
  pinLevel: number,
  getIssueById: (issueId: string) => TIssue | undefined
): string[] => issueIds.filter((id) => getIssuePinLevel(getIssueById(id)) === pinLevel);
