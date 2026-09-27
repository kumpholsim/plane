/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { X } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import { Input } from "@plane/ui";
import type { TManhourReportRow } from "@plane/types";
import { formatRangeSubtitle, formatRowDate, MTEL_BRAND, MTEL_BRAND_COLOR, MTEL_LOGO_PATH } from "./helpers";

type Props = {
  memberName: string;
  projectName: string;
  from: Date;
  to: Date;
  rows: TManhourReportRow[];
  averageDuration: string;
  totalDuration: string;
  onExclude: (row: TManhourReportRow) => void;
  onMemberNameChange: (value: string) => void;
  onProjectNameChange: (value: string) => void;
  onRemarkChange: (row: TManhourReportRow, value: string) => void;
};

export function ManhourReportPreview(props: Props) {
  const {
    memberName,
    projectName,
    from,
    to,
    rows,
    averageDuration,
    totalDuration,
    onExclude,
    onMemberNameChange,
    onProjectNameChange,
    onRemarkChange,
  } = props;
  const { t } = useTranslation();

  return (
    <div className="shadow-sm overflow-hidden rounded-lg border border-subtle bg-white text-left text-[#1F2937]">
      <div className="h-1.5" style={{ backgroundColor: MTEL_BRAND_COLOR }} />
      <div className="space-y-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-22 font-semibold" style={{ color: MTEL_BRAND_COLOR }}>
              {t("workspace_analytics.velocity.manhour_report.detailed_title")}
            </div>
            <div className="mt-1 text-13 text-[#6B7280]">{formatRangeSubtitle(from, to)}</div>
            <div className="mt-4 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-12 text-[#6B7280]">
                <span className="mb-1 block font-medium">
                  {t("workspace_analytics.velocity.manhour_report.member")}
                </span>
                <input
                  type="text"
                  value={memberName}
                  onChange={(event) => onMemberNameChange(event.target.value)}
                  placeholder={t("workspace_analytics.velocity.manhour_report.member")}
                  className="h-9 w-full rounded-md border border-[#D1D5DB] bg-white px-3 text-13 font-semibold text-[#111827] outline-none focus:border-[#0B3D4A]"
                />
              </label>
              <label className="block text-12 text-[#6B7280]">
                <span className="mb-1 block font-medium">
                  {t("workspace_analytics.velocity.manhour_report.project")}
                </span>
                <input
                  type="text"
                  value={projectName}
                  onChange={(event) => onProjectNameChange(event.target.value)}
                  placeholder={t("workspace_analytics.velocity.manhour_report.project")}
                  className="h-9 w-full rounded-md border border-[#D1D5DB] bg-white px-3 text-13 font-semibold text-[#111827] outline-none focus:border-[#0B3D4A]"
                />
              </label>
            </div>
          </div>
          <img src={MTEL_LOGO_PATH} alt={MTEL_BRAND} className="h-10 w-auto shrink-0 object-contain" />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div
            className="border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3"
            style={{ borderLeft: `4px solid ${MTEL_BRAND_COLOR}` }}
          >
            <div className="text-11 font-medium tracking-wide text-[#6B7280] uppercase">
              {t("workspace_analytics.velocity.manhour_report.average_daily")}
            </div>
            <div className="mt-1 text-24 font-semibold tabular-nums" style={{ color: MTEL_BRAND_COLOR }}>
              {averageDuration}
            </div>
          </div>
          <div
            className="border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3"
            style={{ borderLeft: `4px solid ${MTEL_BRAND_COLOR}` }}
          >
            <div className="text-11 font-medium tracking-wide text-[#6B7280] uppercase">
              {t("workspace_analytics.velocity.manhour_report.total_hours")}
            </div>
            <div className="mt-1 text-24 font-semibold tabular-nums" style={{ color: MTEL_BRAND_COLOR }}>
              {totalDuration}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse border-spacing-0 text-13">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#F3F4F6] text-left text-12 text-[#4B5563]">
                <th className="w-[28%] max-w-[240px] px-2 py-2 font-medium">
                  {t("workspace_analytics.velocity.manhour_report.description")}
                </th>
                <th className="px-2 py-2 font-medium">{t("workspace_analytics.velocity.manhour_report.duration")}</th>
                <th className="px-2 py-2 font-medium">{t("workspace_analytics.velocity.manhour_report.member")}</th>
                <th className="px-2 py-2 font-medium">{t("workspace_analytics.velocity.manhour_report.project")}</th>
                <th className="px-2 py-2 font-medium">{t("workspace_analytics.velocity.manhour_report.date")}</th>
                <th className="min-w-[10rem] px-2 py-2 font-medium">
                  {t("workspace_analytics.velocity.manhour_report.remark")}
                </th>
                <th className="w-10 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-2 py-8 text-center text-12 text-[#6B7280]">
                    {t("workspace_analytics.velocity.manhour_report.empty")}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={`${row.source}:${row.id}`} className="border-b border-[#F3F4F6]">
                    <td className="w-[28%] max-w-[240px] px-2 py-2 break-words whitespace-normal">{row.description}</td>
                    <td className="px-2 py-2 font-medium">{row.duration}</td>
                    <td className="px-2 py-2 font-semibold">{memberName}</td>
                    <td className="px-2 py-2 font-semibold">{projectName}</td>
                    <td className="px-2 py-2 text-[#4B5563]">{formatRowDate(row)}</td>
                    <td className="min-w-[10rem] px-2 py-2">
                      <Input
                        mode="true-transparent"
                        inputSize="xs"
                        value={row.remark ?? "-"}
                        onChange={(event) => onRemarkChange(row, event.target.value)}
                        placeholder="-"
                        className="w-full border-b border-[#D1D5DB] px-0 py-0.5 text-13 text-[#111827]"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        className="rounded p-1 text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#111827]"
                        onClick={() => onExclude(row)}
                        aria-label={t("workspace_analytics.velocity.manhour_report.remove_row")}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
