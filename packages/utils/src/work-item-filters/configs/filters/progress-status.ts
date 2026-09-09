/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TFilterProperty, TSupportedOperators } from "@plane/types";
import { COLLECTION_OPERATOR, EQUALITY_OPERATOR } from "@plane/types";
import type { IFilterIconConfig, TCreateFilterConfig, TCreateFilterConfigParams } from "../../../rich-filters";
import { createFilterConfig, createOperatorConfigEntry, getMultiSelectConfig } from "../../../rich-filters";

export type TProgressStatusOption = {
  value: string;
  label: string;
  color: string;
};

export type TCreateProgressStatusFilterParams = TCreateFilterConfigParams &
  IFilterIconConfig<TProgressStatusOption> & {
    options: TProgressStatusOption[];
  };

const getProgressStatusMultiSelectConfig = (
  params: TCreateProgressStatusFilterParams,
  singleValueOperator: TSupportedOperators
) =>
  getMultiSelectConfig<TProgressStatusOption, string, TProgressStatusOption>(
    {
      items: params.options,
      getId: (option) => option.value,
      getLabel: (option) => option.label,
      getValue: (option) => option.value,
      getIconData: (option) => option,
    },
    {
      singleValueOperator,
      ...params,
    },
    {
      ...params,
    }
  );

export const getProgressStatusFilterConfig =
  <P extends TFilterProperty>(key: P): TCreateFilterConfig<P, TCreateProgressStatusFilterParams> =>
  (params: TCreateProgressStatusFilterParams) =>
    createFilterConfig<P>({
      id: key,
      label: "L3 Status",
      ...params,
      icon: params.filterIcon,
      supportedOperatorConfigsMap: new Map([
        createOperatorConfigEntry(COLLECTION_OPERATOR.IN, params, (updatedParams) =>
          getProgressStatusMultiSelectConfig(updatedParams, EQUALITY_OPERATOR.EXACT)
        ),
      ]),
    });
