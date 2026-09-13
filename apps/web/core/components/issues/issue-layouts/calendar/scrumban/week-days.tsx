/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import type { TGroupedIssues, TIssue, TIssueMap, TPaginationData, ICalendarDate, ICalendarWeek } from "@plane/types";
import { cn, getOrderedDays, renderFormattedPayloadDate } from "@plane/utils";
import { useProjectEvent } from "@/hooks/store/use-project-event";
import { useUserProfile } from "@/hooks/store/user";
import type { ICycleIssuesFilter } from "@/store/issue/cycle";
import type { IModuleIssuesFilter } from "@/store/issue/module";
import type { IProjectIssuesFilter } from "@/store/issue/project";
import type { IProjectViewIssuesFilter } from "@/store/issue/project-views";
import type { TRenderQuickActions } from "../../list/list-view-types";
import { ScrumbanCalendarDayTile } from "./day-tile";
import { CalendarEventSpanBar } from "./event-bar";
import { EVENT_LANE_HEIGHT, layoutMultiDayEventsForWeek, toDateKey } from "./event-utils";

type Props = {
  issuesFilterStore: IProjectIssuesFilter | IModuleIssuesFilter | ICycleIssuesFilter | IProjectViewIssuesFilter;
  issues: TIssueMap | undefined;
  groupedIssueIds: TGroupedIssues;
  week: ICalendarWeek | undefined;
  quickActions: TRenderQuickActions;
  loadMoreIssues: (dateString: string) => void;
  getPaginationData: (groupId: string | undefined) => TPaginationData | undefined;
  getGroupIssueCount: (groupId: string | undefined) => number | undefined;
  enableQuickIssueCreate?: boolean;
  disableIssueCreation?: boolean;
  quickAddCallback?: (projectId: string | null | undefined, data: TIssue) => Promise<TIssue | undefined>;
  handleDragAndDrop: (
    issueId: string | undefined,
    issueProjectId: string | undefined,
    sourceDate: string | undefined,
    destinationDate: string | undefined
  ) => Promise<void>;
  addIssuesToView?: (issueIds: string[]) => Promise<any>;
  readOnly?: boolean;
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  canEditProperties: (projectId: string | undefined) => boolean;
  isEpic?: boolean;
  /** Scrumban always shows weekends */
  showWeekends?: boolean;
};

export const ScrumbanCalendarWeekDays = observer(function ScrumbanCalendarWeekDays(props: Props) {
  const {
    issuesFilterStore,
    issues,
    groupedIssueIds,
    handleDragAndDrop,
    week,
    loadMoreIssues,
    getPaginationData,
    getGroupIssueCount,
    quickActions,
    enableQuickIssueCreate,
    disableIssueCreation,
    quickAddCallback,
    addIssuesToView,
    readOnly = false,
    selectedDate,
    setSelectedDate,
    canEditProperties,
    isEpic = false,
    showWeekends = true,
  } = props;

  const { data } = useUserProfile();
  const startOfWeek = data?.start_of_the_week;
  const { getEventsOverlappingRange } = useProjectEvent();

  if (!week) return null;

  const shouldShowDay = (dayDate: Date) => {
    if (showWeekends) return true;
    const day = dayDate.getDay();
    return !(day === 0 || day === 6);
  };

  const sortedWeekDays = getOrderedDays(Object.values(week), (item) => item.date.getDay(), startOfWeek).filter((day) =>
    shouldShowDay(day.date)
  );

  const dayKeys = sortedWeekDays.map((day) => renderFormattedPayloadDate(day.date)).filter((k): k is string => !!k);
  const activeMask = sortedWeekDays.map((day) => day.is_current_month);

  // Only consider events against current-month days in this section
  const activeKeys = dayKeys.filter((_, i) => activeMask[i]);
  const weekStart = activeKeys[0];
  const weekEnd = activeKeys[activeKeys.length - 1];
  const weekEvents =
    weekStart && weekEnd
      ? getEventsOverlappingRange(weekStart, weekEnd).filter(
          (event) => toDateKey(event.start_at) !== toDateKey(event.end_at)
        )
      : [];

  const placements = layoutMultiDayEventsForWeek(weekEvents, dayKeys, activeMask);
  const laneCount = placements.reduce((max, p) => Math.max(max, p.lane + 1), 0);
  const columnCount = sortedWeekDays.length || 7;

  // Skip weeks that have no days in the current month (pure padding weeks)
  if (!activeKeys.length) return null;

  return (
    <div className="relative">
      {/* Continuous multi-day event lanes — clipped to current-month columns */}
      {laneCount > 0 && (
        <div
          className="relative mx-0.5 mt-0.5 hidden md:block"
          style={{ height: laneCount * EVENT_LANE_HEIGHT }}
          data-event-bar
        >
          {placements.map((placement) => (
            <div
              key={placement.event.id}
              className="absolute right-0 left-0"
              style={{ top: placement.lane * EVENT_LANE_HEIGHT, height: EVENT_LANE_HEIGHT - 2 }}
            >
              <CalendarEventSpanBar placement={placement} columnCount={columnCount} />
            </div>
          ))}
        </div>
      )}

      <div
        className={cn("grid divide-subtle-1 md:divide-x-[0.5px]", {
          "grid-cols-7": showWeekends,
          "grid-cols-5": !showWeekends,
        })}
      >
        {sortedWeekDays.map((day: ICalendarDate) => (
          <ScrumbanCalendarDayTile
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            issuesFilterStore={issuesFilterStore}
            key={renderFormattedPayloadDate(day.date)}
            date={day}
            issues={issues}
            groupedIssueIds={groupedIssueIds}
            loadMoreIssues={loadMoreIssues}
            getPaginationData={getPaginationData}
            getGroupIssueCount={getGroupIssueCount}
            quickActions={quickActions}
            enableQuickIssueCreate={enableQuickIssueCreate}
            disableIssueCreation={disableIssueCreation}
            quickAddCallback={quickAddCallback}
            addIssuesToView={addIssuesToView}
            readOnly={readOnly}
            handleDragAndDrop={handleDragAndDrop}
            canEditProperties={canEditProperties}
            isEpic={isEpic}
          />
        ))}
      </div>
    </div>
  );
});
