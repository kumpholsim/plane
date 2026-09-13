/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import type { TProjectAppliedDisplayFilterKeys, TProjectOrderByOptions } from "@plane/types";
// local imports

export type TNetworkChoiceIconKey = "Lock" | "Globe2";

export type TNetworkChoice = {
  key: 0 | 2;
  labelKey: string;
  i18n_label: string;
  description: string;
  iconKey: TNetworkChoiceIconKey;
};

export const NETWORK_CHOICES: TNetworkChoice[] = [
  {
    key: 0,
    labelKey: "Private",
    i18n_label: "workspace_projects.network.private.title",
    description: "workspace_projects.network.private.description", //"Accessible only by invite",
    iconKey: "Lock",
  },
  {
    key: 2,
    labelKey: "Public",
    i18n_label: "workspace_projects.network.public.title",
    description: "workspace_projects.network.public.description", //"Anyone in the workspace except Guests can join",
    iconKey: "Globe2",
  },
];

export const GROUP_CHOICES = {
  backlog: {
    key: "backlog",
    i18n_label: "workspace_projects.state.backlog",
  },
  unstarted: {
    key: "unstarted",
    i18n_label: "workspace_projects.state.unstarted",
  },
  started: {
    key: "started",
    i18n_label: "workspace_projects.state.started",
  },
  completed: {
    key: "completed",
    i18n_label: "workspace_projects.state.completed",
  },
  cancelled: {
    key: "cancelled",
    i18n_label: "workspace_projects.state.cancelled",
  },
};

export const PROJECT_AUTOMATION_MONTHS = [
  { i18n_label: "workspace_projects.common.months_count", value: 1 },
  { i18n_label: "workspace_projects.common.months_count", value: 3 },
  { i18n_label: "workspace_projects.common.months_count", value: 6 },
  { i18n_label: "workspace_projects.common.months_count", value: 9 },
  { i18n_label: "workspace_projects.common.months_count", value: 12 },
];

export const PROJECT_ORDER_BY_OPTIONS: {
  key: TProjectOrderByOptions;
  i18n_label: string;
}[] = [
  {
    key: "sort_order",
    i18n_label: "workspace_projects.sort.manual",
  },
  {
    key: "name",
    i18n_label: "workspace_projects.sort.name",
  },
  {
    key: "created_at",
    i18n_label: "workspace_projects.sort.created_at",
  },
  {
    key: "members_length",
    i18n_label: "workspace_projects.sort.members_length",
  },
];

export const PROJECT_DISPLAY_FILTER_OPTIONS: {
  key: TProjectAppliedDisplayFilterKeys;
  i18n_label: string;
}[] = [
  {
    key: "my_projects",
    i18n_label: "workspace_projects.scope.my_projects",
  },
  {
    key: "archived_projects",
    i18n_label: "workspace_projects.scope.archived_projects",
  },
];

export const PROJECT_ERROR_MESSAGES = {
  permissionError: {
    i18n_title: "workspace_projects.error.permission",
    i18n_message: undefined,
  },
  cycleDeleteError: {
    i18n_title: "error",
    i18n_message: "workspace_projects.error.cycle_delete",
  },
  moduleDeleteError: {
    i18n_title: "error",
    i18n_message: "workspace_projects.error.module_delete",
  },
  issueDeleteError: {
    i18n_title: "error",
    i18n_message: "workspace_projects.error.issue_delete",
  },
};

export enum EProjectFeatureKey {
  WORK_ITEMS = "work_items",
  CYCLES = "cycles",
  MODULES = "modules",
  VIEWS = "views",
  PAGES = "pages",
  INTAKE = "intake",
}

export const PROJECT_WORKFLOW_MODE = {
  SCRUM: "scrum",
  STAGED_GATE_SCRUMBAN: "staged_gate_scrumban",
} as const;

export type TProjectWorkflowModeConstant = (typeof PROJECT_WORKFLOW_MODE)[keyof typeof PROJECT_WORKFLOW_MODE];

/** Missing/unknown mode → classic (safe default for existing projects). */
export const isStagedGateScrumbanMode = (mode?: string | null): boolean =>
  mode === PROJECT_WORKFLOW_MODE.STAGED_GATE_SCRUMBAN;

/** Default sprint capacity (story points) per person when project.average_velocity is unset. */
export const DEFAULT_AVERAGE_VELOCITY = 15;

/** Each public or personal holiday day reduces capacity by this many story points. */
export const CAPACITY_SP_PER_HOLIDAY_DAY = 1.5;

/**
 * Fraction of default velocity subtracted from max capacity for each calendar day
 * after the cycle start date (10 days → max reaches 0 from time decay alone).
 */
export const CAPACITY_DAILY_DECAY_FRACTION = 0.1;

/** Default Epic (L2) badge color when issue.badge_color is unset. */
export const DEFAULT_EPIC_BADGE_COLOR = "#8B5CF6";

/** Preset CSS gradients for Epic (L2) badge_color. */
export const EPIC_BADGE_GRADIENT_PRESETS = [
  "linear-gradient(90deg, #8B5CF6, #EC4899)",
  "linear-gradient(90deg, #3B82F6, #06B6D4)",
  "linear-gradient(90deg, #F59E0B, #EF4444)",
  "linear-gradient(135deg, #10B981, #3B82F6)",
  "linear-gradient(90deg, #6366F1, #A855F7)",
  "linear-gradient(90deg, #14B8A6, #84CC16)",
] as const;

/** True when badge_color stores a CSS gradient (vs solid hex/rgb). */
export const isEpicBadgeGradient = (value?: string | null): boolean =>
  Boolean(value?.trim().toLowerCase().includes("gradient"));
