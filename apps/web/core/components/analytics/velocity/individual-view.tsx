/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo, useState } from "react";
import { observer } from "mobx-react";
import { ChevronDown, FileText, User } from "lucide-react";
import { useParams } from "next/navigation";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { BarChart } from "@plane/propel/charts/bar-chart";
import { EmptyStateCompact } from "@plane/propel/empty-state";
import type { TChartData, TVelocityIndividualResponse } from "@plane/types";
import { MemberDropdown } from "@/components/dropdowns/member/dropdown";
import { useMember } from "@/hooks/store/use-member";
import AnalyticsSectionWrapper from "../analytics-section-wrapper";
import { ChartLoader } from "../loaders";
import { VelocityKpis } from "./kpis";
import { ManhourReportModal } from "./manhour-report";
import { VelocityWorkItemsList } from "./work-items-list";

type Props = {
  data?: TVelocityIndividualResponse;
  isLoading: boolean;
  assigneeId: string | null;
  onAssigneeChange: (id: string | null) => void;
};

export const VelocityIndividualView = observer(function VelocityIndividualView(props: Props) {
  const { data, isLoading, assigneeId, onAssigneeChange } = props;
  const { t } = useTranslation();
  const { workspaceSlug } = useParams();
  const { getUserDetails } = useMember();
  const [isReportOpen, setIsReportOpen] = useState(false);
  const slug = workspaceSlug?.toString() ?? "";
  const assigneeName =
    (assigneeId ? getUserDetails(assigneeId)?.display_name : undefined) ||
    t("workspace_analytics.velocity.select_person");

  const chartData: TChartData<string, string>[] = useMemo(
    () =>
      (data?.sprints ?? []).map((row) => ({
        key: row.cycle_id,
        name: `${row.project_name} · ${row.cycle_name}`,
        story_points: row.story_points,
        personal_leave_days: row.personal_leave_days,
      })),
    [data?.sprints]
  );

  const kpis = [
    { label: t("workspace_analytics.velocity.total_sp"), value: data?.kpis.total_story_points ?? 0 },
    { label: t("workspace_analytics.velocity.avg_per_sprint"), value: data?.kpis.avg_per_sprint ?? 0 },
    { label: t("workspace_analytics.velocity.sprints"), value: data?.kpis.sprint_count ?? 0 },
    { label: t("workspace_analytics.velocity.tickets"), value: data?.kpis.ticket_count ?? 0 },
    { label: t("workspace_analytics.velocity.personal_leave"), value: data?.kpis.personal_leave_days ?? 0 },
  ];

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-center gap-2">
        <MemberDropdown
          value={assigneeId}
          onChange={onAssigneeChange}
          multiple={false}
          buttonVariant="border-with-text"
          placeholder={t("workspace_analytics.velocity.select_person")}
          showUserDetails
          button={
            <span className="inline-flex h-7 min-w-[10rem] items-center justify-between gap-1 rounded-md border border-strong bg-layer-2 px-2 text-body-xs-medium text-secondary shadow-raised-100 hover:bg-layer-2-hover">
              <span className="flex items-center gap-1 truncate">
                <User className="size-4 shrink-0" />
                <span className="truncate">{assigneeName}</span>
              </span>
              <ChevronDown className="size-4 shrink-0" />
            </span>
          }
        />
        {assigneeId && (
          <Button
            variant="primary"
            size="lg"
            prependIcon={<FileText className="h-3.5 w-3.5" />}
            onClick={() => setIsReportOpen(true)}
          >
            {t("workspace_analytics.velocity.manhour_report.open")}
          </Button>
        )}
      </div>
      {assigneeId && (
        <ManhourReportModal
          isOpen={isReportOpen}
          onClose={() => setIsReportOpen(false)}
          workspaceSlug={slug}
          assigneeId={assigneeId}
        />
      )}

      {!assigneeId ? (
        <EmptyStateCompact
          assetKey="unknown"
          assetClassName="size-16"
          rootClassName="border border-subtle px-5 py-10"
          title={t("workspace_analytics.velocity.empty_person")}
        />
      ) : (
        <>
          <VelocityKpis items={kpis} isLoading={isLoading} />
          <AnalyticsSectionWrapper title={t("workspace_analytics.velocity.speed")}>
            {isLoading ? (
              <ChartLoader />
            ) : chartData.length === 0 ? (
              <EmptyStateCompact
                assetKey="unknown"
                assetClassName="size-16"
                rootClassName="border border-subtle px-5 py-10"
                title={t("workspace_analytics.velocity.empty")}
              />
            ) : (
              <BarChart
                className="h-[320px] w-full"
                data={chartData}
                bars={[
                  {
                    key: "story_points",
                    label: t("workspace_analytics.velocity.story_points"),
                    fill: "#3B82F6",
                    textClassName: "",
                    stackId: "sp",
                    showTopBorderRadius: () => true,
                    showBottomBorderRadius: () => true,
                  },
                ]}
                xAxis={{ key: "name", label: t("common.cycle") }}
                yAxis={{ key: "story_points", label: t("workspace_analytics.velocity.story_points") }}
              />
            )}
          </AnalyticsSectionWrapper>
          <AnalyticsSectionWrapper title={t("workspace_analytics.velocity.work_items")}>
            <p className="mb-3 text-12 text-tertiary">{t("workspace_analytics.velocity.leave_hint")}</p>
            {data?.sprints && data.sprints.length > 0 && (
              <p className="mb-3 text-12 text-tertiary">
                {data.sprints
                  .map((sprint) => `${sprint.project_name} · ${sprint.cycle_name}: ${sprint.personal_leave_days}`)
                  .join(" · ")}
              </p>
            )}
            <VelocityWorkItemsList items={data?.work_items.items ?? []} />
          </AnalyticsSectionWrapper>
        </>
      )}
    </div>
  );
});
