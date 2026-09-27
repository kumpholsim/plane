/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { TManhourReportRow } from "@plane/types";
import { formatRangeSubtitle, formatRowDate, MTEL_BRAND_COLOR, mtelLogoSrc } from "./helpers";

type Props = {
  title: string;
  memberLabel: string;
  memberName: string;
  projectLabel: string;
  projectName: string | null;
  from: Date;
  to: Date;
  averageLabel: string;
  averageValue: string;
  totalLabel: string;
  totalValue: string;
  columns: {
    description: string;
    duration: string;
    member: string;
    project: string;
    date: string;
    remark: string;
  };
  rows: TManhourReportRow[];
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 236,
    paddingBottom: 48,
    paddingHorizontal: 32,
    fontSize: 9,
    color: "#1F2937",
    fontFamily: "Helvetica",
  },
  header: {
    position: "absolute",
    top: 20,
    left: 32,
    right: 32,
  },
  brandBar: {
    height: 6,
    backgroundColor: MTEL_BRAND_COLOR,
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  titleBlock: {
    flexGrow: 1,
    paddingRight: 12,
  },
  title: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: MTEL_BRAND_COLOR,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 10,
    color: "#6B7280",
  },
  logo: {
    width: 72,
    height: 40,
    objectFit: "contain",
  },
  fieldRow: {
    flexDirection: "row",
    marginTop: 14,
    gap: 10,
  },
  field: {
    flexGrow: 1,
    flexBasis: 0,
  },
  fieldLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#6B7280",
    marginBottom: 4,
  },
  fieldBox: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF",
    paddingVertical: 6,
    paddingHorizontal: 8,
    minHeight: 22,
  },
  fieldValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
  },
  summary: {
    flexDirection: "row",
    marginTop: 12,
    gap: 10,
  },
  summaryCard: {
    flexGrow: 1,
    flexBasis: 0,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderLeftWidth: 4,
    borderLeftColor: MTEL_BRAND_COLOR,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  summaryLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: MTEL_BRAND_COLOR,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingVertical: 7,
    paddingHorizontal: 4,
    marginTop: 14,
  },
  tableHeaderText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#4B5563",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    paddingVertical: 7,
    paddingHorizontal: 4,
  },
  colDescription: { width: "26%", paddingRight: 6 },
  colDuration: { width: "10%", paddingRight: 4 },
  colMember: { width: "14%", paddingRight: 4 },
  colProject: { width: "16%", paddingRight: 4 },
  colDate: { width: "12%", paddingRight: 4 },
  colRemark: { width: "22%" },
  cellText: { fontSize: 9, color: "#1F2937" },
  cellDuration: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#1F2937" },
  cellName: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#1F2937" },
  cellDate: { fontSize: 9, color: "#4B5563" },
  footer: {
    position: "absolute",
    bottom: 18,
    left: 32,
    right: 32,
    flexDirection: "row",
    justifyContent: "flex-end",
    color: "#6B7280",
    fontSize: 8,
  },
});

export function ManhourReportDocument(props: Props) {
  const {
    title,
    memberLabel,
    memberName,
    projectLabel,
    projectName,
    from,
    to,
    averageLabel,
    averageValue,
    totalLabel,
    totalValue,
    columns,
    rows,
  } = props;

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header} fixed>
          <View style={styles.brandBar} />
          <View style={styles.titleRow}>
            <View style={styles.titleBlock}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{formatRangeSubtitle(from, to)}</Text>
            </View>
            <Image src={mtelLogoSrc()} style={styles.logo} />
          </View>
          <View style={styles.fieldRow}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{memberLabel}</Text>
              <View style={styles.fieldBox}>
                <Text style={styles.fieldValue}>{memberName}</Text>
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{projectLabel}</Text>
              <View style={styles.fieldBox}>
                <Text style={styles.fieldValue}>{projectName || ""}</Text>
              </View>
            </View>
          </View>
          <View style={styles.summary}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{averageLabel}</Text>
              <Text style={styles.summaryValue}>{averageValue}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{totalLabel}</Text>
              <Text style={styles.summaryValue}>{totalValue}</Text>
            </View>
          </View>
          <View style={styles.tableHeader}>
            <View style={styles.colDescription}>
              <Text style={styles.tableHeaderText}>{columns.description}</Text>
            </View>
            <View style={styles.colDuration}>
              <Text style={styles.tableHeaderText}>{columns.duration}</Text>
            </View>
            <View style={styles.colMember}>
              <Text style={styles.tableHeaderText}>{columns.member}</Text>
            </View>
            <View style={styles.colProject}>
              <Text style={styles.tableHeaderText}>{columns.project}</Text>
            </View>
            <View style={styles.colDate}>
              <Text style={styles.tableHeaderText}>{columns.date}</Text>
            </View>
            <View style={styles.colRemark}>
              <Text style={styles.tableHeaderText}>{columns.remark}</Text>
            </View>
          </View>
        </View>

        {rows.map((row) => (
          <View key={`${row.source}:${row.id}`} style={styles.tableRow} wrap={false}>
            <View style={styles.colDescription}>
              <Text style={styles.cellText} wrap>
                {row.description}
              </Text>
            </View>
            <View style={styles.colDuration}>
              <Text style={styles.cellDuration}>{row.duration}</Text>
            </View>
            <View style={styles.colMember}>
              <Text style={styles.cellName}>{row.member}</Text>
            </View>
            <View style={styles.colProject}>
              <Text style={styles.cellName}>{row.project_name}</Text>
            </View>
            <View style={styles.colDate}>
              <Text style={styles.cellDate}>{formatRowDate(row)}</Text>
            </View>
            <View style={styles.colRemark}>
              <Text style={styles.cellText} wrap>
                {row.remark?.trim() || "-"}
              </Text>
            </View>
          </View>
        ))}

        <View style={styles.footer} fixed>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
