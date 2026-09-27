/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react";
import { pdf } from "@react-pdf/renderer";
import { Download } from "lucide-react";
import useSWR from "swr";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { TManhourReportRow } from "@plane/types";
import { EModalPosition, EModalWidth, ModalCore } from "@plane/ui";
import { DateRangeDropdown } from "@/components/dropdowns/date-range";
import { AnalyticsService } from "@/services/analytics.service";
import { ManhourAddRecordForm } from "./add-record";
import { ManhourReportDocument } from "./document";
import {
  defaultManhourRange,
  defaultProjectId,
  pdfFileName,
  projectChipLabel,
  rowKey,
  summarizeVisibleRows,
  toIsoDate,
} from "./helpers";
import { ManhourReportPreview } from "./preview";

const analyticsService = new AnalyticsService();

type Props = {
  isOpen: boolean;
  onClose: () => void;
  workspaceSlug: string;
  assigneeId: string;
};

function initiateDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

export const ManhourReportModal = observer(function ManhourReportModal(props: Props) {
  const { isOpen, onClose, workspaceSlug, assigneeId } = props;
  const { t } = useTranslation();
  const [range, setRange] = useState(defaultManhourRange);
  const [excludedKeys, setExcludedKeys] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [memberNameDraft, setMemberNameDraft] = useState<string | null>(null);
  const [projectNameDraft, setProjectNameDraft] = useState<string | null>(null);
  const [remarks, setRemarks] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    setRange(defaultManhourRange());
    setExcludedKeys(new Set());
    setMemberNameDraft(null);
    setProjectNameDraft(null);
    setRemarks({});
  }, [isOpen, assigneeId]);

  const startDate = toIsoDate(range.from);
  const endDate = toIsoDate(range.to);

  const { data, isLoading, mutate } = useSWR(
    isOpen && workspaceSlug && assigneeId ? ["manhour-report", workspaceSlug, assigneeId, startDate, endDate] : null,
    () =>
      analyticsService.getManhourReport(workspaceSlug, {
        assignee_id: assigneeId,
        start_date: startDate,
        end_date: endDate,
      })
  );

  const visibleRows = useMemo(
    () => (data?.rows ?? []).filter((row) => !excludedKeys.has(rowKey(row))),
    [data?.rows, excludedKeys]
  );
  const summary = useMemo(() => summarizeVisibleRows(visibleRows, range.from, range.to), [visibleRows, range]);
  const defaultMemberName = data?.member.display_name || "";
  const defaultProjectName =
    projectChipLabel(visibleRows, t("workspace_analytics.velocity.manhour_report.multiple_projects")) ?? "";
  const memberName = memberNameDraft ?? defaultMemberName;
  const projectName = projectNameDraft ?? defaultProjectName;
  const previewRows = useMemo(
    () =>
      visibleRows.map((row) => ({
        ...row,
        member: memberName,
        project_name: projectName,
        remark: remarks[rowKey(row)] ?? row.remark ?? "-",
      })),
    [visibleRows, memberName, projectName, remarks]
  );

  const handleRemarkChange = (row: TManhourReportRow, value: string) => {
    setRemarks((current) => ({ ...current, [rowKey(row)]: value }));
  };

  const handleExclude = (row: TManhourReportRow) => {
    setExcludedKeys((current) => new Set(current).add(rowKey(row)));
  };

  const handleAddRecord = async (values: { description: string; manhour: number; entry_date: string }) => {
    setIsSubmitting(true);
    try {
      await analyticsService.createManhourEntry(workspaceSlug, {
        user_id: assigneeId,
        description: values.description,
        manhour: values.manhour,
        entry_date: values.entry_date,
        project_id: defaultProjectId(visibleRows, projectName),
      });
      await mutate();
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("workspace_analytics.velocity.manhour_report.create_failed"),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = async () => {
    setIsExporting(true);
    try {
      const blob = await pdf(
        <ManhourReportDocument
          title={t("workspace_analytics.velocity.manhour_report.detailed_title")}
          memberLabel={t("workspace_analytics.velocity.manhour_report.member")}
          memberName={memberName}
          projectLabel={t("workspace_analytics.velocity.manhour_report.project")}
          projectName={projectName || null}
          from={range.from}
          to={range.to}
          averageLabel={t("workspace_analytics.velocity.manhour_report.average_daily")}
          averageValue={summary.average_daily_duration}
          totalLabel={t("workspace_analytics.velocity.manhour_report.total_hours")}
          totalValue={summary.total_duration}
          columns={{
            description: t("workspace_analytics.velocity.manhour_report.description"),
            duration: t("workspace_analytics.velocity.manhour_report.duration"),
            member: t("workspace_analytics.velocity.manhour_report.member"),
            project: t("workspace_analytics.velocity.manhour_report.project"),
            date: t("workspace_analytics.velocity.manhour_report.date"),
            remark: t("workspace_analytics.velocity.manhour_report.remark"),
          }}
          rows={previewRows}
        />
      ).toBlob();
      initiateDownload(blob, pdfFileName(memberName, range.from, range.to));
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: t("workspace_analytics.velocity.manhour_report.download_success"),
      });
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("workspace_analytics.velocity.manhour_report.download_failed"),
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <ModalCore isOpen={isOpen} handleClose={onClose} position={EModalPosition.TOP} width={EModalWidth.VIIXL}>
      <div className="flex max-h-[90vh] flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-subtle px-5 py-4">
          <h3 className="text-18 font-medium text-secondary">
            {t("workspace_analytics.velocity.manhour_report.title")}
          </h3>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-13 font-medium text-secondary">
              {t("workspace_analytics.velocity.manhour_report.date")}
            </span>
            <div className="h-8">
              <DateRangeDropdown
                value={range}
                onSelect={(next) => {
                  if (next?.from && next?.to) setRange({ from: next.from, to: next.to });
                }}
                buttonVariant="border-with-text"
                buttonContainerClassName="h-8"
                buttonClassName="h-8 min-w-[11.5rem] px-3 text-13 [&_span]:text-13"
                hideIcon={{ from: false, to: true }}
                bothRequired
                mergeDates
                renderInPortal
              />
            </div>
            <Button
              variant="primary"
              size="lg"
              prependIcon={<Download className="h-3.5 w-3.5" />}
              onClick={handleDownload}
              loading={isExporting}
              disabled={isExporting}
            >
              {t("workspace_analytics.velocity.manhour_report.download_pdf")}
            </Button>
          </div>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {isLoading && !data ? (
            <div className="rounded-lg border border-subtle px-5 py-10 text-center text-13 text-tertiary">
              {t("common.loading")}
            </div>
          ) : (
            <ManhourReportPreview
              memberName={memberName}
              projectName={projectName}
              from={range.from}
              to={range.to}
              rows={previewRows}
              averageDuration={summary.average_daily_duration}
              totalDuration={summary.total_duration}
              onExclude={handleExclude}
              onMemberNameChange={setMemberNameDraft}
              onProjectNameChange={setProjectNameDraft}
              onRemarkChange={handleRemarkChange}
            />
          )}
          <ManhourAddRecordForm isSubmitting={isSubmitting} onSubmit={handleAddRecord} />
        </div>
      </div>
    </ModalCore>
  );
});
