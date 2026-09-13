/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { differenceInCalendarDays } from "date-fns/differenceInCalendarDays";
import { observer } from "mobx-react";
import type { TGroupedIssues, TIssue, TIssueMap, TPaginationData, ICalendarDate } from "@plane/types";
import { MONTHS_LIST } from "@plane/constants";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { cn, renderFormattedPayloadDate } from "@plane/utils";
import { highlightIssueOnDrop } from "@/components/issues/issue-layouts/utils";
import { useProjectEvent } from "@/hooks/store/use-project-event";
import type { ICycleIssuesFilter } from "@/store/issue/cycle";
import type { IModuleIssuesFilter } from "@/store/issue/module";
import type { IProjectIssuesFilter } from "@/store/issue/project";
import type { IProjectViewIssuesFilter } from "@/store/issue/project-views";
import type { TRenderQuickActions } from "../../list/list-view-types";
import { CalendarIssueBlocks } from "../issue-blocks";
import { useScrumbanCalendar } from "./context";
import { CalendarEventBar, applyEventDrop, parseEventDragPayload } from "./event-bar";
import { MAX_VISIBLE_EVENT_ROWS, getEventSegmentForDay, isSingleDayEvent } from "./event-utils";

type Props = {
  issuesFilterStore: IProjectIssuesFilter | IModuleIssuesFilter | ICycleIssuesFilter | IProjectViewIssuesFilter;
  date: ICalendarDate;
  issues: TIssueMap | undefined;
  groupedIssueIds: TGroupedIssues;
  loadMoreIssues: (dateString: string) => void;
  getPaginationData: (groupId: string | undefined) => TPaginationData | undefined;
  getGroupIssueCount: (groupId: string | undefined) => number | undefined;
  enableQuickIssueCreate?: boolean;
  disableIssueCreation?: boolean;
  quickAddCallback?: (projectId: string | null | undefined, data: TIssue) => Promise<TIssue | undefined>;
  quickActions: TRenderQuickActions;
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
};

export const ScrumbanCalendarDayTile = observer(function ScrumbanCalendarDayTile(props: Props) {
  const {
    date,
    issues,
    groupedIssueIds,
    loadMoreIssues,
    getPaginationData,
    getGroupIssueCount,
    quickActions,
    quickAddCallback,
    addIssuesToView,
    readOnly = false,
    selectedDate,
    handleDragAndDrop,
    setSelectedDate,
    canEditProperties,
    isEpic = false,
  } = props;

  const {
    canEdit,
    startRangeDrag,
    updateRangeDrag,
    isRangeDragging,
    isDateInRangeSelection,
    workspaceSlug,
    projectId,
  } = useScrumbanCalendar();
  const { getEventsForDate, getEventById, updateEvent } = useProjectEvent();

  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const dayTileRef = useRef<HTMLDivElement | null>(null);

  const formattedDatePayload = renderFormattedPayloadDate(date.date);

  useEffect(() => {
    const element = dayTileRef.current;
    if (!element || !formattedDatePayload) return;

    return combine(
      dropTargetForElements({
        element,
        getData: () => ({ date: formattedDatePayload }),
        onDragEnter: () => setIsDraggingOver(true),
        onDragLeave: () => setIsDraggingOver(false),
        onDrop: ({ source, self }) => {
          setIsDraggingOver(false);
          const sourceData = source?.data as { id: string; date: string } | undefined;
          const destinationData = self?.data as { date: string } | undefined;
          if (!sourceData || !destinationData) return;

          const issueDetails = issues?.[sourceData?.id];
          if (issueDetails?.start_date) {
            const issueStartDate = new Date(issueDetails.start_date);
            const targetDate = new Date(destinationData?.date);
            if (differenceInCalendarDays(targetDate, issueStartDate) < 0) {
              setToast({
                type: TOAST_TYPE.ERROR,
                title: "Error!",
                message: "Due date cannot be before the start date of the work item.",
              });
              return;
            }
          }

          void handleDragAndDrop(
            sourceData?.id,
            issueDetails?.project_id ?? undefined,
            sourceData?.date,
            destinationData?.date
          );
          highlightIssueOnDrop(source?.element?.id, false);
        },
      })
    );
  }, [
	formattedDatePayload,
	handleDragAndDrop,
	issues
]);

  if (!formattedDatePayload) return null;

  const isWeekend = [0, 6].includes(date.date.getDay());

  // Padding days from adjacent months: keep grid slot, hide date/content
  if (!date.is_current_month) {
    return (
      <div
        className={cn("hidden h-full min-h-[5rem] w-full md:block", isWeekend ? "bg-layer-1/50" : "bg-surface-1")}
        aria-hidden
      />
    );
  }

  const issueIds = groupedIssueIds?.[formattedDatePayload] ?? [];
  // Only single-day events render in the day cell; multi-day use week span bars
  const singleDayEvents = getEventsForDate(formattedDatePayload).filter(isSingleDayEvent);
  const segments = singleDayEvents
    .map((event) => getEventSegmentForDay(event, formattedDatePayload))
    .filter((s): s is NonNullable<typeof s> => !!s);

  const isToday = date.date.toDateString() === new Date().toDateString();
  const isSelectedDate = date.date.toDateString() === selectedDate.toDateString();
  const inRange = isDateInRangeSelection(formattedDatePayload);

  // Big card only for a single one-day event (optional cover image)
  const fillSingleEvent = segments.length === 1 && issueIds.length === 0;
  const visibleSegments = showAllEvents ? segments : segments.slice(0, MAX_VISIBLE_EVENT_ROWS);
  const overflowCount = Math.max(0, segments.length - MAX_VISIBLE_EVENT_ROWS);
  const normalBackground = isWeekend ? "bg-layer-1" : "bg-layer-transparent";
  const draggingOverBackground = isWeekend ? "bg-layer-1" : "bg-layer-transparent-hover";

  const handleEventDrop = async (dataTransfer: DataTransfer) => {
    const payload = parseEventDragPayload(dataTransfer);
    if (!payload) return;
    try {
      await applyEventDrop(
        payload,
        formattedDatePayload,
        getEventById(payload.eventId),
        updateEvent,
        workspaceSlug,
        projectId
      );
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: "Error!", message: "Could not update event." });
    }
  };

  return (
    // oxlint-disable-next-line jsx_a11y/no-static-element-interactions
    <div
      ref={dayTileRef}
      className={cn("group relative flex h-full w-full flex-col", {
        "ring-1 ring-inset ring-accent-primary/40": inRange,
      })}
      onDragOver={(e) => {
        if ([...e.dataTransfer.types].includes("application/x-plane-event")) {
          e.preventDefault();
          setIsDraggingOver(true);
        }
      }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={(e) => {
        if ([...e.dataTransfer.types].includes("application/x-plane-event")) {
          e.preventDefault();
          e.stopPropagation();
          setIsDraggingOver(false);
          void handleEventDrop(e.dataTransfer);
        }
      }}
      onMouseDown={(e) => {
        if (!canEdit || e.button !== 0) return;
        if ((e.target as HTMLElement).closest("[data-event-bar],[data-issue-block]")) return;
        startRangeDrag(formattedDatePayload);
      }}
      onMouseEnter={() => {
        if (isRangeDragging) updateRangeDrag(formattedDatePayload);
      }}
    >
      <div
        className={cn(
          "hidden flex-shrink-0 justify-end px-2 py-1.5 text-right text-11 md:flex",
          date.is_current_month ? "font-medium" : "text-tertiary",
          isWeekend ? "bg-layer-1" : "bg-layer-transparent"
        )}
      >
        {date.date.getDate() === 1 && `${MONTHS_LIST[date.date.getMonth() + 1].shortTitle} `}
        {isToday ? (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-primary text-on-color">
            {date.date.getDate()}
          </span>
        ) : (
          date.date.getDate()
        )}
      </div>

      <div className="hidden h-full w-full md:block">
        <div
          className={cn(
            `h-full w-full select-none ${isDraggingOver ? `${draggingOverBackground} opacity-70` : normalBackground}`,
            { "min-h-[5rem]": true }
          )}
        >
          {fillSingleEvent && segments[0] ? (
            <div className="p-1" data-event-bar>
              <CalendarEventBar segment={segments[0]} fillCell />
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-0.5 px-1 pt-0.5">
                {visibleSegments.map((segment) => (
                  <div key={segment.event.id} data-event-bar>
                    <CalendarEventBar segment={segment} />
                  </div>
                ))}
                {overflowCount > 0 && !showAllEvents && (
                  <button
                    type="button"
                    className="px-1 text-left text-10 font-medium text-accent-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAllEvents(true);
                    }}
                  >
                    +{overflowCount} more
                  </button>
                )}
              </div>
              <div data-issue-block>
                <CalendarIssueBlocks
                  date={date.date}
                  issueIdList={issueIds}
                  quickActions={quickActions}
                  loadMoreIssues={loadMoreIssues}
                  getPaginationData={getPaginationData}
                  getGroupIssueCount={getGroupIssueCount}
                  isDragDisabled={readOnly}
                  addIssuesToView={addIssuesToView}
                  disableIssueCreation
                  enableQuickIssueCreate={false}
                  quickAddCallback={quickAddCallback}
                  readOnly={readOnly}
                  canEditProperties={canEditProperties}
                  isEpic={isEpic}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* oxlint-disable-next-line jsx_a11y/click-events-have-key-events, jsx_a11y/no-static-element-interactions */}
      <div
        onClick={() => setSelectedDate(date.date)}
        className={cn(
          "mx-auto flex h-full w-full cursor-pointer flex-col items-center justify-start py-2.5 text-13 font-medium opacity-80 md:hidden",
          { "bg-layer-2": !isWeekend }
        )}
      >
        <div
          className={cn("flex size-6 items-center justify-center rounded-full", {
            "bg-accent-primary text-on-color": isSelectedDate,
            "bg-accent-primary/10 text-accent-primary": isToday && !isSelectedDate,
          })}
        >
          {date.date.getDate()}
        </div>
        {singleDayEvents.length > 0 && (
          <div className="mt-1 flex gap-0.5">
            {singleDayEvents.slice(0, 3).map((event) => (
              <span key={event.id} className="size-1 rounded-full" style={{ backgroundColor: event.color }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
