/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import type {
  TBuildFilterExpressionParams,
  TFilterConditionForBuild,
  TFilterValue,
  TWorkItemFilterExpression,
  TWorkItemFilterProperty,
} from "@plane/types";
import { sanitizeAndStabilizeExpression } from "@plane/utils";
// local imports
import { workItemFiltersAdapter } from "../store/work-item-filters/adapter";
import { buildTempFilterExpressionFromConditions } from "./rich-filter.helper";

export type TWorkItemFilterCondition = TFilterConditionForBuild<TWorkItemFilterProperty, TFilterValue>;

/**
 * Builds a work item filter expression from conditions.
 * @param params.conditions - The conditions for building the filter expression.
 * @returns The work item filter expression.
 */
/**
 * Drops empty / blank filter values before API requests or persistence.
 * Saved user properties can contain `state_id__in: ""` from cleared pinned filters.
 */
export const sanitizeWorkItemRichFiltersForApi = (
  expression: TWorkItemFilterExpression | undefined
): TWorkItemFilterExpression => {
  if (!expression) return {};

  try {
    const internal = workItemFiltersAdapter.toInternal(expression);
    const sanitized = sanitizeAndStabilizeExpression(internal);
    if (!sanitized) return {};
    return workItemFiltersAdapter.toExternal(sanitized);
  } catch {
    return {};
  }
};

export const buildWorkItemFilterExpressionFromConditions = (
  params: Omit<
    TBuildFilterExpressionParams<TWorkItemFilterProperty, TFilterValue, TWorkItemFilterExpression>,
    "adapter"
  >
): TWorkItemFilterExpression | undefined => {
  const workItemFilterExpression = buildTempFilterExpressionFromConditions({
    ...params,
    adapter: workItemFiltersAdapter,
  });
  if (!workItemFilterExpression) console.error("Failed to build work item filter expression from conditions");
  return workItemFilterExpression;
};
