/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Loader } from "@plane/ui";

type TKpi = { label: string; value: string | number };

export function VelocityKpis(props: { items: TKpi[]; isLoading?: boolean }) {
  const { items, isLoading } = props;
  return (
    <div className="grid grid-cols-2 gap-6 md:grid-cols-3 xl:grid-cols-6">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-2">
          <div className="text-13 text-tertiary">{item.label}</div>
          {isLoading ? (
            <Loader.Item height="28px" width="80%" />
          ) : (
            <div className="text-20 font-bold text-primary">{item.value}</div>
          )}
        </div>
      ))}
    </div>
  );
}
