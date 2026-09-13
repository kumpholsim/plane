/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef } from "react";
import { observer } from "mobx-react";
import type { TProjectEvent } from "@plane/types";
import { cn } from "@plane/utils";
import { useScrumbanCalendar } from "./context";
import type { TEventSegment, TWeekEventPlacement } from "./event-utils";
import { dateKeyToEndISO, dateKeyToStartISO, daysBetweenKeys, shiftDateKey, toDateKey } from "./event-utils";

type BarProps = {
  segment: TEventSegment;
  fillCell?: boolean;
};

export const CalendarEventBar = observer(function CalendarEventBar(props: BarProps) {
  const { segment, fillCell = false } = props;
  const { event, isStart, isEnd, isOnly } = segment;
  const { canEdit, openEditDraft } = useScrumbanCalendar();
  const suppressClickRef = useRef(false);
  const cover = event.cover_image;

  return (
    // oxlint-disable-next-line jsx_a11y/click-events-have-key-events, jsx_a11y/no-static-element-interactions
    <div
      className={cn(
        "group/event relative overflow-hidden text-11 font-medium text-white select-none",
        fillCell ? "flex h-full min-h-[5rem] flex-col rounded-sm" : "h-5 truncate px-1.5 leading-5",
        !fillCell && (isStart || isOnly) && "rounded-l-sm",
        !fillCell && (isEnd || isOnly) && "rounded-r-sm",
        canEdit && "cursor-grab active:cursor-grabbing"
      )}
      style={{ backgroundColor: event.color || "#3B82F6" }}
      title={event.name}
      draggable={canEdit}
      onDragStart={(e) => {
        suppressClickRef.current = false;
        e.dataTransfer.setData(
          "application/x-plane-event",
          JSON.stringify({ eventId: event.id, dateKey: segment.dateKey, type: "move" })
        );
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={() => {
        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (suppressClickRef.current) return;
        openEditDraft(event);
      }}
    >
      {fillCell && cover ? (
        <div className="relative flex min-h-[5rem] flex-1 flex-col">
          <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="relative mt-auto space-y-0.5 p-2">
            <p className="truncate font-semibold">{event.name}</p>
            <p className="font-normal text-10 opacity-90">{toDateKey(event.start_at)}</p>
          </div>
        </div>
      ) : fillCell ? (
        <div className="flex h-full min-h-[5rem] flex-col justify-between p-2">
          <span className="truncate font-semibold">{event.name}</span>
          <span className="font-normal text-10 opacity-90">{toDateKey(event.start_at)}</span>
        </div>
      ) : (
        <>
          {canEdit && (isStart || isOnly) && (
            // oxlint-disable-next-line jsx_a11y/click-events-have-key-events, jsx_a11y/no-static-element-interactions
            <span
              className="absolute top-0 left-0 z-[1] h-full w-1.5 cursor-ew-resize opacity-0 group-hover/event:opacity-100"
              draggable
              onDragStart={(e) => {
                e.stopPropagation();
                e.dataTransfer.setData(
                  "application/x-plane-event",
                  JSON.stringify({ eventId: event.id, dateKey: segment.dateKey, type: "resize-start" })
                );
              }}
              onClick={(e) => e.stopPropagation()}
            />
          )}
          {(isStart || isOnly) && <span className="truncate">{event.name}</span>}
          {canEdit && (isEnd || isOnly) && (
            // oxlint-disable-next-line jsx_a11y/click-events-have-key-events, jsx_a11y/no-static-element-interactions
            <span
              className="absolute top-0 right-0 z-[1] h-full w-1.5 cursor-ew-resize opacity-0 group-hover/event:opacity-100"
              draggable
              onDragStart={(e) => {
                e.stopPropagation();
                e.dataTransfer.setData(
                  "application/x-plane-event",
                  JSON.stringify({ eventId: event.id, dateKey: segment.dateKey, type: "resize-end" })
                );
              }}
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </>
      )}
    </div>
  );
});

type SpanProps = {
  placement: TWeekEventPlacement;
  columnCount: number;
};

/** Continuous multi-day bar across week columns (Google Calendar style). */
export const CalendarEventSpanBar = observer(function CalendarEventSpanBar(props: SpanProps) {
  const { placement, columnCount } = props;
  const { event, startIndex, endIndex, continuesBefore, continuesAfter } = placement;
  const { canEdit, openEditDraft } = useScrumbanCalendar();
  const suppressClickRef = useRef(false);
  const span = endIndex - startIndex + 1;
  const leftPct = (startIndex / columnCount) * 100;
  const widthPct = (span / columnCount) * 100;
  const dateKey = toDateKey(event.start_at);

  return (
    // oxlint-disable-next-line jsx_a11y/click-events-have-key-events, jsx_a11y/no-static-element-interactions
    <div
      data-event-bar
      className={cn(
        "absolute top-0 h-5 truncate px-1.5 text-11 leading-5 font-medium text-white",
        !continuesBefore && "rounded-l-sm",
        !continuesAfter && "rounded-r-sm",
        canEdit && "cursor-grab active:cursor-grabbing"
      )}
      style={{
        left: `calc(${leftPct}% + 2px)`,
        width: `calc(${widthPct}% - 4px)`,
        backgroundColor: event.color || "#3B82F6",
      }}
      title={event.name}
      draggable={canEdit}
      onDragStart={(e) => {
        suppressClickRef.current = false;
        e.dataTransfer.setData(
          "application/x-plane-event",
          JSON.stringify({ eventId: event.id, dateKey, type: "move" })
        );
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={() => {
        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (suppressClickRef.current) return;
        openEditDraft(event);
      }}
    >
      {!continuesBefore && <span className="truncate">{event.name}</span>}
    </div>
  );
});

export type TEventDragPayload = {
  eventId: string;
  dateKey: string;
  type: "move" | "resize-start" | "resize-end";
};

export const parseEventDragPayload = (dataTransfer: DataTransfer): TEventDragPayload | null => {
  const raw = dataTransfer.getData("application/x-plane-event");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TEventDragPayload;
  } catch {
    return null;
  }
};

export const applyEventDrop = async (
  payload: TEventDragPayload,
  destinationKey: string,
  event: TProjectEvent | undefined,
  updateEvent: (
    workspaceSlug: string,
    projectId: string,
    eventId: string,
    data: Partial<{ start_at: string; end_at: string }>
  ) => Promise<unknown>,
  workspaceSlug: string,
  projectId: string
) => {
  if (!event) return;
  if (payload.type === "move") {
    const delta = daysBetweenKeys(payload.dateKey, destinationKey);
    if (delta === 0) return;
    const nextStart = shiftDateKey(toDateKey(event.start_at), delta);
    const nextEnd = shiftDateKey(toDateKey(event.end_at), delta);
    await updateEvent(workspaceSlug, projectId, event.id, {
      start_at: dateKeyToStartISO(nextStart),
      end_at: dateKeyToEndISO(nextEnd),
    });
    return;
  }
  if (payload.type === "resize-start") {
    const end = toDateKey(event.end_at);
    const nextStart = destinationKey <= end ? destinationKey : end;
    await updateEvent(workspaceSlug, projectId, event.id, {
      start_at: dateKeyToStartISO(nextStart),
      end_at: dateKeyToEndISO(end),
    });
    return;
  }
  if (payload.type === "resize-end") {
    const start = toDateKey(event.start_at);
    const nextEnd = destinationKey >= start ? destinationKey : start;
    await updateEvent(workspaceSlug, projectId, event.id, {
      start_at: dateKeyToStartISO(start),
      end_at: dateKeyToEndISO(nextEnd),
    });
  }
};
