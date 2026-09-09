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
}

export const HeaderSubGroupByCard = observer(function HeaderSubGroupByCard(props: IHeaderSubGroupByCard) {
  const { icon, title, count, column_id, collapsedGroups, handleCollapsedGroups, className } = props;
  return (
    // oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions
    <div
      className={cn(
        "relative flex max-w-md min-w-0 flex-shrink cursor-pointer flex-row items-center gap-1 rounded-xs py-1.5",
        className
      )}
      onClick={() => handleCollapsedGroups("sub_group_by", column_id)}
    >
      <div className="flex h-[20px] w-[20px] flex-shrink-0 items-center justify-center overflow-hidden rounded-xs transition-all hover:bg-layer-1">
        {collapsedGroups?.sub_group_by.includes(column_id) ? (
          <ChevronDownIcon width={14} strokeWidth={2} />
        ) : (
          <ChevronUpIcon width={14} strokeWidth={2} />
        )}
      </div>

      <div className="flex h-[20px] w-[20px] flex-shrink-0 items-center justify-center overflow-hidden rounded-xs">
        {icon ? icon : <Circle width={14} strokeWidth={2} />}
      </div>

      <div className="flex min-w-0 items-center gap-1 text-13">
        <div className="truncate text-primary">{title}</div>
        <div className="shrink-0 pl-2 text-13 font-medium text-tertiary">{count || 0}</div>
      </div>
    </div>
  );
});
