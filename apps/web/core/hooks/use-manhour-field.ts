/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { manhourFromStoryPoints } from "@plane/constants";
import { HIERARCHY_LEVEL_SUB_TASK } from "@plane/types";
import type { TIssue } from "@plane/types";
import { getHierarchyLevel } from "@/components/issues/issue-detail-widgets/sub-issues/depth";
import { useProjectEstimates } from "@/hooks/store/estimates";
import { useEstimate } from "@/hooks/store/estimates/use-estimate";
import { useProject } from "@/hooks/store/use-project";

export function useManhourFieldState(issue: TIssue | undefined) {
  const { getProjectById } = useProject();
  const { estimates, currentActiveEstimateIdByProjectId } = useProjectEstimates();
  const projectDetails = issue?.project_id ? getProjectById(issue.project_id) : undefined;
  const autoConvert = Boolean(projectDetails?.is_manhour_auto_convert_enabled);
  const show =
    Boolean(issue) &&
    getHierarchyLevel(issue) === HIERARCHY_LEVEL_SUB_TASK &&
    Boolean(projectDetails?.is_manhour_enabled);

  const activeEstimateId =
    projectDetails?.estimate ?? (issue?.project_id ? currentActiveEstimateIdByProjectId(issue.project_id) : undefined);
  const { estimatePointById } = useEstimate(activeEstimateId ?? undefined);
  const estimatePointId = issue?.estimate_point ?? undefined;
  const selectedEstimate = estimatePointId
    ? (estimatePointById?.(estimatePointId) ??
      Object.values(estimates ?? {})
        .map((estimate) => estimate.estimatePointById?.(estimatePointId))
        .find(Boolean))
    : undefined;

  return {
    show,
    autoConvert,
    value: autoConvert ? manhourFromStoryPoints(selectedEstimate?.value) : (issue?.manhour ?? null),
    disabled: autoConvert,
  };
}
