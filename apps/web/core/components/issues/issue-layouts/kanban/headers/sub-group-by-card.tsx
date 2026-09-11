/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { observer } from "mobx-react";
import { Circle } from "lucide-react";
import { ChevronDownIcon, ChevronUpIcon } from "@plane/propel/icons";
import { cn } from "@plane/utils";
// Plane
import type { TIssueGroupByOptions, TIssueKanbanFilters } from "@plane/types";

interface IHeaderSubGroupByCard {
  icon?: React.ReactNode;
  title: string;
  count: number;
  column_id: string;
  collapsedGroups: TIssueKanbanFilters;
  sub_group_by: TIssueGroupByOptions | undefined;
  handleCollapsedGroups: (toggle: "group_by" | "sub_group_by", value: string) => void;
  className?: string;
  leading?: React.ReactNode;
  /** When set, title opens this instead of collapsing the swimlane */
  onTitleClick?: () => void;
  /** Scrumban L3: slightly smaller title (no bold) */
  emphasizeTitle?: boolean;
}

export const HeaderSubGroupByCard = observer(function HeaderSubGroupByCard(props: IHeaderSubGroupByCard) {
  const {
    icon,
    title,
    count,
    column_id,
    collapsedGroups,
    handleCollapsedGroups,
    className,
    leading,
    onTitleClick,
    emphasizeTitle = false,
  } = props;

  const toggleCollapsed = () => handleCollapsedGroups("sub_group_by", column_id);

  return (
    <div
      className={cn(
        "relative flex max-w-md min-w-0 flex-shrink flex-row items-center gap-1 rounded-xs py-1.5",
        className
      )}
    >
      <button
        type="button"
        className="flex h-[20px] w-[20px] flex-shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xs transition-all hover:bg-layer-1"
        onClick={(e) => {
          e.stopPropagation();
          toggleCollapsed();
        }}
        aria-label={collapsedGroups?.sub_group_by.includes(column_id) ? "Expand" : "Collapse"}
      >
        {collapsedGroups?.sub_group_by.includes(column_id) ? (
          <ChevronDownIcon width={14} strokeWidth={2} />
        ) : (
          <ChevronUpIcon width={14} strokeWidth={2} />
        )}
      </button>

      {leading}

      {!leading && (
        <div className="flex h-[20px] w-[20px] flex-shrink-0 items-center justify-center overflow-hidden rounded-xs">
          {icon ? icon : <Circle width={14} strokeWidth={2} />}
        </div>
      )}

      <div
        className={cn(
          "flex min-w-0 items-center gap-1",
          // 0.975rem * 0.75 ≈ 0.731rem (25% smaller than prior L3 size)
          emphasizeTitle ? "font-normal text-[0.731rem] leading-snug" : "text-13"
        )}
      >
        {onTitleClick ? (
          <button
            type="button"
            className="font-normal truncate text-left text-primary"
            onClick={(e) => {
              e.stopPropagation();
              onTitleClick();
            }}
            title={title}
          >
            {title}
          </button>
        ) : (
          <button
            type="button"
            className="font-normal truncate text-left text-primary"
            onClick={(e) => {
              e.stopPropagation();
              toggleCollapsed();
            }}
          >
            {title}
          </button>
        )}
        <div className={cn("shrink-0 pl-2 font-medium text-tertiary", emphasizeTitle ? "text-[0.731rem]" : "text-13")}>
          {count || 0}
        </div>
      </div>
    </div>
  );
});
