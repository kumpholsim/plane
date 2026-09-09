/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane imports
import type { IWorkItemFilterInstance } from "@plane/shared-state";
import type { TWorkItemFilterExpression, TWorkItemFilterProperty } from "@plane/types";
// components
import { GroupExpandCollapseControls } from "@/components/issues/issue-layouts/expand-collapse";
import type { TFiltersRowProps } from "@/components/rich-filters/filters-row";
import { FiltersRow } from "@/components/rich-filters/filters-row";

type TWorkItemFiltersRowProps = TFiltersRowProps<TWorkItemFilterProperty, TWorkItemFilterExpression> & {
  filter: IWorkItemFilterInstance;
};

export const WorkItemFiltersRow = observer(function WorkItemFiltersRow(props: TWorkItemFiltersRowProps) {
  const { filter, leadingControls, ...rest } = props;
  const showExpandCollapse = filter.pinnedProperties.length > 0 && !leadingControls;

  return (
    <FiltersRow
      {...rest}
      filter={filter}
      leadingControls={leadingControls ?? (showExpandCollapse ? <GroupExpandCollapseControls /> : undefined)}
    />
  );
});
