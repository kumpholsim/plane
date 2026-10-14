/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { Calendar } from "@plane/propel/calendar";
import { CloseIcon } from "@plane/propel/icons";
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
import type { TWorkspacePublicHoliday } from "@plane/types";
import { EModalPosition, EModalWidth, ModalCore } from "@plane/ui";
import { cn } from "@plane/utils";
import { useUserPermissions } from "@/hooks/store/user";
import { AnalyticsService } from "@/services/analytics.service";
import { parseHolidayDate, PublicHolidayChip, toHolidayDate } from "./chip";

const analyticsService = new AnalyticsService();

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const errorMessage = (error: unknown, fallback: string) =>
  typeof error === "object" && error && "error" in error ? String((error as { error: string }).error) : fallback;

export const WorkspacePublicHolidaysModal = observer(function WorkspacePublicHolidaysModal(props: Props) {
  const { isOpen, onClose } = props;
  const { workspaceSlug } = useParams();
  const { allowPermissions } = useUserPermissions();
  const canEdit = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE);
  const [holidays, setHolidays] = useState<TWorkspacePublicHoliday[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadHolidays = useCallback(async () => {
    if (!workspaceSlug) return;
    try {
      setHolidays(await analyticsService.getPublicHolidays(workspaceSlug.toString()));
    } catch (error) {
      setToast({ type: TOAST_TYPE.ERROR, title: "Error", message: errorMessage(error, "Could not load holidays.") });
    }
  }, [workspaceSlug]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    void loadHolidays().finally(() => setLoading(false));
  }, [isOpen, loadHolidays]);

  const runChange = async (change: (slug: string) => Promise<unknown>, fallback: string) => {
    if (!workspaceSlug) return;
    setSaving(true);
    try {
      await change(workspaceSlug.toString());
    } catch (error) {
      setToast({ type: TOAST_TYPE.ERROR, title: "Error", message: errorMessage(error, fallback) });
    } finally {
      await loadHolidays();
      setSaving(false);
    }
  };

  const handleRename = (holiday: TWorkspacePublicHoliday, name: string) =>
    runChange((slug) => analyticsService.updatePublicHoliday(slug, holiday.id, { name }), "Could not rename holiday.");

  const handleRemove = (holiday: TWorkspacePublicHoliday) =>
    runChange((slug) => analyticsService.deletePublicHoliday(slug, holiday.id), "Could not remove holiday.");

  const handleSelect = (dates: Date[] | undefined) => {
    const picked = new Set((dates ?? []).map(toHolidayDate));
    const existing = new Set(holidays.map((holiday) => holiday.date));
    const added = [...picked].filter((date) => !existing.has(date));
    const removed = holidays.filter((holiday) => !picked.has(holiday.date));
    if (added.length === 0 && removed.length === 0) return;
    void runChange(
      (slug) =>
        Promise.all([
          ...added.map((date) => analyticsService.createPublicHoliday(slug, { date })),
          ...removed.map((holiday) => analyticsService.deletePublicHoliday(slug, holiday.id)),
        ]),
      "Could not update holidays."
    );
  };

  return (
    <ModalCore isOpen={isOpen} handleClose={onClose} position={EModalPosition.TOP} width={EModalWidth.XXXL}>
      <div className="flex max-h-[85vh] flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-subtle px-5 py-4">
          <div className="min-w-0">
            <h3 className="text-16 font-medium text-primary">Public holidays</h3>
            <p className="text-12 text-tertiary">
              Shared by every project in this workspace. Each holiday inside a sprint takes 1.5 SP off every
              member&apos;s capacity and is left out of the manhour report&apos;s daily average.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-7 shrink-0 items-center justify-center rounded text-placeholder hover:bg-layer-1 hover:text-secondary"
            aria-label="Close"
          >
            <CloseIcon className="size-3.5" />
          </button>
        </div>
        <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto p-5 md:grid-cols-[auto_1fr]">
          {canEdit && (
            <div className="space-y-2">
              <Calendar
                mode="multiple"
                className={cn("rounded-md border border-subtle p-3", saving && "pointer-events-none opacity-60")}
                captionLayout="dropdown"
                selected={holidays.map((holiday) => parseHolidayDate(holiday.date))}
                onSelect={handleSelect}
              />
              <p className="text-11 text-tertiary">Click a day to add or remove it.</p>
            </div>
          )}
          <div className="min-w-0 space-y-1.5">
            <p className="text-12 font-medium text-secondary">
              {holidays.length} {holidays.length === 1 ? "holiday" : "holidays"}
            </p>
            {loading && holidays.length === 0 ? (
              <p className="text-12 text-tertiary">Loading holidays…</p>
            ) : holidays.length === 0 ? (
              <p className="text-12 text-tertiary">
                {canEdit ? "No holidays yet. Pick dates on the calendar." : "No holidays have been set."}
              </p>
            ) : (
              holidays.map((holiday) => (
                <PublicHolidayChip
                  key={holiday.id}
                  holiday={holiday}
                  disabled={saving}
                  onRename={canEdit ? handleRename : undefined}
                  onRemove={canEdit ? handleRemove : undefined}
                />
              ))
            )}
            {!canEdit && <p className="pt-1 text-11 text-tertiary">Only workspace admins can change holidays.</p>}
          </div>
        </div>
      </div>
    </ModalCore>
  );
});
