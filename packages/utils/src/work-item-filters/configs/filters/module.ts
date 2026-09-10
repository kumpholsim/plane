/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import type { TFilterProperty } from "@plane/types";
import { EQUALITY_OPERATOR, COLLECTION_OPERATOR } from "@plane/types";
// local imports
import type { TCreateFilterConfigParams, IFilterIconConfig, TCreateFilterConfig } from "../../../rich-filters";
import { createFilterConfig, getMultiSelectConfig, createOperatorConfigEntry } from "../../../rich-filters";

/** Minimal option shape for the ``module_id`` filter — a module on classic, an epic on Scrumban. */
export type TEpicFilterOption = {
  id: string;
  name: string;
};

/**
 * Module filter specific params. Scrumban reuses the ``module_id`` property key for epics.
 */
export type TCreateModuleFilterParams = TCreateFilterConfigParams &
  IFilterIconConfig<undefined> & {
    modules?: TEpicFilterOption[];
    /** Defaults to the stock "Module" label; Scrumban passes "Epic". */
    label?: string;
  };

/**
 * Helper to get the module multi select config
 */
export const getModuleMultiSelectConfig = (params: TCreateModuleFilterParams) =>
  getMultiSelectConfig<TEpicFilterOption, string, undefined>(
    {
      items: params.modules ?? [],
      getId: (moduleOption) => moduleOption.id,
      getLabel: (moduleOption) => moduleOption.name,
      getValue: (moduleOption) => moduleOption.id,
      getIconData: () => undefined,
    },
    {
      singleValueOperator: EQUALITY_OPERATOR.EXACT,
      ...params,
    },
    {
      ...params,
    }
  );

/**
 * Get the module filter config. Scrumban overrides the label with "Epic".
 */
export const getModuleFilterConfig =
  <P extends TFilterProperty>(key: P): TCreateFilterConfig<P, TCreateModuleFilterParams> =>
  (params: TCreateModuleFilterParams) =>
    createFilterConfig<P>({
      id: key,
      ...params,
      label: params.label ?? "Module",
      icon: params.filterIcon,
      supportedOperatorConfigsMap: new Map([
        createOperatorConfigEntry(COLLECTION_OPERATOR.IN, params, (updatedParams) =>
          getModuleMultiSelectConfig(updatedParams)
        ),
      ]),
    });
