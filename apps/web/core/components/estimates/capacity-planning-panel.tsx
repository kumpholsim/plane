/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { CAPACITY_SP_PER_HOLIDAY_DAY, DEFAULT_AVERAGE_VELOCITY } from "@plane/constants";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Input } from "@plane/ui";
import { useProject } from "@/hooks/store/use-project";

type Props = {
  workspaceSlug: string;
  projectId: string;
  canManage: boolean;
};

export const CapacityPlanningPanel = observer(function CapacityPlanningPanel(props: Props) {
  const { workspaceSlug, projectId, canManage } = props;
  const { currentProjectDetails, updateProject } = useProject();
  const [velocity, setVelocity] = useState(String(currentProjectDetails?.average_velocity ?? DEFAULT_AVERAGE_VELOCITY));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setVelocity(String(currentProjectDetails?.average_velocity ?? DEFAULT_AVERAGE_VELOCITY));
  }, [currentProjectDetails?.average_velocity]);

  const handleSave = async () => {
    if (!canManage) return;
    const parsed = Number(velocity);
    if (Number.isNaN(parsed) || parsed < 0) {
      setToast({ type: TOAST_TYPE.ERROR, title: "Error!", message: "Enter a valid default team velocity." });
      return;
    }
    setIsSaving(true);
    try {
      await updateProject(workspaceSlug, projectId, { average_velocity: parsed });
      setToast({ type: TOAST_TYPE.SUCCESS, title: "Success!", message: "Default team velocity updated." });
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: "Error!", message: "Could not update default team velocity." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <h3 className="text-14 font-semibold text-primary">Sprint capacity</h3>
        <p className="mt-1 text-12 text-tertiary">
          Default Team Velocity is the baseline capacity bar for each person (story points of L4 sub-tasks in the
          sprint). Bars turn red when someone exceeds this limit after holiday / leave adjustments. Each public holiday
          or personal leave day reduces max capacity by {CAPACITY_SP_PER_HOLIDAY_DAY} SP (edit these on the cycle
          Capacity panel).
        </p>
      </div>
      <label htmlFor="scrumban-average-velocity" className="flex flex-col gap-1.5">
        <span className="text-13 font-medium text-secondary">Default Team Velocity (SP)</span>
        <Input
          id="scrumban-average-velocity"
          type="number"
          min={0}
          step={0.5}
          value={velocity}
          onChange={(e) => setVelocity(e.target.value)}
          disabled={!canManage || isSaving}
          className="max-w-xs"
        />
      </label>
      {canManage && (
        <Button variant="primary" size="md" onClick={() => void handleSave()} disabled={isSaving}>
          {isSaving ? "Saving…" : "Save"}
        </Button>
      )}
    </div>
  );
});
