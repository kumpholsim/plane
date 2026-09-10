/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useParams } from "next/navigation";
import { isStagedGateScrumbanMode } from "@plane/constants";
import { useProject } from "@/hooks/store/use-project";

/**
 * Whether the given project runs the Staged-gate Scrumban workflow.
 *
 * Classic Scrum projects must render the stock Plane experience, so every
 * hierarchy-aware component dispatches on this and falls back to classic when
 * the project is unknown or still loading.
 */
export const useIsStagedGateScrumban = (projectId?: string | string[] | null): boolean => {
  const params = useParams();
  const { getProjectById } = useProject();

  const resolvedProjectId = projectId ?? params?.projectId;
  if (!resolvedProjectId) return false;

  const id = Array.isArray(resolvedProjectId) ? resolvedProjectId[0] : resolvedProjectId.toString();
  return isStagedGateScrumbanMode(getProjectById(id)?.workflow_mode);
};
