/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import useSWR, { mutate } from "swr";
import { CycleService } from "@/services/cycle.service";

const cycleService = new CycleService();

export const cycleTransferPreviewCacheKey = (
  workspaceSlug: string | undefined,
  projectId: string | undefined,
  cycleId: string | undefined
) => (workspaceSlug && projectId && cycleId ? `CYCLE_TRANSFER_PREVIEW_${workspaceSlug}_${projectId}_${cycleId}` : null);

export const revalidateCycleTransferPreview = (workspaceSlug: string, projectId: string, cycleId: string) =>
  mutate(cycleTransferPreviewCacheKey(workspaceSlug, projectId, cycleId));

export const useCycleTransferPreview = (
  workspaceSlug: string | undefined,
  projectId: string | undefined,
  cycleId: string | undefined,
  enabled = true
) => {
  const key = enabled ? cycleTransferPreviewCacheKey(workspaceSlug, projectId, cycleId) : null;
  const { data, isLoading } = useSWR(
    key,
    () => cycleService.previewTransferIssues(workspaceSlug as string, projectId as string, cycleId as string),
    { revalidateIfStale: false, revalidateOnFocus: false }
  );

  return {
    stayingCount: data?.staying?.length ?? 0,
    transferringCount: data?.transferring?.length ?? 0,
    hasTransferableWork: (data?.transferring?.length ?? 0) > 0,
    isLoading,
  };
};
