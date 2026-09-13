/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef } from "react";
import { observer } from "mobx-react";
import type { TGroupedIssues, TIssue, TIssueMap, TPaginationData } from "@plane/types";
import { MONTHS_LIST } from "@plane/constants";
import { useCalendarView } from "@/hooks/store/use-calendar-view";
import type { ICycleIssuesFilter } from "@/store/issue/cycle";
import type { IModuleIssuesFilter } from "@/store/issue/module";
import type { IProjectIssuesFilter } from "@/store/issue/project";
import type { IProjectViewIssuesFilter } from "@/store/issue/project-views";
import type { TRenderQuickActions } from "../../list/list-view-types";
import { ScrumbanCalendarWeekDays } from "./week-days";
import { monthKey } from "./event-utils";

type Props = {
  monthDate: Date;
  issuesFilterStore: IProjectIssuesFilter | IModuleIssuesFilter | ICycleIssuesFilter | IProjectViewIssuesFilter;
  issues: TIssueMap | undefined;
  groupedIssueIds: TGroupedIssues;
  quickActions: TRenderQuickActions;
  loadMoreIssues: (dateString: string) => void;
  getPaginationData: (groupId: string | undefined) => TPaginationData | undefined;
  getGroupIssueCount: (groupId: string | undefined) => number | undefined;
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
  onMonthVisible: (monthDate: Date) => void;
  showWeekends?: boolean;
};

export const ScrumbanCalendarMonthSection = observer(function ScrumbanCalendarMonthSection(props: Props) {
  const {
    monthDate,
    issuesFilterStore,
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
    setSelectedDate,
    handleDragAndDrop,
    canEditProperties,
    isEpic = false,
    onMonthVisible,
    showWeekends = true,
  } = props;

  const issueCalendarView = useCalendarView();
  const sectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    issueCalendarView.ensureMonthPayload(monthDate);
  }, [issueCalendarView, monthDate]);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && entry.intersectionRatio > 0.35) {
          onMonthVisible(monthDate);
        }
      },
      { threshold: [0.35, 0.5] }
    );
    intersectionObserver.observe(el);
    return () => intersectionObserver.disconnect();
  }, [monthDate, onMonthVisible]);

  const weeks = issueCalendarView.getWeeksForMonth(monthDate);

  return (
    <section ref={sectionRef} data-month-key={monthKey(monthDate)} className="relative">
      <div className="sticky top-11 z-[2] border-b border-subtle bg-surface-1 px-3 py-2">
        <h3 className="text-14 font-semibold text-primary">
          {MONTHS_LIST[monthDate.getMonth() + 1].title} {monthDate.getFullYear()}
        </h3>
      </div>
      <div className="grid w-full grid-cols-1 divide-y-[0.5px] divide-subtle-1">
        {weeks &&
          Object.entries(weeks).map(([weekKey, week]) => (
            <ScrumbanCalendarWeekDays
              key={`${monthKey(monthDate)}-${weekKey}`}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              handleDragAndDrop={handleDragAndDrop}
              issuesFilterStore={issuesFilterStore}
              week={week}
              issues={issues}
              groupedIssueIds={groupedIssueIds}
              loadMoreIssues={loadMoreIssues}
              getPaginationData={getPaginationData}
              getGroupIssueCount={getGroupIssueCount}
              enableQuickIssueCreate={false}
              disableIssueCreation
              quickActions={quickActions}
              quickAddCallback={quickAddCallback}
              addIssuesToView={addIssuesToView}
              readOnly={readOnly}
              canEditProperties={canEditProperties}
              isEpic={isEpic}
              showWeekends={showWeekends}
            />
          ))}
      </div>
    </section>
  );
});
