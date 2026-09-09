/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { EIssueFilterType } from "@plane/constants";
import type { GroupByColumnTypes, TGroupedIssues, TIssueKanbanFilters } from "@plane/types";
import { EIssueLayoutTypes } from "@plane/types";
import { resolveDisplayFiltersForLayout } from "@plane/utils";
import { collectGroupedIssueIds, getGroupByColumns, isWorkspaceLevel } from "@/components/issues/issue-layouts/utils";
import { useIssues } from "@/hooks/store/use-issues";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
import { useIssuesActions } from "@/hooks/use-issues-actions";

/** List: 0 = all collapsed, 1 = epics + L3, 2 = epics + L3 + L4. Board: 0 = collapsed, 1 = expanded. */
export type TIssueExpandCollapseLevel = 0 | 1 | 2;

export type TIssueExpandNextAction = "collapse" | "expand" | "expand-l3" | "expand-l4";

type TIssueExpandCollapseContextValue = {
  cycle: () => void;
  isAvailable: boolean;
  /** Nesting rows should expand when list level is 2. */
  listNestedExpand: boolean;
  level: TIssueExpandCollapseLevel;
  maxLevel: 1 | 2;
  nextAction: TIssueExpandNextAction;
};

const IssueExpandCollapseContext = createContext<TIssueExpandCollapseContextValue | null>(null);

export const useIssueExpandCollapse = (): TIssueExpandCollapseContextValue => {
  const value = useContext(IssueExpandCollapseContext);
  if (!value) {
    return {
      cycle: () => undefined,
      isAvailable: false,
      listNestedExpand: false,
      level: 1,
      maxLevel: 1,
      nextAction: "expand",
    };
  }
  return value;
};

/**
 * List starts at step 0 (= L3 under epics / level 1), then:
 *   collapse all (0) → L3 (1) → L3+L4 (2) → collapse all (0) …
 * Board: even step = expanded, odd = collapsed.
 */
const levelForStep = (step: number, isBoard: boolean): TIssueExpandCollapseLevel => {
  if (isBoard) return (step % 2 === 0 ? 1 : 0) as TIssueExpandCollapseLevel;
  if (step === 0) return 1;
  return ((step - 1) % 3) as TIssueExpandCollapseLevel;
};

const nextActionForStep = (step: number, isBoard: boolean): TIssueExpandNextAction => {
  const upcoming = levelForStep(step + 1, isBoard);
  if (isBoard) return upcoming === 0 ? "collapse" : "expand";
  if (upcoming === 0) return "collapse";
  if (upcoming === 1) return "expand-l3";
  return "expand-l4";
};

type ProviderProps = {
  children: React.ReactNode;
  isEpic?: boolean;
};

export const IssueExpandCollapseProvider = observer(function IssueExpandCollapseProvider(props: ProviderProps) {
  const { children, isEpic = false } = props;
  const { projectId } = useParams();
  const storeType = useIssueStoreType();
  const { issuesFilter, issues } = useIssues(storeType);
  const { updateFilters } = useIssuesActions(storeType);

  const displayFilters = resolveDisplayFiltersForLayout(issuesFilter?.issueFilters?.displayFilters);
  const layout = displayFilters?.layout ?? issuesFilter?.issueFilters?.displayFilters?.layout;
  const group_by = displayFilters?.group_by ?? null;
  const sub_group_by = displayFilters?.sub_group_by ?? null;
  const showEmptyGroup = displayFilters?.show_empty_groups ?? false;

  const isList = layout === EIssueLayoutTypes.LIST || layout === "list";
  const isBoard = layout === EIssueLayoutTypes.KANBAN || layout === "kanban";
  const isAvailable = (isList || isBoard) && Boolean(group_by || sub_group_by);
  const maxLevel: 1 | 2 = isList ? 2 : 1;

  const [step, setStep] = useState(0);

  // Reset cycle when switching list ↔ board
  useEffect(() => {
    setStep(0);
  }, [layout]);

  const level = useMemo(() => (isAvailable ? levelForStep(step, isBoard) : 1), [isAvailable, isBoard, step]);

  const nextAction = useMemo(
    () => (isAvailable ? nextActionForStep(step, isBoard) : "expand"),
    [isAvailable, isBoard, step]
  );

  const collapseKey: "group_by" | "sub_group_by" = sub_group_by ? "sub_group_by" : "group_by";
  const columnGroupBy = (sub_group_by ?? group_by) as GroupByColumnTypes | null;

  const getCollapsibleGroupIds = useCallback((): string[] => {
    if (!columnGroupBy) return [];

    const columns =
      getGroupByColumns({
        groupBy: columnGroupBy,
        includeNone: true,
        isWorkspaceLevel: isWorkspaceLevel(storeType),
        isEpic,
        asSubGroup: Boolean(sub_group_by),
        issueIds: sub_group_by ? collectGroupedIssueIds((issues?.groupedIssueIds ?? {}) as TGroupedIssues) : undefined,
      }) ?? [];

    if (sub_group_by) {
      return columns
        .filter((column) => {
          if (showEmptyGroup) return true;
          return (issues?.getGroupIssueCount?.(undefined, column.id, true) ?? 0) > 0;
        })
        .map((column) => column.id);
    }

    // List epic/"module" grouping: collapse groups that currently have issues.
    if (group_by === "module") {
      const groupedIssueIds = (issues?.groupedIssueIds ?? {}) as TGroupedIssues;
      const withIssues = columns
        .filter((column) => {
          const ids = groupedIssueIds?.[column.id];
          return Array.isArray(ids) && ids.length > 0;
        })
        .map((column) => column.id);

      if (withIssues.length > 0) return withIssues;

      // Fallback so collapse still applies if column ids and store keys briefly diverge
      return Object.entries(groupedIssueIds)
        .filter(([, ids]) => Array.isArray(ids) && ids.length > 0)
        .map(([id]) => id);
    }

    return columns.map((column) => column.id);
  }, [columnGroupBy, group_by, isEpic, issues, showEmptyGroup, storeType, sub_group_by]);

  const applyGroupCollapse = useCallback(
    (collapsed: boolean) => {
      if (!projectId || !isAvailable) return;
      const groupIds = collapsed ? getCollapsibleGroupIds() : [];
      updateFilters(projectId.toString(), EIssueFilterType.KANBAN_FILTERS, {
        [collapseKey]: groupIds,
      } as TIssueKanbanFilters);
    },
    [collapseKey, getCollapsibleGroupIds, isAvailable, projectId, updateFilters]
  );

  const cycle = useCallback(() => {
    if (!isAvailable) return;
    const nextStep = step + 1;
    const upcoming = levelForStep(nextStep, isBoard);
    // Apply group collapse/expand outside setState so React Strict Mode can't double-fire it.
    applyGroupCollapse(upcoming === 0);
    setStep(nextStep);
  }, [applyGroupCollapse, isAvailable, isBoard, step]);

  const value = useMemo<TIssueExpandCollapseContextValue>(
    () => ({
      cycle,
      isAvailable,
      listNestedExpand: isList && level >= 2,
      level,
      maxLevel,
      nextAction,
    }),
    [cycle, isAvailable, isList, level, maxLevel, nextAction]
  );

  return <IssueExpandCollapseContext.Provider value={value}>{children}</IssueExpandCollapseContext.Provider>;
});
