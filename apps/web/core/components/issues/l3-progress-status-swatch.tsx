/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { CheckIcon } from "@plane/propel/icons";
import { cn } from "@plane/utils";
import { isL3DoneProgressStatus } from "@/components/issues/hierarchy-status";

type TSwatchSize = "sm" | "md";

type Props = {
  color: string;
  progressStatus?: string | null;
  size?: TSwatchSize;
  className?: string;
};

const SIZE_CLASS: Record<TSwatchSize, { wrap: string; tickWrap: string; tick: string }> = {
  sm: { wrap: "size-2.5", tickWrap: "size-2 -bottom-0.5 -right-0.5", tick: "size-1.5" },
  md: { wrap: "size-3.5", tickWrap: "size-2.5 -bottom-0.5 -right-0.5", tick: "size-2" },
};

/** Phase color dot; exit-gate statuses overlay a green tick on the swatch. */
export function L3ProgressStatusSwatch(props: Props) {
  const { color, progressStatus, size = "md", className } = props;
  const isExitGate = isL3DoneProgressStatus(progressStatus);
  const sizeClass = SIZE_CLASS[size];

  return (
    <span
      className={cn("relative inline-flex flex-shrink-0 items-center justify-center", sizeClass.wrap, className)}
      aria-hidden
    >
      <span className="size-full rounded-full" style={{ backgroundColor: color }} />
      {isExitGate && (
        <span
          className={cn(
            "shadow-sm absolute flex items-center justify-center rounded-full bg-surface-1",
            sizeClass.tickWrap
          )}
        >
          <CheckIcon className={cn(sizeClass.tick, "text-success-primary")} />
        </span>
      )}
    </span>
  );
}
