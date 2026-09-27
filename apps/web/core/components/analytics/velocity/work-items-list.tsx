/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useTranslation } from "@plane/i18n";
import type { TVelocityWorkItem } from "@plane/types";
import { EmptyStateCompact } from "@plane/propel/empty-state";

export function VelocityWorkItemsList(props: { items: TVelocityWorkItem[] }) {
  const { items } = props;
  const { t } = useTranslation();

  if (items.length === 0) {
    return (
      <EmptyStateCompact
        assetKey="unknown"
        assetClassName="size-16"
        rootClassName="border border-subtle px-5 py-8"
        title={t("workspace_analytics.velocity.empty")}
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-subtle">
      <table className="w-full text-left text-13">
        <thead className="bg-layer-1 text-tertiary">
          <tr>
            <th className="px-3 py-2 font-medium">{t("common.name")}</th>
            <th className="px-3 py-2 font-medium">{t("common.project")}</th>
            <th className="px-3 py-2 font-medium">{t("common.cycle")}</th>
            <th className="px-3 py-2 font-medium">{t("workspace_analytics.velocity.story_points")}</th>
            <th className="px-3 py-2 font-medium">{t("common.state")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={`${item.id}-${item.cycle_id}`} className="border-t border-subtle">
              <td className="px-3 py-2 text-primary">
                <div className="font-medium">
                  {item.identifier} {item.name}
                </div>
                {item.parent_identifier && (
                  <div className="text-12 text-tertiary">
                    {item.parent_identifier} {item.parent_name}
                  </div>
                )}
              </td>
              <td className="px-3 py-2 text-secondary">{item.project_name}</td>
              <td className="px-3 py-2 text-secondary">{item.cycle_name}</td>
              <td className="px-3 py-2 text-secondary">{item.story_points}</td>
              <td className="px-3 py-2 text-secondary">
                {item.status === "done"
                  ? t("workspace_analytics.velocity.done")
                  : t("workspace_analytics.velocity.under_review")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
