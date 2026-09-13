/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { autoScrollForElements } from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/element";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import type { TSupportedFilterTypeForUpdate } from "@plane/constants";
import type {
  TGroupedIssues,
  TIssue,
  TIssueMap,
  TPaginationData,
  TProjectEvent,
  TSupportedFilterForUpdate,
} from "@plane/types";
import { EIssueLayoutTypes, EIssuesStoreType } from "@plane/types";
import { Spinner } from "@plane/ui";
import { cn, renderFormattedPayloadDate } from "@plane/utils";
import { MONTHS_LIST } from "@plane/constants";
import { useProjectEvent } from "@/hooks/store/use-project-event";
import { useIssues } from "@/hooks/store/use-issues";
import useSize from "@/hooks/use-window-size";
import type { ICycleIssuesFilter } from "@/store/issue/cycle";
import type { ICalendarStore } from "@/store/issue/issue_calendar_view.store";
import type { IModuleIssuesFilter } from "@/store/issue/module";
import type { IProjectIssuesFilter } from "@/store/issue/project";
import type { IProjectViewIssuesFilter } from "@/store/issue/project-views";
import { IssueLayoutHOC } from "../../issue-layout-HOC";
import type { TRenderQuickActions } from "../../list/list-view-types";
import { CalendarHeader } from "../header";
import { CalendarIssueBlocks } from "../issue-blocks";
import { CalendarWeekHeader } from "../week-header";
import type { TEventDraft, TRangeDragState } from "./context";
import { ScrumbanCalendarContext } from "./context";
import { CalendarEventFormPopover } from "./event-form";
import { ScrumbanCalendarMonthSection } from "./month-section";
import { buildFixedMonthWindow, firstOfMonth, minMaxDateKeys, monthKey, toDateKey } from "./event-utils";

type Props = {
  issuesFilterStore: IProjectIssuesFilter | IModuleIssuesFilter | ICycleIssuesFilter | IProjectViewIssuesFilter;
  issues: TIssueMap | undefined;
  groupedIssueIds: TGroupedIssues;
  showWeekends: boolean;
  issueCalendarView: ICalendarStore;
  loadMoreIssues: (dateString: string) => void;
  getPaginationData: (groupId: string | undefined) => TPaginationData | undefined;
  getGroupIssueCount: (groupId: string | undefined) => number | undefined;
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
  updateFilters?: (
    projectId: string,
    filterType: TSupportedFilterTypeForUpdate,
    filters: TSupportedFilterForUpdate
  ) => Promise<void>;
  canEditProperties: (projectId: string | undefined) => boolean;
  isEpic?: boolean;
};

export const ScrumbanCalendarChart = observer(function ScrumbanCalendarChart(props: Props) {
  const {
    issuesFilterStore,
    issues,
    groupedIssueIds,
    issueCalendarView,
    loadMoreIssues,
    handleDragAndDrop,
    quickActions,
    quickAddCallback,
    addIssuesToView,
    getPaginationData,
    getGroupIssueCount,
    updateFilters,
    canEditProperties,
    readOnly = false,
    isEpic = false,
  } = props;

  const { workspaceSlug, projectId } = useParams();
  const { fetchEvents } = useProjectEvent();
  const {
    issues: { viewFlags },
  } = useIssues(EIssuesStoreType.PROJECT);

  // Always include Sat/Sun on Scrumban calendar
  const showWeekends = true;

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [months] = useState<Date[]>(() => buildFixedMonthWindow());
  const [rangeDrag, setRangeDrag] = useState<TRangeDragState>(null);
  const [isRangeDragging, setIsRangeDragging] = useState(false);
  const [draft, setDraft] = useState<TEventDraft | null>(null);
  const [windowWidth] = useSize();
  const [didInitialScroll, setDidInitialScroll] = useState(false);

  const scrollableContainerRef = useRef<HTMLDivElement | null>(null);
  const suppressScrollJumpRef = useRef(false);
  const slug = workspaceSlug?.toString() ?? "";
  const pid = projectId?.toString() ?? "";
  const canEdit = !readOnly && !!canEditProperties(pid);

  // Ensure payload + scroll range for issue fetch
  useEffect(() => {
    months.forEach((m) => issueCalendarView.ensureMonthPayload(m));

    const first = months[0];
    const last = months[months.length - 1];
    if (!first || !last) return;

    const firstWeeks = issueCalendarView.getWeeksForMonth(first);
    const lastWeeks = issueCalendarView.getWeeksForMonth(last);
    if (!firstWeeks || !lastWeeks) return;

    const firstWeekKeys = Object.keys(firstWeeks);
    const lastWeekKeys = Object.keys(lastWeeks);
    const startDates = Object.keys(firstWeeks[firstWeekKeys[0]] ?? {});
    const endDates = Object.keys(lastWeeks[lastWeekKeys[lastWeekKeys.length - 1]] ?? {});
    if (!startDates[0] || !endDates[endDates.length - 1]) return;

    issueCalendarView.setScrollMonthRange({
      startDate: startDates[0],
      endDate: endDates[endDates.length - 1],
    });
  }, [months, issueCalendarView, issueCalendarView.calendarPayload]);

  useEffect(
    () => () => {
      issueCalendarView.setScrollMonthRange(null);
    },
    [issueCalendarView]
  );

  useEffect(() => {
    if (!slug || !pid || months.length === 0) return;
    const start = toDateKey(months[0]);
    const last = months[months.length - 1];
    const endDate = new Date(last.getFullYear(), last.getMonth() + 1, 0);
    const end = toDateKey(endDate);
    void fetchEvents(slug, pid, `${start}T00:00:00.000Z`, `${end}T23:59:59.999Z`);
  }, [slug, pid, months, fetchEvents]);

  useEffect(() => {
    const element = scrollableContainerRef.current;
    if (!element) return;
    return combine(autoScrollForElements({ element }));
  }, []);

  // On open: jump header + scroll to today's month
  useEffect(() => {
    const today = new Date();
    const todayMonth = firstOfMonth(today);
    issueCalendarView.updateCalendarFilters({
      activeMonthDate: todayMonth,
      activeWeekDate: today,
    });
    setSelectedDate(today);
  }, [issueCalendarView]);

  useEffect(() => {
    if (didInitialScroll) return;
    if (!issueCalendarView.calendarPayload) return;
    const todayMonth = firstOfMonth(new Date());
    const el = scrollableContainerRef.current?.querySelector(`[data-month-key="${monthKey(todayMonth)}"]`);
    if (!el) return;
    // Instant jump on first paint so calendar opens on today
    el.scrollIntoView({ block: "start", behavior: "auto" });
    setDidInitialScroll(true);
  }, [didInitialScroll, issueCalendarView.calendarPayload, months]);

  useEffect(() => {
    const onUp = () => {
      setIsRangeDragging(false);
      setRangeDrag((current) => {
        if (!current) return null;
        const { start, end } = minMaxDateKeys(current.originKey, current.currentKey);
        setDraft({ startKey: start, endKey: end });
        return null;
      });
    };
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, []);

  const onMonthVisible = useCallback(
    (monthDate: Date) => {
      suppressScrollJumpRef.current = true;
      issueCalendarView.updateCalendarFilters({
        activeMonthDate: firstOfMonth(monthDate),
      });
    },
    [issueCalendarView]
  );

  const scrollToToday = useCallback(() => {
    const today = new Date();
    const todayMonth = firstOfMonth(today);
    suppressScrollJumpRef.current = false;
    issueCalendarView.updateCalendarFilters({
      activeMonthDate: todayMonth,
      activeWeekDate: today,
    });
    setSelectedDate(today);
    requestAnimationFrame(() => {
      const el = scrollableContainerRef.current?.querySelector(`[data-month-key="${monthKey(todayMonth)}"]`);
      el?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }, [issueCalendarView]);

  // Month dropdown jump within the fixed ±6 window
  const activeMonthDate = issueCalendarView.calendarFilters.activeMonthDate;
  useEffect(() => {
    if (!didInitialScroll) return;
    if (suppressScrollJumpRef.current) {
      suppressScrollJumpRef.current = false;
      return;
    }
    const target = firstOfMonth(activeMonthDate);
    if (!months.some((m) => monthKey(m) === monthKey(target))) return;
    requestAnimationFrame(() => {
      const el = scrollableContainerRef.current?.querySelector(`[data-month-key="${monthKey(target)}"]`);
      el?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }, [activeMonthDate, didInitialScroll, months]);

  const contextValue = useMemo(
    () => ({
      workspaceSlug: slug,
      projectId: pid,
      canEdit,
      rangeDrag,
      draft,
      isRangeDragging,
      startRangeDrag: (dateKey: string) => {
        setIsRangeDragging(true);
        setRangeDrag({ originKey: dateKey, currentKey: dateKey });
      },
      updateRangeDrag: (dateKey: string) => setRangeDrag((prev) => (prev ? { ...prev, currentKey: dateKey } : null)),
      endRangeDrag: () => {
        // handled by window mouseup
      },
      openCreateDraft: (startKey: string, endKey: string) => {
        const { start, end } = minMaxDateKeys(startKey, endKey);
        setDraft({ startKey: start, endKey: end });
      },
      openEditDraft: (event: TProjectEvent) => {
        setDraft({
          startKey: toDateKey(event.start_at),
          endKey: toDateKey(event.end_at),
          event,
        });
      },
      closeDraft: () => setDraft(null),
      isDateInRangeSelection: (dateKey: string) => {
        if (!rangeDrag) return false;
        const { start, end } = minMaxDateKeys(rangeDrag.originKey, rangeDrag.currentKey);
        return dateKey >= start && dateKey <= end;
      },
    }),
    [slug, pid, canEdit, rangeDrag, draft, isRangeDragging]
  );

  const formattedDatePayload = renderFormattedPayloadDate(selectedDate) ?? undefined;
  if (!issueCalendarView.calendarPayload || !formattedDatePayload) {
    return (
      <div className="grid h-full w-full place-items-center">
        <Spinner />
      </div>
    );
  }

  const issueIdList = groupedIssueIds ? groupedIssueIds[formattedDatePayload] : [];
  const { enableIssueCreation, enableQuickAdd } = viewFlags || {};

  return (
    <ScrumbanCalendarContext.Provider value={contextValue}>
      <div className="flex h-full w-full flex-col overflow-hidden">
        <CalendarHeader
          setSelectedDate={setSelectedDate}
          issuesFilterStore={issuesFilterStore}
          updateFilters={updateFilters}
          hideMonthArrows
          onTodayClick={scrollToToday}
        />

        <IssueLayoutHOC layout={EIssueLayoutTypes.CALENDAR}>
          <div
            className={cn("flex w-full flex-col overflow-y-auto md:h-full", {
              "vertical-scrollbar scrollbar-lg": windowWidth > 768,
            })}
            ref={scrollableContainerRef}
          >
            <CalendarWeekHeader isLoading={!issues} showWeekends={showWeekends} />
            <div className="w-full pb-16">
              {months.map((monthDate) => (
                <ScrumbanCalendarMonthSection
                  key={monthKey(monthDate)}
                  monthDate={monthDate}
                  issuesFilterStore={issuesFilterStore}
                  issues={issues}
                  groupedIssueIds={groupedIssueIds}
                  loadMoreIssues={loadMoreIssues}
                  getPaginationData={getPaginationData}
                  getGroupIssueCount={getGroupIssueCount}
                  quickActions={quickActions}
                  quickAddCallback={quickAddCallback}
                  addIssuesToView={addIssuesToView}
                  readOnly={readOnly}
                  selectedDate={selectedDate}
                  setSelectedDate={setSelectedDate}
                  handleDragAndDrop={handleDragAndDrop}
                  canEditProperties={canEditProperties}
                  isEpic={isEpic}
                  onMonthVisible={onMonthVisible}
                  showWeekends={showWeekends}
                />
              ))}
            </div>

            <div className="md:hidden">
              <p className="p-4 text-18 font-semibold">
                {`${selectedDate.getDate()} ${MONTHS_LIST[selectedDate.getMonth() + 1].title}, ${selectedDate.getFullYear()}`}
              </p>
              <CalendarIssueBlocks
                date={selectedDate}
                issueIdList={issueIdList}
                loadMoreIssues={loadMoreIssues}
                getPaginationData={getPaginationData}
                getGroupIssueCount={getGroupIssueCount}
                quickActions={quickActions}
                enableQuickIssueCreate={enableQuickAdd}
                disableIssueCreation={!enableIssueCreation}
                quickAddCallback={quickAddCallback}
                addIssuesToView={addIssuesToView}
                readOnly={readOnly}
                canEditProperties={canEditProperties}
                isDragDisabled
                isMobileView
                isEpic={isEpic}
              />
            </div>
          </div>
        </IssueLayoutHOC>
      </div>
      <CalendarEventFormPopover />
    </ScrumbanCalendarContext.Provider>
  );
});
