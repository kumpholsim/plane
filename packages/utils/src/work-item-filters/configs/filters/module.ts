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

/** Minimal epic shape for the (legacy module_id) filter options. */
export type TEpicFilterOption = {
  id: string;
  name: string;
};

/**
 * Epic filter specific params (property key remains ``module_id`` for saved views).
 */
export type TCreateModuleFilterParams = TCreateFilterConfigParams &
  IFilterIconConfig<undefined> & {
    /** @deprecated Use `epics` — kept for call-site compatibility during rename. */
    modules?: TEpicFilterOption[];
    epics?: TEpicFilterOption[];
  };

/**
 * Helper to get the epic multi select config
 */
export const getModuleMultiSelectConfig = (params: TCreateModuleFilterParams) => {
  const epics = params.epics ?? params.modules ?? [];
  return getMultiSelectConfig<TEpicFilterOption, string, undefined>(
    {
      items: epics,
      getId: (epic) => epic.id,
      getLabel: (epic) => epic.name,
      getValue: (epic) => epic.id,
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
};

/**
 * Get the epic filter config (UI label "Epic"; property key still module_id).
 */
export const getModuleFilterConfig =
  <P extends TFilterProperty>(key: P): TCreateFilterConfig<P, TCreateModuleFilterParams> =>
  (params: TCreateModuleFilterParams) =>
    createFilterConfig<P>({
      id: key,
      label: "Epic",
      ...params,
      icon: params.filterIcon,
      supportedOperatorConfigsMap: new Map([
        createOperatorConfigEntry(COLLECTION_OPERATOR.IN, params, (updatedParams) =>
          getModuleMultiSelectConfig(updatedParams)
        ),
      ]),
    });
