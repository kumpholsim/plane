/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TWorkspacePublicHoliday } from "@plane/types";
import { PublicHolidayChip } from "@/components/public-holidays/chip";

type Props = {
  /** Workspace holidays dated inside the sprint (these deduct capacity) */
  sprintHolidays: TWorkspacePublicHoliday[];
  spPerHolidayDay: number;
};

export function CapacityPublicHolidays(props: Props) {
  const { sprintHolidays, spPerHolidayDay } = props;
  const dayCount = sprintHolidays.length;

  return (
    <div className="relative z-10 mb-4 space-y-2 rounded-lg border border-subtle bg-layer-1 p-3">
      <div className="min-w-0">
        <p className="text-13 text-secondary">Public holidays</p>
        <p className="text-11 text-tertiary">
          {dayCount} {dayCount === 1 ? "day" : "days"} in this sprint
          {dayCount > 0 && ` · −${(dayCount * spPerHolidayDay).toFixed(1)} SP per member`}
        </p>
      </div>
      {dayCount > 0 ? (
        <div className="flex flex-col gap-1.5">
          {sprintHolidays.map((holiday) => (
            <PublicHolidayChip key={holiday.id} holiday={holiday} />
          ))}
        </div>
      ) : (
        <p className="text-12 text-tertiary">No public holidays fall inside this sprint.</p>
      )}
      <p className="text-11 text-tertiary">Set holidays from Projects → Public holidays.</p>
    </div>
  );
}
