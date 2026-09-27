/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TChartData } from "./charts";

export enum ChartXAxisProperty {
  STATES = "STATES",
  STATE_GROUPS = "STATE_GROUPS",
  LABELS = "LABELS",
  ASSIGNEES = "ASSIGNEES",
  ESTIMATE_POINTS = "ESTIMATE_POINTS",
  CYCLES = "CYCLES",
  MODULES = "MODULES",
  PRIORITY = "PRIORITY",
  START_DATE = "START_DATE",
  TARGET_DATE = "TARGET_DATE",
  CREATED_AT = "CREATED_AT",
  COMPLETED_AT = "COMPLETED_AT",
  CREATED_BY = "CREATED_BY",
  WORK_ITEM_TYPES = "WORK_ITEM_TYPES",
  PROJECTS = "PROJECTS",
  EPICS = "EPICS",
}

export enum ChartYAxisMetric {
  WORK_ITEM_COUNT = "WORK_ITEM_COUNT",
  ESTIMATE_POINT_COUNT = "ESTIMATE_POINT_COUNT",
  PENDING_WORK_ITEM_COUNT = "PENDING_WORK_ITEM_COUNT",
  COMPLETED_WORK_ITEM_COUNT = "COMPLETED_WORK_ITEM_COUNT",
  IN_PROGRESS_WORK_ITEM_COUNT = "IN_PROGRESS_WORK_ITEM_COUNT",
  WORK_ITEM_DUE_THIS_WEEK_COUNT = "WORK_ITEM_DUE_THIS_WEEK_COUNT",
  WORK_ITEM_DUE_TODAY_COUNT = "WORK_ITEM_DUE_TODAY_COUNT",
  BLOCKED_WORK_ITEM_COUNT = "BLOCKED_WORK_ITEM_COUNT",
  EPIC_WORK_ITEM_COUNT = "EPIC_WORK_ITEM_COUNT",
}

export type TAnalyticsTabsBase = "overview" | "work-items" | "velocity";
export type TAnalyticsGraphsBase = "projects" | "work-items" | "custom-work-items";
export interface AnalyticsTab {
  key: TAnalyticsTabsBase;
  label: string;
  content: React.FC;
  isDisabled: boolean;
}
export type TAnalyticsFilterParams = {
  project_ids?: string;
  cycle_id?: string;
  module_id?: string;
};

// service types

export interface IAnalyticsResponse {
  [key: string]: any;
}

export interface IAnalyticsResponseFields {
  count: number;
  filter_count: number;
}

// chart types

export interface IChartResponse {
  schema: Record<string, string>;
  data: TChartData<string, string>[];
}

// table types

export interface WorkItemInsightColumns {
  project_id?: string;
  project__name?: string;
  cancelled_work_items: number;
  completed_work_items: number;
  backlog_work_items: number;
  un_started_work_items: number;
  started_work_items: number;
  // in case of peek view, we will display the display_name instead of project__name
  display_name?: string;
  avatar_url?: string;
  assignee_id?: string;
}

export type TVelocityWorkItem = {
  id: string;
  identifier: string;
  name: string;
  project_id: string;
  project_name: string;
  cycle_id: string | null;
  cycle_name: string;
  role: "design" | "dev" | "qa" | "uncategorized";
  story_points: number;
  status: "done" | "under_review";
  state_name: string;
  completed_at: string | null;
  hierarchy_level: number | null;
  parent_id: string | null;
  parent_identifier: string | null;
  parent_name: string | null;
};

export type TVelocityComparisonPoint = {
  project_id: string;
  project_name: string;
  cycle_id: string;
  cycle_name: string;
  end_date: string | null;
  workflow_mode: string;
  label: string;
  is_completed: boolean;
  story_points: number;
};

export type TVelocityRoleSprint = {
  cycle_id: string;
  cycle_name: string;
  end_date: string | null;
  is_completed: boolean;
  design: number;
  dev: number;
  qa: number;
  uncategorized: number;
};

export type TVelocityPersonRow = {
  user_id: string;
  display_name: string;
  first_name: string;
  last_name: string;
  design: number;
  dev: number;
  qa: number;
  uncategorized: number;
  total: number;
  avg_per_sprint: number;
  sprint_count: number;
  personal_leave_days: number;
};

export type TVelocityProjectResponse = {
  kpis: {
    team_avg_velocity: number;
    last_sprint_sp: number;
    avg_design: number;
    avg_dev: number;
    avg_qa: number;
    people_count: number;
    completed_sprint_count: number;
    focus_project_id: string | null;
  };
  comparison: TVelocityComparisonPoint[];
  role_by_sprint: TVelocityRoleSprint[];
  people: TVelocityPersonRow[];
  work_items: { items: TVelocityWorkItem[] } | null;
};

export type TVelocityIndividualSprint = {
  project_id: string;
  project_name: string;
  cycle_id: string;
  cycle_name: string;
  end_date: string | null;
  story_points: number;
  is_completed: boolean;
  personal_leave_days: number;
};

export type TManhourReportRowSource = "issue" | "standalone";

export type TManhourReportRow = {
  id: string;
  source: TManhourReportRowSource;
  description: string;
  manhour: number;
  duration: string;
  member: string;
  project_id: string | null;
  project_name: string;
  date: string;
  created_at: string;
  remark?: string;
};

export type TManhourReportResponse = {
  member: {
    id: string;
    display_name: string;
    first_name: string;
    last_name: string;
  };
  range: {
    start_date: string;
    end_date: string;
  };
  summary: {
    total_hours: number;
    average_daily_hours: number;
    total_duration: string;
    average_daily_duration: string;
    row_count: number;
    day_count: number;
  };
  rows: TManhourReportRow[];
};

export type TManhourManualEntryPayload = {
  user_id: string;
  description: string;
  manhour: number;
  entry_date: string;
  project_id?: string | null;
};

export type TManhourManualEntryResponse = {
  id: string;
  source: "standalone";
  description: string;
  manhour: number;
  entry_date: string;
  project_id: string | null;
  user_id: string;
};

export type TVelocityIndividualResponse = {
  kpis: {
    total_story_points: number;
    avg_per_sprint: number;
    sprint_count: number;
    ticket_count: number;
    personal_leave_days: number;
  };
  sprints: TVelocityIndividualSprint[];
  work_items: { items: TVelocityWorkItem[] };
};

export type AnalyticsTableDataMap = {
  "work-items": WorkItemInsightColumns;
  velocity: TVelocityPersonRow;
};

export interface IAnalyticsParams {
  x_axis: ChartXAxisProperty;
  y_axis: ChartYAxisMetric;
  group_by?: ChartXAxisProperty;
}
