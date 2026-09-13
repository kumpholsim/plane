/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect } from "react";
import { PINNED_WORK_ITEM_HEADER_FILTER_PROPERTIES } from "@plane/constants";
import type { IWorkItemFilterInstance } from "@plane/shared-state";
import type { TWorkItemFilterProperty } from "@plane/types";
import { COLLECTION_OPERATOR } from "@plane/types";

/** Scrumban L3 pinned filters (Category / State / Assignees) — list & board only. */
export const SCRUMBAN_PINNED_FILTER_PROPERTIES: TWorkItemFilterProperty[] = [
  ...PINNED_WORK_ITEM_HEADER_FILTER_PROPERTIES,
];

/** Drop list/board L3 pinned filters when on calendar, table, or timeline. */
export function useClearScrumbanPinnedFiltersOutsideLayouts(
  filter: IWorkItemFilterInstance | undefined,
  isPinnedFilterLayout: boolean
) {
  useEffect(() => {
    if (!filter || isPinnedFilterLayout) return;
    for (const property of SCRUMBAN_PINNED_FILTER_PROPERTIES) {
      const condition = filter.findFirstConditionByPropertyAndOperator(property, COLLECTION_OPERATOR.IN);
      if (condition) filter.removeCondition(condition.id);
    }
  }, [filter, isPinnedFilterLayout]);
}
