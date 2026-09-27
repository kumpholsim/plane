/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { differenceInCalendarDays, format } from "date-fns";
import type { TManhourReportRow } from "@plane/types";

export const MTEL_BRAND = "Mtel";
export const MTEL_BRAND_COLOR = "#0B3D4A";
export const MTEL_LOGO_PATH = "/mtel-logo.png";

export function mtelLogoSrc(): string {
  if (typeof window === "undefined") return MTEL_LOGO_PATH;
  return `${window.location.origin}${MTEL_LOGO_PATH}`;
}

export function defaultManhourRange(): { from: Date; to: Date } {
  const to = new Date();
  return {
    from: new Date(to.getFullYear(), to.getMonth(), 1),
    to,
  };
}

export function toIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function rowKey(row: Pick<TManhourReportRow, "id" | "source">): string {
  return `${row.source}:${row.id}`;
}

export function formatDurationHms(hours: number): string {
  const totalSeconds = Math.max(0, Math.round((hours || 0) * 3600));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function summarizeVisibleRows(rows: TManhourReportRow[], from: Date, to: Date) {
  const total = rows.reduce((sum, row) => sum + (row.manhour || 0), 0);
  const dayCount = Math.max(1, differenceInCalendarDays(to, from) + 1);
  const average = total / dayCount;
  return {
    total_hours: Math.round(total * 100) / 100,
    average_daily_hours: Math.round(average * 100) / 100,
    total_duration: formatDurationHms(total),
    average_daily_duration: formatDurationHms(average),
    row_count: rows.length,
    day_count: dayCount,
  };
}

export function projectChipLabel(rows: TManhourReportRow[], multipleLabel: string): string | null {
  const names = Array.from(
    new Set(rows.filter((row) => row.source === "issue" && row.project_name).map((row) => row.project_name))
  );
  if (names.length === 0) return null;
  if (names.length === 1) return names[0] ?? null;
  return multipleLabel;
}

export function defaultProjectId(rows: TManhourReportRow[], projectName?: string): string | null {
  const withProject = rows.filter((row) => row.project_id);
  if (withProject.length === 0) return null;
  if (projectName) {
    const matched = withProject.find((row) => row.project_name === projectName);
    if (matched?.project_id) return matched.project_id;
  }
  const ids = Array.from(new Set(withProject.map((row) => row.project_id).filter(Boolean)));
  return ids[0] ?? null;
}

export function formatRowDate(row: TManhourReportRow): string {
  const date = row.date ? new Date(`${row.date}T00:00:00`) : new Date(row.created_at);
  if (Number.isNaN(date.getTime())) return row.date;
  return format(date, "MMM d, yyyy");
}

export function formatRangeSubtitle(from: Date, to: Date): string {
  return `${format(from, "MMM d, yyyy")} – ${format(to, "MMM d, yyyy")}`;
}

export function pdfFileName(displayName: string, from: Date, to: Date): string {
  const slug = (displayName || "member")
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `mtel-manhour-report-${slug || "member"}-${toIsoDate(from)}-${toIsoDate(to)}.pdf`;
}
