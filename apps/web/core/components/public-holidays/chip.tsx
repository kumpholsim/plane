/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { CloseIcon } from "@plane/propel/icons";
import type { TWorkspacePublicHoliday } from "@plane/types";
import { cn } from "@plane/utils";

export const parseHolidayDate = (value: string) => new Date(`${value}T00:00:00`);
export const toHolidayDate = (value: Date) => format(value, "yyyy-MM-dd");

type Props = {
  holiday: TWorkspacePublicHoliday;
  /** Editable chips show a name input and a remove button */
  onRename?: (holiday: TWorkspacePublicHoliday, name: string) => Promise<void>;
  onRemove?: (holiday: TWorkspacePublicHoliday) => Promise<void>;
  disabled?: boolean;
  muted?: boolean;
};

export function PublicHolidayChip(props: Props) {
  const { holiday, onRename, onRemove, disabled, muted } = props;
  const [nameDraft, setNameDraft] = useState(holiday.name);
  const committedName = useRef(holiday.name);

  useEffect(() => {
    setNameDraft(holiday.name);
    committedName.current = holiday.name;
  }, [holiday.name]);

  const commitName = () => {
    if (!onRename) return;
    const trimmed = nameDraft.trim();
    if (trimmed === committedName.current) return;
    committedName.current = trimmed;
    void onRename(holiday, trimmed);
  };

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-md border border-subtle bg-surface-1 py-1 pr-1 pl-2 text-12",
        muted && "opacity-70"
      )}
    >
      <span className="shrink-0 font-medium text-primary">
        {format(parseHolidayDate(holiday.date), "EEE, MMM d, yyyy")}
      </span>
      {onRename ? (
        <input
          aria-label={`Name for ${holiday.date}`}
          value={nameDraft}
          disabled={disabled}
          placeholder="Holiday name"
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitName();
            }
          }}
          className="focus:border-accent-primary min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-12 text-secondary outline-none hover:border-subtle"
        />
      ) : (
        <span className="min-w-0 flex-1 truncate py-0.5 text-secondary">{holiday.name || "Public holiday"}</span>
      )}
      {onRemove && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => void onRemove(holiday)}
          className="flex size-5 shrink-0 items-center justify-center rounded text-placeholder hover:bg-layer-1 hover:text-secondary"
          aria-label={`Remove holiday ${holiday.date}`}
        >
          <CloseIcon className="size-3" />
        </button>
      )}
    </div>
  );
}
