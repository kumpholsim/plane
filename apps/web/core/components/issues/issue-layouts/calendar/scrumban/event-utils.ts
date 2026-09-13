/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TProjectEvent } from "@plane/types";

export const toDateKey = (isoOrDate: string | Date): string => {
  if (typeof isoOrDate === "string") return isoOrDate.slice(0, 10);
  const y = isoOrDate.getFullYear();
  const m = String(isoOrDate.getMonth() + 1).padStart(2, "0");
  const d = String(isoOrDate.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

/** Inclusive all-day bounds as UTC ISO (avoids local DST edges). */
export const dateKeyToStartISO = (dateKey: string) => `${dateKey}T00:00:00.000Z`;
export const dateKeyToEndISO = (dateKey: string) => `${dateKey}T23:59:59.999Z`;

export const shiftDateKey = (dateKey: string, days: number): string => {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateKey(date);
};

export const daysBetweenKeys = (startKey: string, endKey: string): number => {
  const start = new Date(`${startKey}T12:00:00.000Z`);
  const end = new Date(`${endKey}T12:00:00.000Z`);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
};

export const minMaxDateKeys = (a: string, b: string): { start: string; end: string } =>
  a <= b ? { start: a, end: b } : { start: b, end: a };

export const monthKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}`;

export const firstOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

export const addMonths = (date: Date, count: number) =>
  new Date(date.getFullYear(), date.getMonth() + count, 1);

export const isSingleDayEvent = (event: TProjectEvent) =>
  toDateKey(event.start_at) === toDateKey(event.end_at);

export type TEventSegment = {
  event: TProjectEvent;
  dateKey: string;
  isStart: boolean;
  isEnd: boolean;
  isOnly: boolean;
};

export const getEventSegmentForDay = (event: TProjectEvent, dateKey: string): TEventSegment | null => {
  const start = toDateKey(event.start_at);
  const end = toDateKey(event.end_at);
  if (dateKey < start || dateKey > end) return null;
  return {
    event,
    dateKey,
    isStart: dateKey === start,
    isEnd: dateKey === end,
    isOnly: start === end,
  };
};

/** Max compact single-day event rows shown before +N overflow. */
export const MAX_VISIBLE_EVENT_ROWS = 3;

export const EVENT_LANE_HEIGHT = 22;

export type TWeekEventPlacement = {
  event: TProjectEvent;
  startIndex: number;
  endIndex: number;
  lane: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
};

/** Pack multi-day events into continuous lanes for one week row.
 *  `activeMask[i]` false = padding day from adjacent month (excluded from bars). */
export const layoutMultiDayEventsForWeek = (
  events: TProjectEvent[],
  dayKeys: string[],
  activeMask?: boolean[]
): TWeekEventPlacement[] => {
  if (!dayKeys.length) return [];

  const isActive = (index: number) => activeMask?.[index] !== false;
  const activeIndices = dayKeys.map((_, i) => i).filter(isActive);
  if (!activeIndices.length) return [];

  const weekStart = dayKeys[activeIndices[0]];
  const weekEnd = dayKeys[activeIndices[activeIndices.length - 1]];

  const candidates = events
    .filter((event) => !isSingleDayEvent(event))
    .map((event) => {
      const start = toDateKey(event.start_at);
      const end = toDateKey(event.end_at);
      if (end < weekStart || start > weekEnd) return null;

      // Clip to active (current-month) columns only
      const overlappingActive = activeIndices.filter((i) => {
        const key = dayKeys[i];
        return key >= start && key <= end;
      });
      if (!overlappingActive.length) return null;

      const startIndex = overlappingActive[0];
      const endIndex = overlappingActive[overlappingActive.length - 1];

      return {
        event,
        startIndex,
        endIndex,
        continuesBefore: start < dayKeys[startIndex],
        continuesAfter: end > dayKeys[endIndex],
      };
    })
    .filter((p): p is NonNullable<typeof p> => !!p)
    .toSorted((a, b) => a.startIndex - b.startIndex || b.endIndex - a.endIndex - (a.endIndex - a.startIndex));

  const laneEnds: number[] = [];
  const placed: TWeekEventPlacement[] = [];

  for (const candidate of candidates) {
    let lane = laneEnds.findIndex((end) => end < candidate.startIndex);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(candidate.endIndex);
    } else {
      laneEnds[lane] = candidate.endIndex;
    }
    placed.push({ ...candidate, lane });
  }

  return placed;
};

/** Build fixed window: 6 months before today through 6 months after. */
export const buildFixedMonthWindow = (anchor = new Date()): Date[] => {
  const todayMonth = firstOfMonth(anchor);
  return Array.from({ length: 13 }, (_, i) => addMonths(todayMonth, i - 6));
};
