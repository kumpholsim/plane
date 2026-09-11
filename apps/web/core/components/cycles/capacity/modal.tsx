/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { CAPACITY_SP_PER_HOLIDAY_DAY, DEFAULT_AVERAGE_VELOCITY } from "@plane/constants";
import { Avatar } from "@plane/propel/avatar";
import { CloseIcon } from "@plane/propel/icons";
import { ModalPortal, EPortalWidth, EPortalPosition } from "@plane/propel/portal";
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
import type { ICycle, IProject, TCycleCapacityMember, TCycleCapacityResponse } from "@plane/types";
import { getFileURL } from "@plane/utils";
import { CycleService } from "@/services/cycle.service";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  projectDetails?: IProject | undefined;
  cycleDetails?: ICycle | undefined;
};

const cycleService = new CycleService();

function CapacityBarRow(props: {
  member: TCycleCapacityMember;
  onPersonalLeaveChange: (assigneeId: string, days: number) => Promise<void>;
}) {
  const { member, onPersonalLeaveChange } = props;
  const [personalLeaveDraft, setPersonalLeaveDraft] = useState(String(member.personal_holiday_days));
  const [savingLeave, setSavingLeave] = useState(false);

  // Full track = capacity max + 30% headroom, so the max marker is never at the far right.
  const capacityMax = Math.max(member.capacity_max, 0);
  const trackMax = Math.max(capacityMax * 1.3, 0.1);
  const fillPct = Math.min(100, Math.max(0, (member.estimate_points / trackMax) * 100));
  const maxMarkerPct = Math.min(100, Math.max(0, (capacityMax / trackMax) * 100));
  const barColor = member.is_over_capacity ? "bg-danger-primary" : "bg-accent-primary";

  useEffect(() => {
    setPersonalLeaveDraft(String(member.personal_holiday_days));
  }, [member.personal_holiday_days]);

  const commitPersonalLeave = async () => {
    const parsed = Math.max(0, Number(personalLeaveDraft));
    const normalized = Number.isFinite(parsed) ? parsed : 0;
    setPersonalLeaveDraft(String(normalized));
    if (normalized === member.personal_holiday_days) return;
    setSavingLeave(true);
    try {
      await onPersonalLeaveChange(member.assignee_id, normalized);
    } finally {
      setSavingLeave(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 border-b border-subtle py-3 last:border-b-0">
      <div className="flex items-center gap-2">
        <Avatar
          size="sm"
          name={member.display_name ?? undefined}
          src={getFileURL(member.avatar_url ?? "")}
          className="shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-13 font-medium text-primary">{member.display_name}</p>
          <p className="text-11 text-tertiary">
            {member.estimate_points.toFixed(1)} SP · max {capacityMax.toFixed(1)}
          </p>
        </div>
        <label
          htmlFor={`capacity-personal-leave-${member.assignee_id}`}
          className="relative z-10 flex shrink-0 items-center gap-1.5 text-11 text-tertiary"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          Personal leave
          <input
            id={`capacity-personal-leave-${member.assignee_id}`}
            type="number"
            min={0}
            step={0.5}
            disabled={savingLeave}
            value={personalLeaveDraft}
            onChange={(e) => setPersonalLeaveDraft(e.target.value)}
            onBlur={() => void commitPersonalLeave()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
            }}
            className="focus:border-accent-primary pointer-events-auto w-14 rounded border border-subtle bg-surface-1 px-1.5 py-0.5 text-13 text-primary outline-none"
          />
        </label>
      </div>
      <div className="relative w-full">
        <div className="relative h-3 w-full overflow-hidden rounded-full bg-layer-1">
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-all ${barColor}`}
            style={{ width: `${fillPct}%` }}
          />
          {/* Max capacity marker — sits at ~76.9% so 30% of the track remains beyond it */}
          <div
            className="bg-primary pointer-events-none absolute top-1/2 z-[1] h-5 w-0.5 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${maxMarkerPct}%` }}
            title={`Max capacity ${capacityMax.toFixed(1)} SP`}
          />
        </div>
        <div className="relative mt-1 h-3 w-full">
          <span
            className="absolute -translate-x-1/2 text-[10px] leading-none text-tertiary"
            style={{ left: `${maxMarkerPct}%` }}
          >
            {capacityMax.toFixed(1)}
          </span>
        </div>
      </div>
    </div>
  );
}

export const CycleCapacityModal = observer(function CycleCapacityModal(props: Props) {
  const { isOpen, onClose, projectDetails, cycleDetails } = props;
  const { workspaceSlug, projectId, cycleId } = useParams();
  const [data, setData] = useState<TCycleCapacityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [publicHolidayDraft, setPublicHolidayDraft] = useState("0");
  const [savingPublic, setSavingPublic] = useState(false);

  const loadCapacity = useCallback(async () => {
    if (!workspaceSlug || !projectId || !cycleId) return;
    setLoading(true);
    try {
      const response = await cycleService.getCycleCapacity(
        workspaceSlug.toString(),
        projectId.toString(),
        cycleId.toString()
      );
      setData(response);
      setPublicHolidayDraft(String(response.public_holiday_days));
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error",
        message: "Could not load capacity.",
      });
    } finally {
      setLoading(false);
    }
  }, [workspaceSlug, projectId, cycleId]);

  useEffect(() => {
    if (isOpen) void loadCapacity();
  }, [isOpen, loadCapacity]);

  const persist = async (payload: {
    public_holiday_days?: number;
    personal_holiday_days?: Record<string, number>;
  }): Promise<TCycleCapacityResponse | null> => {
    if (!workspaceSlug || !projectId || !cycleId) return null;
    try {
      // Prefer dedicated capacity endpoint; fall back to cycle PATCH if needed.
      try {
        const response = await cycleService.updateCycleCapacity(
          workspaceSlug.toString(),
          projectId.toString(),
          cycleId.toString(),
          payload
        );
        setData(response);
        setPublicHolidayDraft(String(response.public_holiday_days));
        return response;
      } catch (capacityError: unknown) {
        await cycleService.patchCycle(workspaceSlug.toString(), projectId.toString(), cycleId.toString(), payload);
        const response = await cycleService.getCycleCapacity(
          workspaceSlug.toString(),
          projectId.toString(),
          cycleId.toString()
        );
        setData(response);
        setPublicHolidayDraft(String(response.public_holiday_days));
        if (capacityError) {
          // Fallback succeeded — ignore original capacity endpoint failure.
        }
        return response;
      }
    } catch (error: unknown) {
      const message =
        typeof error === "object" && error && "error" in error
          ? String((error as { error: string }).error)
          : typeof error === "string"
            ? error
            : "Could not update capacity settings.";
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error",
        message,
      });
      return null;
    }
  };

  const commitPublicHolidays = async () => {
    const parsed = Math.max(0, Number(publicHolidayDraft));
    const normalized = Number.isFinite(parsed) ? parsed : 0;
    setPublicHolidayDraft(String(normalized));
    if (data && normalized === data.public_holiday_days) return;
    setSavingPublic(true);
    try {
      await persist({ public_holiday_days: normalized });
    } finally {
      setSavingPublic(false);
    }
  };

  const handlePersonalLeaveChange = async (assigneeId: string, days: number) => {
    await persist({ personal_holiday_days: { [assigneeId]: days } });
  };

  const velocity = data?.average_velocity ?? projectDetails?.average_velocity ?? DEFAULT_AVERAGE_VELOCITY;

  return (
    <ModalPortal isOpen={isOpen} onClose={onClose} width={EPortalWidth.HALF} position={EPortalPosition.RIGHT}>
      <div className="flex h-full flex-col overflow-hidden border-l border-subtle bg-surface-1 text-left">
        <div className="flex items-center justify-between border-b border-subtle px-5 py-3">
          <div className="min-w-0">
            <p className="text-13 font-medium text-primary">Capacity</p>
            <p className="truncate text-11 text-tertiary">
              {cycleDetails?.name ?? "Sprint"} · {projectDetails?.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded text-placeholder hover:bg-layer-1 hover:text-secondary"
            aria-label="Close"
          >
            <CloseIcon className="size-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="relative z-10 mb-4 space-y-3 rounded-lg border border-subtle bg-layer-1 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-13">
              <span className="text-secondary">Team average velocity</span>
              <span className="font-medium text-primary">{Number(velocity).toFixed(1)} SP</span>
            </div>
            <p className="text-11 text-tertiary">
              Open L4 sub-task story points only (Done / cancelled cards are excluded). Each public holiday or personal
              leave day reduces max capacity by {CAPACITY_SP_PER_HOLIDAY_DAY} SP. The vertical line marks max capacity;
              the track always includes 30% headroom past that line.
            </p>
            <label
              className="flex items-center justify-between gap-2 text-13"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <span className="text-secondary">Team public holidays</span>
              <input
                type="number"
                min={0}
                step={0.5}
                disabled={savingPublic || loading}
                value={publicHolidayDraft}
                onChange={(e) => setPublicHolidayDraft(e.target.value)}
                onBlur={() => void commitPublicHolidays()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className="focus:border-accent-primary pointer-events-auto w-16 rounded border border-subtle bg-surface-1 px-1.5 py-0.5 text-13 text-primary outline-none"
              />
            </label>
          </div>

          {loading && !data ? (
            <p className="text-13 text-tertiary">Loading capacity…</p>
          ) : !data?.members.length ? (
            <p className="text-13 text-tertiary">No open sub-task estimates assigned in this sprint yet.</p>
          ) : (
            <div>
              {data.members.map((member) => (
                <CapacityBarRow
                  key={member.assignee_id}
                  member={member}
                  onPersonalLeaveChange={handlePersonalLeaveChange}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </ModalPortal>
  );
});
