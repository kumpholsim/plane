/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { ChevronUp, ChevronsUp } from "lucide-react";
import type { TIssue } from "@plane/types";
import { HIERARCHY_LEVEL_DELIVERY } from "@plane/types";
import { Tooltip } from "@plane/propel/tooltip";
import { cn } from "@plane/utils";
import { getHierarchyLevel } from "@/components/issues/issue-detail-widgets/sub-issues/depth";

type Props = {
  issue: TIssue;
  canEdit: boolean;
  updateIssue: ((projectId: string | null, issueId: string, data: Partial<TIssue>) => Promise<void>) | undefined;
};

/**
 * Mutual exclusive pin: 0 = none, 1 = single ↑, 2 = double ⇈.
 * Selecting one replaces the other; both cannot be active together.
 */
export const IssuePinLevelControls = observer(function IssuePinLevelControls(props: Props) {
  const { issue, canEdit, updateIssue } = props;

  if (getHierarchyLevel(issue) !== HIERARCHY_LEVEL_DELIVERY) return null;

  const pinLevel = issue.pin_level ?? 0;
  const isSinglePinned = pinLevel === 1;
  const isDoublePinned = pinLevel >= 2;

  const setPinLevel = async (next: number) => {
    if (!canEdit || !updateIssue || !issue.project_id) return;
    await updateIssue(issue.project_id, issue.id, { pin_level: next });
  };

  return (
    // oxlint-disable-next-line jsx_a11y/no-static-element-interactions
    <div
      className="flex flex-shrink-0 items-center gap-0.5"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <Tooltip tooltipContent={isDoublePinned ? "Unpin" : "Double pin to top (replaces single pin)"} position="top">
        <button
          type="button"
          disabled={!canEdit}
          className={cn(
            "grid size-5 place-items-center rounded-sm text-danger-primary transition-opacity",
            isDoublePinned ? "opacity-100" : "opacity-40 hover:opacity-100",
            !canEdit && "cursor-not-allowed opacity-30"
          )}
          onClick={() => setPinLevel(isDoublePinned ? 0 : 2)}
          aria-label="Double pin to top"
          aria-pressed={isDoublePinned}
        >
          <ChevronsUp className="size-3.5" strokeWidth={2.5} />
        </button>
      </Tooltip>
      <Tooltip tooltipContent={isSinglePinned ? "Unpin" : "Pin to top (replaces double pin)"} position="top">
        <button
          type="button"
          disabled={!canEdit}
          className={cn(
            "grid size-5 place-items-center rounded-sm text-danger-primary transition-opacity",
            isSinglePinned ? "opacity-100" : "opacity-40 hover:opacity-100",
            !canEdit && "cursor-not-allowed opacity-30"
          )}
          onClick={() => setPinLevel(isSinglePinned ? 0 : 1)}
          aria-label="Pin to top"
          aria-pressed={isSinglePinned}
        >
          <ChevronUp className="size-3.5" strokeWidth={2.5} />
        </button>
      </Tooltip>
    </div>
  );
});
