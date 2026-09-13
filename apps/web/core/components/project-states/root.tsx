/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
// components
import { EUserPermissionsLevel } from "@plane/constants";
import { LockIcon } from "@plane/propel/icons";
import { Tooltip } from "@plane/propel/tooltip";
import type { IState, TStateOperationsCallbacks } from "@plane/types";
import { EUserProjectRoles } from "@plane/types";
import { ProjectStateLoader, GroupList } from "@/components/project-states";
// hooks
import { useProjectState } from "@/hooks/store/use-project-state";
import { useUserPermissions } from "@/hooks/store/user";
import { useIsStagedGateScrumban } from "@/hooks/use-workflow-mode";

type TProjectState = {
  workspaceSlug: string;
  projectId: string;
};

export const ProjectStateRoot = observer(function ProjectStateRoot(props: TProjectState) {
  const { workspaceSlug, projectId } = props;
  // hooks
  const {
    groupedProjectStates,
    fetchProjectStates,
    createState,
    moveStatePosition,
    updateState,
    deleteState,
    markStateAsDefault,
  } = useProjectState();
  const { allowPermissions } = useUserPermissions();
  const isStagedGateScrumban = useIsStagedGateScrumban(projectId);
  // derived values
  const isEditable = allowPermissions(
    [EUserProjectRoles.ADMIN],
    EUserPermissionsLevel.PROJECT,
    workspaceSlug,
    projectId
  );
  // Scrumban swimlane columns are fixed — block add/remove/reorder
  const canAddOrRemoveStates = isEditable && !isStagedGateScrumban;

  // Fetching all project states
  useSWR(
    workspaceSlug && projectId ? `PROJECT_STATES_${workspaceSlug}_${projectId}` : null,
    workspaceSlug && projectId ? () => fetchProjectStates(workspaceSlug.toString(), projectId.toString()) : null,
    { revalidateIfStale: false, revalidateOnFocus: false }
  );

  // State operations callbacks
  const stateOperationsCallbacks: TStateOperationsCallbacks = useMemo(
    () => ({
      createState: async (data: Partial<IState>) => createState(workspaceSlug, projectId, data),
      updateState: async (stateId: string, data: Partial<IState>) =>
        updateState(workspaceSlug, projectId, stateId, data),
      deleteState: async (stateId: string) => deleteState(workspaceSlug, projectId, stateId),
      moveStatePosition: async (stateId: string, data: Partial<IState>) =>
        moveStatePosition(workspaceSlug, projectId, stateId, data),
      markStateAsDefault: async (stateId: string) => markStateAsDefault(workspaceSlug, projectId, stateId),
    }),
    [workspaceSlug, projectId, createState, moveStatePosition, updateState, deleteState, markStateAsDefault]
  );

  // Loader
  if (!groupedProjectStates) return <ProjectStateLoader />;

  return (
    <div className="space-y-4">
      {isStagedGateScrumban && (
        <div className="flex items-center gap-2 rounded-md border border-subtle bg-surface-2 px-3 py-2 text-13 text-secondary">
          <Tooltip tooltipContent="Swimlane states are fixed for Scrumban workflows" renderByDefault={false}>
            <span className="inline-flex text-tertiary">
              <LockIcon className="size-3.5" />
            </span>
          </Tooltip>
          <span>Swimlane states are locked. You can rename or recolor them, but not add or remove columns.</span>
        </div>
      )}
      <GroupList
        groupedStates={groupedProjectStates}
        stateOperationsCallbacks={stateOperationsCallbacks}
        isEditable={isEditable}
        canAddOrRemoveStates={canAddOrRemoveStates}
        shouldTrackEvents
      />
    </div>
  );
});
