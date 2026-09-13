/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import type { IWorkItemFilterInstance } from "@plane/shared-state";
import type { TWorkItemFilterProperty } from "@plane/types";
import { WorkItemFiltersRow } from "@/components/work-item-filters/filters-row";
import { WorkItemPinnedFilters } from "@/components/work-item-filters/pinned-filters";
import { useClearL3CategoryFilterOutsidePinnedLayouts } from "@/components/work-item-filters/use-clear-l3-category-filter";

type Props = {
  filter: IWorkItemFilterInstance | undefined;
  projectId: string;
  isPinnedFilterLayout: boolean;
  suppressedProperties: TWorkItemFilterProperty[] | undefined;
  trackerElements?: {
    saveView?: string;
    clearFilter?: string;
    updateView?: string;
  };
};

/** Scrumban filter bar: L3 Category only on list/board; clears it on other layouts. */
export const ScrumbanWorkItemFiltersRow = observer(function ScrumbanWorkItemFiltersRow(props: Props) {
  const { filter, projectId, isPinnedFilterLayout, suppressedProperties, trackerElements } = props;
  useClearL3CategoryFilterOutsidePinnedLayouts(filter, isPinnedFilterLayout);

  if (!filter) return null;

  return (
    <WorkItemFiltersRow
      filter={filter}
      leadingControls={
        isPinnedFilterLayout ? <WorkItemPinnedFilters filter={filter} projectId={projectId} /> : undefined
      }
      suppressProperties={suppressedProperties}
      trackerElements={trackerElements}
    />
  );
});
