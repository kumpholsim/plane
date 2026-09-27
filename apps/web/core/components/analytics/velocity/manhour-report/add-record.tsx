/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/ui";
import { DateDropdown } from "@/components/dropdowns/date";

export type TManhourAddRecordValues = {
  description: string;
  manhour: number;
  entry_date: string;
};

type Props = {
  isSubmitting: boolean;
  onSubmit: (values: TManhourAddRecordValues) => Promise<void>;
};

export const ManhourAddRecordForm = observer(function ManhourAddRecordForm(props: Props) {
  const { isSubmitting, onSubmit } = props;
  const { t } = useTranslation();
  const [description, setDescription] = useState("");
  const [hours, setHours] = useState("1");
  const [entryDate, setEntryDate] = useState<Date | null>(new Date());
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const trimmed = description.trim();
    const manhour = Number(hours);
    if (!trimmed) {
      setError(t("workspace_analytics.velocity.manhour_report.description_required"));
      return;
    }
    if (!entryDate) {
      setError(t("workspace_analytics.velocity.manhour_report.date_required"));
      return;
    }
    if (Number.isNaN(manhour) || manhour < 0) {
      setError(t("workspace_analytics.velocity.manhour_report.hours_required"));
      return;
    }
    setError(null);
    const year = entryDate.getFullYear();
    const month = String(entryDate.getMonth() + 1).padStart(2, "0");
    const day = String(entryDate.getDate()).padStart(2, "0");
    await onSubmit({
      description: trimmed,
      manhour,
      entry_date: `${year}-${month}-${day}`,
    });
    setDescription("");
    setHours("1");
    setEntryDate(new Date());
  };

  return (
    <div className="rounded-lg border border-subtle bg-layer-1 p-4">
      <div className="mb-3 text-13 font-medium text-primary">
        {t("workspace_analytics.velocity.manhour_report.add_record")}
      </div>
      <p className="mb-3 text-12 text-tertiary">{t("workspace_analytics.velocity.manhour_report.add_record_hint")}</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={t("workspace_analytics.velocity.manhour_report.description")}
        />
        <Input
          type="number"
          min={0}
          step="0.25"
          value={hours}
          onChange={(event) => setHours(event.target.value)}
          placeholder={t("workspace_analytics.velocity.manhour_report.hours")}
        />
        <DateDropdown
          value={entryDate}
          onChange={setEntryDate}
          buttonVariant="border-with-text"
          placeholder={t("workspace_analytics.velocity.manhour_report.date")}
        />
      </div>
      {error && <p className="mt-2 text-12 text-danger-primary">{error}</p>}
      <div className="mt-3">
        <Button variant="secondary" size="sm" onClick={handleSubmit} loading={isSubmitting} disabled={isSubmitting}>
          {t("workspace_analytics.velocity.manhour_report.save")}
        </Button>
      </div>
    </div>
  );
});
