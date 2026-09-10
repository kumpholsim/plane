/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

/** Classic Plane columns stay a fixed card width. */
export const CLASSIC_KANBAN_COLUMN_CLASS = "w-[350px] shrink-0";

/**
 * Scrumban columns share leftover viewport width equally.
 * min-width keeps six status columns readable on smaller boards.
 */
export const SCRUMBAN_KANBAN_COLUMN_CLASS = "min-w-[228px] w-0 flex-1";

/** Two compact L4 cards per row once a stretched column is wide enough (~256px). */
export const SCRUMBAN_KANBAN_CARD_GRID_CLASS = "grid grid-cols-1 gap-1.5 @min-[16rem]:grid-cols-2";
