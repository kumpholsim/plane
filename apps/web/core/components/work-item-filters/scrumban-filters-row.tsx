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
import { useClearScrumbanPinnedFiltersOutsideLayouts } from "@/components/work-item-filters/use-clear-l3-category-filter";

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

/** Scrumban filter bar: L3 pinned filters only on list/board. */
export const ScrumbanWorkItemFiltersRow = observer(function ScrumbanWorkItemFiltersRow(props: Props) {
  const { filter, projectId, isPinnedFilterLayout, suppressedProperties, trackerElements } = props;
  useClearScrumbanPinnedFiltersOutsideLayouts(filter, isPinnedFilterLayout);

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
