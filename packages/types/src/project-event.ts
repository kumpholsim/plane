/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TProjectEvent = {
  id: string;
  project_id: string;
  workspace_id: string;
  name: string;
  description: string;
  start_at: string;
  end_at: string;
  all_day: boolean;
  color: string;
  cover_image: string | null;
  created_at?: string;
  updated_at?: string;
  created_by?: string | null;
  updated_by?: string | null;
};

export type TProjectEventForm = {
  name: string;
  description?: string;
  start_at: string;
  end_at: string;
  all_day?: boolean;
  color?: string;
  cover_image?: string | null;
};

/** Curated palette for calendar events */
export const PROJECT_EVENT_COLOR_SWATCHES = [
  "#3B82F6", // blue
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#EF4444", // red
  "#F97316", // orange
  "#EAB308", // yellow
  "#22C55E", // green
  "#14B8A6", // teal
] as const;
