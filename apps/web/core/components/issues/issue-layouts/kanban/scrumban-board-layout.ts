/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

/** Classic Plane columns stay a fixed card width. */
export const CLASSIC_KANBAN_COLUMN_CLASS = "w-[350px] shrink-0";

/**
 * Scrumban columns share leftover viewport width equally.
 * Four status columns are wider than the old six — sized for 3-up cards.
 * Used for both the sticky state header and the column body (sizing only).
 */
export const SCRUMBAN_KANBAN_COLUMN_CLASS = "min-w-[260px] w-0 flex-1";

/**
 * Lane fill for Scrumban column bodies only — not the sticky state header.
 * Lighter than the L3 swimlane bar (`bg-layer-3`) so status lanes stay visually bounded.
 */
export const SCRUMBAN_KANBAN_COLUMN_BODY_CLASS = "rounded-md border-[0.5px] border-subtle bg-layer-1 px-1.5 pb-1.5";

/**
 * Compact L4 cards: 2-up when the column is medium, 3-up when it stretches
 * (typical with four equal flex columns on desktop).
 */
export const SCRUMBAN_KANBAN_CARD_GRID_CLASS =
  "grid grid-cols-1 gap-1.5 @min-[16rem]:grid-cols-2 @min-[22rem]:grid-cols-3";
