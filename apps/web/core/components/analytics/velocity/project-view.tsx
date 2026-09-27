/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo } from "react";
import { observer } from "mobx-react";
import { useTranslation } from "@plane/i18n";
import { BarChart } from "@plane/propel/charts/bar-chart";
import { EmptyStateCompact } from "@plane/propel/empty-state";
import type { TBarItem, TChartData, TVelocityProjectResponse } from "@plane/types";
import { Logo } from "@plane/propel/emoji-icon-picker";
import { ProjectIcon } from "@plane/propel/icons";
import { cn } from "@plane/utils";
import { MemberDropdown } from "@/components/dropdowns/member/dropdown";
import { useProject } from "@/hooks/store/use-project";
import AnalyticsSectionWrapper from "../analytics-section-wrapper";
import { ChartLoader } from "../loaders";
import { VelocityKpis } from "./kpis";
import { VelocityWorkItemsList } from "./work-items-list";

type Props = {
  data?: TVelocityProjectResponse;
  isLoading: boolean;
  focusProjectId: string | null;
  onFocusProject: (projectId: string) => void;
  assigneeId: string | null;
  onAssigneeChange: (id: string | null) => void;
};

const ROLE_COLORS = {
  design: "#F97316",
  dev: "#3B82F6",
  qa: "#22C55E",
  uncategorized: "#6B7280",
  story_points: "#3B82F6",
};

const stackedBar = (key: keyof typeof ROLE_COLORS, label: string, keys: string[]): TBarItem<string> => ({
  key,
  label,
  fill: ROLE_COLORS[key],
  textClassName: "",
  stackId: "role",
  showTopBorderRadius: (barKey, payload) => keys.findLast((item) => Number(payload?.[item] || 0) > 0) === barKey,
  showBottomBorderRadius: (barKey, payload) => keys.find((item) => Number(payload?.[item] || 0) > 0) === barKey,
});

export const VelocityProjectView = observer(function VelocityProjectView(props: Props) {
  const { data, isLoading, focusProjectId, onFocusProject, assigneeId, onAssigneeChange } = props;
  const { t } = useTranslation();
  const { getProjectById } = useProject();

  const projects = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of data?.comparison ?? []) {
      map.set(row.project_id, row.project_name);
    }
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [data?.comparison]);

  const comparisonData: TChartData<string, string>[] = useMemo(
    () =>
      (data?.comparison ?? []).map((row) => ({
        key: row.cycle_id,
        name: row.label,
        story_points: row.story_points,
      })),
    [data?.comparison]
  );

  const roleData: TChartData<string, string>[] = useMemo(
    () =>
      (data?.role_by_sprint ?? []).map((row) => ({
        key: row.cycle_id,
        name: row.cycle_name,
        design: row.design,
        dev: row.dev,
        qa: row.qa,
        uncategorized: row.uncategorized,
      })),
    [data?.role_by_sprint]
  );

  const isClassicFocus = (data?.comparison ?? []).some(
    (row) => row.project_id === focusProjectId && row.workflow_mode !== "staged_gate_scrumban"
  );
  const roleKeys = isClassicFocus ? ["uncategorized"] : ["design", "dev", "qa"];
  const roleBars = roleKeys.map((key) =>
    stackedBar(key as keyof typeof ROLE_COLORS, t(`workspace_analytics.velocity.${key}`), roleKeys)
  );

  const kpis = [
    { label: t("workspace_analytics.velocity.team_avg"), value: data?.kpis.team_avg_velocity ?? 0 },
    { label: t("workspace_analytics.velocity.last_sprint"), value: data?.kpis.last_sprint_sp ?? 0 },
    { label: t("workspace_analytics.velocity.avg_design"), value: data?.kpis.avg_design ?? 0 },
    { label: t("workspace_analytics.velocity.avg_dev"), value: data?.kpis.avg_dev ?? 0 },
    { label: t("workspace_analytics.velocity.avg_qa"), value: data?.kpis.avg_qa ?? 0 },
    { label: t("workspace_analytics.velocity.people"), value: data?.kpis.people_count ?? 0 },
  ];

  return (
    <div className="flex flex-col gap-10">
      <VelocityKpis items={kpis} isLoading={isLoading} />

      {projects.length > 0 && (
        <AnalyticsSectionWrapper title={t("workspace_analytics.velocity.focus_project")}>
          <div className="flex flex-wrap gap-2">
            {projects.map((project) => {
              const details = getProjectById(project.id);
              const active = project.id === focusProjectId;
              return (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => onFocusProject(project.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-13",
                    active ? "border-accent-primary bg-layer-1 text-primary" : "border-subtle text-secondary"
                  )}
                >
                  {details?.logo_props ? (
                    <Logo logo={details.logo_props} size={14} />
                  ) : (
                    <ProjectIcon className="size-3.5" />
                  )}
                  {details?.name ?? project.name}
                </button>
              );
            })}
          </div>
        </AnalyticsSectionWrapper>
      )}

      <AnalyticsSectionWrapper title={t("workspace_analytics.velocity.comparison")}>
        {isLoading ? (
          <ChartLoader />
        ) : comparisonData.length === 0 ? (
          <EmptyStateCompact
            assetKey="unknown"
            assetClassName="size-16"
            rootClassName="border border-subtle px-5 py-10"
            title={t("workspace_analytics.velocity.empty")}
          />
        ) : (
          <BarChart
            className="h-[320px] w-full"
            data={comparisonData}
            bars={[
              {
                key: "story_points",
                label: t("workspace_analytics.velocity.story_points"),
                fill: ROLE_COLORS.story_points,
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

      <AnalyticsSectionWrapper title={t("workspace_analytics.velocity.role_mix")}>
        {isLoading ? (
          <ChartLoader />
        ) : roleData.length === 0 ? (
          <EmptyStateCompact
            assetKey="unknown"
            assetClassName="size-16"
            rootClassName="border border-subtle px-5 py-10"
            title={t("workspace_analytics.velocity.empty")}
          />
        ) : (
          <BarChart
            className="h-[320px] w-full"
            data={roleData}
            bars={roleBars}
            xAxis={{ key: "name", label: t("common.cycle") }}
            yAxis={{ key: roleKeys[0], label: t("workspace_analytics.velocity.story_points") }}
          />
        )}
      </AnalyticsSectionWrapper>

      <AnalyticsSectionWrapper
        title={t("workspace_analytics.velocity.people_table")}
        actions={
          <MemberDropdown
            value={assigneeId}
            onChange={onAssigneeChange}
            multiple={false}
            buttonVariant="border-with-text"
            placeholder={t("workspace_analytics.velocity.select_person")}
          />
        }
      >
        <p className="mb-3 text-12 text-tertiary">{t("workspace_analytics.velocity.leave_hint")}</p>
        <div className="overflow-x-auto rounded-md border border-subtle">
          <table className="w-full text-left text-13">
            <thead className="bg-layer-1 text-tertiary">
              <tr>
                <th className="px-3 py-2 font-medium">{t("common.assignee")}</th>
                {!isClassicFocus && (
                  <>
                    <th className="px-3 py-2 font-medium">{t("workspace_analytics.velocity.design")}</th>
                    <th className="px-3 py-2 font-medium">{t("workspace_analytics.velocity.dev")}</th>
                    <th className="px-3 py-2 font-medium">{t("workspace_analytics.velocity.qa")}</th>
                  </>
                )}
                {isClassicFocus && (
                  <th className="px-3 py-2 font-medium">{t("workspace_analytics.velocity.uncategorized")}</th>
                )}
                <th className="px-3 py-2 font-medium">{t("workspace_analytics.velocity.total")}</th>
                <th className="px-3 py-2 font-medium">{t("workspace_analytics.velocity.avg_per_sprint")}</th>
                <th className="px-3 py-2 font-medium">{t("workspace_analytics.velocity.sprints")}</th>
                <th className="px-3 py-2 font-medium">{t("workspace_analytics.velocity.personal_leave")}</th>
              </tr>
            </thead>
            <tbody>
              {(data?.people ?? []).map((person) => (
                <tr
                  key={person.user_id}
                  className={cn(
                    "cursor-pointer border-t border-subtle hover:bg-layer-1",
                    assigneeId === person.user_id && "bg-layer-1"
                  )}
                  onClick={() => onAssigneeChange(person.user_id)}
                >
                  <td className="px-3 py-2 font-medium text-primary">{person.display_name}</td>
                  {!isClassicFocus && (
                    <>
                      <td className="px-3 py-2">{person.design}</td>
                      <td className="px-3 py-2">{person.dev}</td>
                      <td className="px-3 py-2">{person.qa}</td>
                    </>
                  )}
                  {isClassicFocus && <td className="px-3 py-2">{person.uncategorized}</td>}
                  <td className="px-3 py-2">{person.total}</td>
                  <td className="px-3 py-2">{person.avg_per_sprint}</td>
                  <td className="px-3 py-2">{person.sprint_count}</td>
                  <td className="px-3 py-2">{person.personal_leave_days}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AnalyticsSectionWrapper>

      {assigneeId && (
        <AnalyticsSectionWrapper title={t("workspace_analytics.velocity.work_items")}>
          <VelocityWorkItemsList items={data?.work_items?.items ?? []} />
        </AnalyticsSectionWrapper>
      )}
    </div>
  );
});
