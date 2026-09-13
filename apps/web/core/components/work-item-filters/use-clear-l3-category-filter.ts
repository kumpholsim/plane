/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect } from "react";
import type { IWorkItemFilterInstance } from "@plane/shared-state";
import { COLLECTION_OPERATOR } from "@plane/types";

/** Drop L3 Category filter when leaving list/board so it does not affect other layouts. */
export function useClearL3CategoryFilterOutsidePinnedLayouts(
  filter: IWorkItemFilterInstance | undefined,
  isPinnedFilterLayout: boolean
) {
  useEffect(() => {
    if (!filter || isPinnedFilterLayout) return;
    const condition = filter.findFirstConditionByPropertyAndOperator("hierarchy_type_id", COLLECTION_OPERATOR.IN);
    if (condition) filter.removeCondition(condition.id);
  }, [filter, isPinnedFilterLayout]);
}
