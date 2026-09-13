/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { createContext, useContext } from "react";
import type { TProjectEvent } from "@plane/types";

export type TEventDraft = {
  startKey: string;
  endKey: string;
  event?: TProjectEvent;
};

export type TRangeDragState = {
  originKey: string;
  currentKey: string;
} | null;

type TScrumbanCalendarContext = {
  workspaceSlug: string;
  projectId: string;
  canEdit: boolean;
  rangeDrag: TRangeDragState;
  draft: TEventDraft | null;
  isRangeDragging: boolean;
  startRangeDrag: (dateKey: string) => void;
  updateRangeDrag: (dateKey: string) => void;
  endRangeDrag: () => void;
  openCreateDraft: (startKey: string, endKey: string) => void;
  openEditDraft: (event: TProjectEvent) => void;
  closeDraft: () => void;
  isDateInRangeSelection: (dateKey: string) => boolean;
};

export const ScrumbanCalendarContext = createContext<TScrumbanCalendarContext | null>(null);

export const useScrumbanCalendar = (): TScrumbanCalendarContext => {
  const ctx = useContext(ScrumbanCalendarContext);
  if (!ctx) throw new Error("useScrumbanCalendar must be used within ScrumbanCalendarProvider");
  return ctx;
};
