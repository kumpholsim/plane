/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  EUserPermissions,
  EUserPermissionsLevel,
  HIERARCHY_BOARD_STATE_PREFIX,
  L3_PROGRESS_PHASE_FALLBACK_COLORS,
  L3_PROGRESS_STATUS_OPTIONS,
  L4_BOARD_STATE_OPTIONS,
  CAPACITY_SP_PER_HOLIDAY_DAY,
  DEFAULT_AVERAGE_VELOCITY,
} from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { TrashIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { IProjectHierarchyType } from "@plane/types";
import { HIERARCHY_LEVEL_LABELS } from "@plane/types";
import { Input, ToggleSwitch } from "@plane/ui";
import { NotAuthorizedView } from "@/components/auth-screens/not-authorized-view";
import { PageHead } from "@/components/core/page-title";
import { SettingsContentWrapper } from "@/components/settings/content-wrapper";
import { useProject } from "@/hooks/store/use-project";
import { useProjectHierarchyType } from "@/hooks/store/use-project-hierarchy-type";
import { useProjectState } from "@/hooks/store/use-project-state";
import { useUserPermissions } from "@/hooks/store/user";
import { HierarchyProjectSettingsHeader } from "./header";

const LEVELS = [1, 2, 3, 4] as const;

const LEVEL_DESCRIPTIONS: Record<(typeof LEVELS)[number], string> = {
  1: "Top-level planning items. Create Epics under a Milestone.",
  2: "Large bodies of work. Create Stories, Bugs, and Tasks under an Epic.",
  3: "Delivery work items. Create Sub-tasks under these.",
  4: "Leaf work items (e.g. Design, Dev, QA). Cannot have children.",
};

type THierarchySettingsTab = "types" | "subtasks-status" | "capacity";

function HierarchyLevelPanel(props: {
  level: (typeof LEVELS)[number];
  workspaceSlug: string;
  projectId: string;
  canManage: boolean;
}) {
  const { level, workspaceSlug, projectId, canManage } = props;
  const { getProjectTypes, createType, updateType, deleteType } = useProjectHierarchyType();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3B82F6");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  const types = getProjectTypes(projectId, level) ?? [];

  const handleCreate = async () => {
    if (!name.trim() || !canManage) return;
    setIsSubmitting(true);
    try {
      await createType(workspaceSlug, projectId, { name: name.trim(), color, level });
      setName("");
      setColor("#3B82F6");
      setToast({ type: TOAST_TYPE.SUCCESS, title: "Success!", message: "Type created." });
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: "Error!", message: "Could not create type." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (typeId: string, isActive: boolean) => {
    if (!canManage) return;
    try {
      await updateType(workspaceSlug, projectId, typeId, { is_active: isActive });
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: "Error!", message: "Could not update type." });
    }
  };

  const handleDelete = async (item: IProjectHierarchyType) => {
    if (!canManage) return;
    const confirmed = window.confirm(`Delete "${item.name}"? Work items using it will become untyped at this level.`);
    if (!confirmed) return;
    setDeletingId(item.id);
    try {
      await deleteType(workspaceSlug, projectId, item.id);
      setToast({ type: TOAST_TYPE.SUCCESS, title: "Success!", message: "Type deleted." });
    } catch (error: unknown) {
      const message =
        typeof error === "object" && error && "error" in error
          ? String((error as { error: string }).error)
          : "Could not delete type.";
      setToast({ type: TOAST_TYPE.ERROR, title: "Error!", message });
    } finally {
      setDeletingId(null);
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    if (!canManage) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= types.length) return;
    const current = types[index];
    const target = types[targetIndex];
    setReorderingId(current.id);
    try {
      await Promise.all([
        updateType(workspaceSlug, projectId, current.id, { sort_order: target.sort_order }),
        updateType(workspaceSlug, projectId, target.id, { sort_order: current.sort_order }),
      ]);
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: "Error!", message: "Could not reorder type." });
    } finally {
      setReorderingId(null);
    }
  };

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-14 font-semibold text-primary">
          Level {level}: {HIERARCHY_LEVEL_LABELS[level]}
        </h3>
        <p className="text-12 text-tertiary">{LEVEL_DESCRIPTIONS[level]}</p>
      </div>

      {canManage && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label htmlFor={`hierarchy-type-name-${level}`} className="text-13 font-medium text-tertiary">
              Name
            </label>
            <Input
              id={`hierarchy-type-name-${level}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Type name"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor={`hierarchy-type-color-${level}`} className="text-13 font-medium text-tertiary">
              Color
            </label>
            <input
              id={`hierarchy-type-color-${level}`}
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded border border-subtle bg-transparent"
            />
          </div>
          <Button variant="primary" onClick={handleCreate} disabled={isSubmitting || !name.trim()}>
            Add type
          </Button>
        </div>
      )}

      <div className="divide-y divide-subtle rounded-md border border-subtle">
        {types.map((item, index) => (
          <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              {canManage && (
                <div className="flex flex-col">
                  <button
                    type="button"
                    className="rounded p-0.5 text-placeholder hover:bg-layer-1 hover:text-primary disabled:opacity-30"
                    disabled={index === 0 || reorderingId === item.id}
                    onClick={() => handleMove(index, -1)}
                    aria-label={`Move ${item.name} up`}
                  >
                    <ChevronUp className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    className="rounded p-0.5 text-placeholder hover:bg-layer-1 hover:text-primary disabled:opacity-30"
                    disabled={index === types.length - 1 || reorderingId === item.id}
                    onClick={() => handleMove(index, 1)}
                    aria-label={`Move ${item.name} down`}
                  >
                    <ChevronDown className="size-3.5" />
                  </button>
                </div>
              )}
              <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
              <div className="min-w-0">
                <p className="truncate text-14 font-medium text-primary">{item.name}</p>
                {item.is_default && <p className="text-12 text-tertiary">Default</p>}
              </div>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              <span className="text-12 text-tertiary">{item.is_active ? "Active" : "Archived"}</span>
              {canManage && (
                <>
                  <ToggleSwitch value={item.is_active} onChange={(isActive) => handleToggleActive(item.id, isActive)} />
                  <button
                    type="button"
                    className="flex size-7 items-center justify-center rounded text-placeholder hover:bg-layer-1 hover:text-danger-primary disabled:opacity-40"
                    disabled={deletingId === item.id}
                    onClick={() => handleDelete(item)}
                    aria-label={`Delete ${item.name}`}
                  >
                    <TrashIcon className="size-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        {types.length === 0 && <div className="px-4 py-6 text-13 text-tertiary">No types yet.</div>}
      </div>
    </section>
  );
}

function HierarchyStatusesPanel(props: { projectId: string; workspaceSlug: string }) {
  const { projectId, workspaceSlug } = props;
  const { getProjectStates, fetchProjectStates } = useProjectState();
  const { getProjectTypes } = useProjectHierarchyType();

  useEffect(() => {
    if (!workspaceSlug || !projectId) return;
    void fetchProjectStates(workspaceSlug, projectId);
  }, [workspaceSlug, projectId, fetchProjectStates]);

  const projectStates = getProjectStates(projectId) ?? [];
  const boardStates = projectStates
    .filter((s) => s.external_id?.startsWith(HIERARCHY_BOARD_STATE_PREFIX))
    .toSorted((a, b) => a.sequence - b.sequence);
  const subTaskTypes = getProjectTypes(projectId, 4) ?? [];

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div>
          <h3 className="text-14 font-semibold text-primary">Sub-tasks (Level 4 types)</h3>
          <p className="text-12 text-tertiary">
            Design, Dev, and QA types for leaf work items. Manage names/colors under Types → Level 4.
          </p>
        </div>
        <div className="divide-y divide-subtle rounded-md border border-subtle">
          {subTaskTypes.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3">
              <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
              <p className="text-14 font-medium text-primary">{item.name}</p>
              {!item.is_active && <span className="text-12 text-tertiary">Archived</span>}
            </div>
          ))}
          {subTaskTypes.length === 0 && <div className="px-4 py-6 text-13 text-tertiary">No sub-task types yet.</div>}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-14 font-semibold text-primary">L4 board states (columns)</h3>
          <p className="text-12 text-tertiary">
            These four project states are the board columns for sub-tasks (Design, Dev, and QA share them). Groups:
            Unstarted → To Do; Started → In Progress, Under Review; Completed → Done.
          </p>
        </div>
        <ol className="divide-y divide-subtle rounded-md border border-subtle">
          {boardStates.length > 0
            ? boardStates.map((state, index) => (
                <li key={state.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-5 text-12 text-tertiary">{index + 1}.</span>
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: state.color }} />
                  <span className="text-14 font-medium text-primary">{state.name}</span>
                </li>
              ))
            : L4_BOARD_STATE_OPTIONS.map((opt, index) => (
                <li key={opt.key} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-5 text-12 text-tertiary">{index + 1}.</span>
                  <span className="text-14 font-medium text-primary">{opt.label}</span>
                </li>
              ))}
        </ol>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-14 font-semibold text-primary">L3 delivery progress</h3>
          <p className="text-12 text-tertiary">
            Story/Bug/Task progress only. This is not a project state and does not appear as a board column. Change it
            on the work item sidebar.
          </p>
        </div>
        <ol className="divide-y divide-subtle rounded-md border border-subtle">
          {L3_PROGRESS_STATUS_OPTIONS.map((opt, index) => (
            <li key={opt.value} className="flex items-center gap-3 px-4 py-3">
              <span className="w-5 text-12 text-tertiary">{index + 1}.</span>
              <span
                className="h-3 w-3 flex-shrink-0 rounded-full"
                style={{ backgroundColor: L3_PROGRESS_PHASE_FALLBACK_COLORS[opt.phase] }}
              />
              <span className="text-14 font-medium text-primary">{opt.label}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function CapacityPlanningPanel(props: { workspaceSlug: string; projectId: string; canManage: boolean }) {
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
      setToast({ type: TOAST_TYPE.ERROR, title: "Error!", message: "Enter a valid average velocity." });
      return;
    }
    setIsSaving(true);
    try {
      await updateProject(workspaceSlug, projectId, { average_velocity: parsed });
      setToast({ type: TOAST_TYPE.SUCCESS, title: "Success!", message: "Average velocity updated." });
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: "Error!", message: "Could not update average velocity." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <h3 className="text-14 font-semibold text-primary">Sprint capacity</h3>
        <p className="mt-1 text-12 text-tertiary">
          Team average velocity is the baseline capacity bar for each person (story points of L4 sub-tasks in the
          sprint). Bars turn red when someone exceeds this limit after holiday / leave adjustments. Each public holiday
          or personal leave day reduces max capacity by {CAPACITY_SP_PER_HOLIDAY_DAY} SP (edit these on the cycle
          Capacity panel).
        </p>
      </div>
      <label htmlFor="scrumban-average-velocity" className="flex flex-col gap-1.5">
        <span className="text-13 font-medium text-secondary">Average velocity (SP)</span>
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
}

function HierarchySettingsPage() {
  const { workspaceSlug, projectId } = useParams() as { workspaceSlug: string; projectId: string };
  const { t } = useTranslation();
  const { currentProjectDetails } = useProject();
  const { workspaceUserInfo, allowPermissions } = useUserPermissions();
  const { fetchProjectTypes, fetchedMap } = useProjectHierarchyType();
  const [activeTab, setActiveTab] = useState<THierarchySettingsTab>("types");

  const pageTitle = currentProjectDetails?.name
    ? `${currentProjectDetails.name} - ${t("work_item_type_hierarchy.settings.title")}`
    : undefined;

  const canPerformProjectMemberActions = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.PROJECT
  );
  const canManage = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.PROJECT);

  useEffect(() => {
    if (!workspaceSlug || !projectId || fetchedMap[projectId]) return;
    void fetchProjectTypes(workspaceSlug, projectId);
  }, [workspaceSlug, projectId, fetchedMap, fetchProjectTypes]);

  if (workspaceUserInfo && !canPerformProjectMemberActions) {
    return <NotAuthorizedView section="settings" isProjectView className="h-auto" />;
  }

  const tabs: { id: THierarchySettingsTab; label: string }[] = [
    { id: "types", label: "Types" },
    { id: "subtasks-status", label: "Sub-tasks & status" },
    { id: "capacity", label: "Capacity" },
  ];

  return (
    <SettingsContentWrapper header={<HierarchyProjectSettingsHeader />}>
      <PageHead title={pageTitle} />
      <div className="space-y-6">
        <p className="text-13 text-tertiary">{t("work_item_type_hierarchy.settings.description")}</p>

        <div className="flex gap-1 border-b border-subtle">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`-mb-px border-b-2 px-3 py-2 text-13 font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-accent-primary text-primary"
                  : "border-transparent text-tertiary hover:text-primary"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "types" && (
          <div className="space-y-8">
            {LEVELS.map((level) => (
              <HierarchyLevelPanel
                key={level}
                level={level}
                workspaceSlug={workspaceSlug}
                projectId={projectId}
                canManage={canManage}
              />
            ))}
          </div>
        )}

        {activeTab === "subtasks-status" && (
          <HierarchyStatusesPanel projectId={projectId} workspaceSlug={workspaceSlug} />
        )}

        {activeTab === "capacity" && (
          <CapacityPlanningPanel workspaceSlug={workspaceSlug} projectId={projectId} canManage={canManage} />
        )}
      </div>
    </SettingsContentWrapper>
  );
}

export default observer(HierarchySettingsPage);
