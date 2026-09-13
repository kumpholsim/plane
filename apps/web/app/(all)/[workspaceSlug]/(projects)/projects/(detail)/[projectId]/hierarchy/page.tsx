/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { redirect, useParams } from "next/navigation";
import { isStagedGateScrumbanMode } from "@plane/constants";
import { useProject } from "@/hooks/store/use-project";

/**
 * Legacy project Hierarchy route — Scrumban manages milestones/epics under Modules
 * and hierarchy types under Project Settings, so this page always redirects.
 */
function ProjectHierarchyPage() {
  const { workspaceSlug, projectId } = useParams() as { workspaceSlug: string; projectId: string };
  const { currentProjectDetails } = useProject();
  const isScrumban = isStagedGateScrumbanMode(currentProjectDetails?.workflow_mode);

  if (isScrumban) {
    throw redirect(`/${workspaceSlug}/projects/${projectId}/modules`);
  }

  throw redirect(`/${workspaceSlug}/projects/${projectId}/issues`);
}

export default observer(ProjectHierarchyPage);
