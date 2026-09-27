/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import {
  EUserPermissions,
  EUserPermissionsLevel,
  HIERARCHY_BOARD_STATE_PREFIX,
  L3_PROGRESS_PHASE_FALLBACK_COLORS,
  L3_PROGRESS_STATUS_OPTIONS,
  L4_BOARD_STATE_OPTIONS,
} from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { LockIcon } from "@plane/propel/icons";
import { HIERARCHY_LEVEL_LABELS } from "@plane/types";
import { NotAuthorizedView } from "@/components/auth-screens/not-authorized-view";
import { PageHead } from "@/components/core/page-title";
import { L3ProgressStatusSwatch } from "@/components/issues/l3-progress-status-swatch";
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

type THierarchySettingsTab = "types" | "subtasks-status";

function HierarchyLevelPanel(props: { level: (typeof LEVELS)[number]; projectId: string }) {
  const { level, projectId } = props;
  const { getProjectTypes } = useProjectHierarchyType();
  const types = getProjectTypes(projectId, level) ?? [];

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-14 font-semibold text-primary">
          Level {level}: {HIERARCHY_LEVEL_LABELS[level]}
        </h3>
        <p className="text-12 text-tertiary">{LEVEL_DESCRIPTIONS[level]}</p>
      </div>

      <div className="divide-y divide-subtle rounded-md border border-subtle">
        {types.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
              <div className="min-w-0">
                <p className="truncate text-14 font-medium text-primary">{item.name}</p>
                {item.is_default && <p className="text-12 text-tertiary">Default</p>}
              </div>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2 text-tertiary">
              <LockIcon className="size-3.5" />
              <span className="text-12">{item.is_active ? "Active" : "Archived"}</span>
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
            on the work item sidebar. A green tick marks the three exit gates; Design Done and Dev Done are intermediate
            only.
          </p>
        </div>
        <ol className="divide-y divide-subtle rounded-md border border-subtle">
          {L3_PROGRESS_STATUS_OPTIONS.map((opt, index) => (
            <li key={opt.value} className="flex items-center gap-3 px-4 py-3">
              <span className="w-5 text-12 text-tertiary">{index + 1}.</span>
              <L3ProgressStatusSwatch color={L3_PROGRESS_PHASE_FALLBACK_COLORS[opt.phase]} progressStatus={opt.value} />
              <span className="text-14 font-medium text-primary">{opt.label}</span>
              {opt.exitGate && <span className="text-12 text-success-primary">Exit gate</span>}
            </li>
          ))}
        </ol>
      </section>
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
            <p className="flex items-center gap-1.5 text-12 text-tertiary">
              <LockIcon className="size-3.5" />
              Hierarchy types are system-defined and cannot be edited.
            </p>
            {LEVELS.map((level) => (
              <HierarchyLevelPanel key={level} level={level} projectId={projectId} />
            ))}
          </div>
        )}

        {activeTab === "subtasks-status" && (
          <HierarchyStatusesPanel projectId={projectId} workspaceSlug={workspaceSlug} />
        )}
      </div>
    </SettingsContentWrapper>
  );
}

export default observer(HierarchySettingsPage);
