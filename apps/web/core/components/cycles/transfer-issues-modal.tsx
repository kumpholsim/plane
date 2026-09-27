/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { SearchIcon, CycleIcon, TransferIcon, CloseIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { EIssuesStoreType } from "@plane/types";
import { EModalPosition, EModalWidth, ModalCore } from "@plane/ui";
import { useCycle } from "@/hooks/store/use-cycle";
import { useIssues } from "@/hooks/store/use-issues";
import { useProject } from "@/hooks/store/use-project";
import { revalidateCycleTransferPreview } from "@/hooks/use-cycle-transfer-preview";
import { CycleService } from "@/services/cycle.service";
import type { TTransferPreviewItem } from "./transfer-issues-confirm-modal";
import { TransferIssuesConfirmModal } from "./transfer-issues-confirm-modal";

const cycleService = new CycleService();

type Props = {
  isOpen: boolean;
  handleClose: () => void;
  cycleId: string;
};

export const TransferIssuesModal = observer(function TransferIssuesModal(props: Props) {
  const { isOpen, handleClose, cycleId } = props;
  const [query, setQuery] = useState("");
  const [destinationCycleId, setDestinationCycleId] = useState<string | null>(null);
  const [staying, setStaying] = useState<TTransferPreviewItem[]>([]);
  const [transferring, setTransferring] = useState<TTransferPreviewItem[]>([]);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { currentProjectIncompleteCycleIds, getCycleById, fetchActiveCycleProgress } = useCycle();
  const {
    issues: { transferIssuesFromCycle },
  } = useIssues(EIssuesStoreType.CYCLE);
  const { getProjectIdentifierById } = useProject();

  const { workspaceSlug, projectId } = useParams();
  const projectIdentifier = projectId ? getProjectIdentifierById(projectId.toString()) : undefined;

  const resetAndClose = () => {
    setQuery("");
    setDestinationCycleId(null);
    setStaying([]);
    setTransferring([]);
    setIsPreviewLoading(false);
    setIsSubmitting(false);
    handleClose();
  };

  const selectDestination = async (optionId: string) => {
    if (!workspaceSlug || !projectId || !cycleId) return;
    setIsPreviewLoading(true);
    try {
      const preview = await cycleService.previewTransferIssues(
        workspaceSlug.toString(),
        projectId.toString(),
        cycleId.toString()
      );
      setStaying(preview.staying ?? []);
      setTransferring(preview.transferring ?? []);
      setDestinationCycleId(optionId);
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error!",
        message: "Unable to load the transfer preview. Please try again.",
      });
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const transferIssue = async () => {
    if (!workspaceSlug || !projectId || !cycleId || !destinationCycleId) return;
    setIsSubmitting(true);
    try {
      await transferIssuesFromCycle(workspaceSlug.toString(), projectId.toString(), cycleId.toString(), {
        new_cycle_id: destinationCycleId,
      });
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Success!",
        message: "Work items have been transferred successfully",
      });
      await getCycleDetails(destinationCycleId);
      await revalidateCycleTransferPreview(workspaceSlug.toString(), projectId.toString(), cycleId.toString());
      resetAndClose();
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error!",
        message: "Unable to transfer work items. Please try again.",
      });
      setIsSubmitting(false);
    }
  };

  const getCycleDetails = async (newCycleId: string) => {
    const cyclesFetch = [
      fetchActiveCycleProgress(workspaceSlug.toString(), projectId.toString(), cycleId),
      fetchActiveCycleProgress(workspaceSlug.toString(), projectId.toString(), newCycleId),
    ];
    await Promise.all(cyclesFetch).catch((error) => {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error",
        message: error.error || "Unable to fetch cycle details",
      });
    });
  };

  const filteredOptions = currentProjectIncompleteCycleIds?.filter((optionId) => {
    if (optionId === cycleId) return false;
    const cycleDetails = getCycleById(optionId);
    return cycleDetails?.name?.toLowerCase().includes(query?.toLowerCase());
  });

  const destinationName = destinationCycleId ? (getCycleById(destinationCycleId)?.name ?? "selected sprint") : "";

  return (
    <ModalCore isOpen={isOpen} handleClose={resetAndClose} position={EModalPosition.TOP} width={EModalWidth.XXL}>
      {destinationCycleId && workspaceSlug && projectId ? (
        <TransferIssuesConfirmModal
          isSubmitting={isSubmitting}
          workspaceSlug={workspaceSlug.toString()}
          projectId={projectId.toString()}
          projectIdentifier={projectIdentifier}
          destinationName={destinationName}
          staying={staying}
          transferring={transferring}
          onBack={() => setDestinationCycleId(null)}
          onClose={resetAndClose}
          onConfirm={() => {
            void transferIssue();
          }}
        />
      ) : (
        <div className="flex flex-col gap-4 py-5">
          <div className="flex items-center justify-between px-5">
            <div className="flex items-center gap-1">
              <TransferIcon className="w-5 fill-primary" />
              <h4 className="text-18 font-medium text-primary">Transfer work items</h4>
            </div>
            <button type="button" onClick={resetAndClose}>
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 border-b border-subtle px-5 pb-3">
            <SearchIcon className="h-4 w-4 text-secondary" />
            <input
              className="text-13 outline-none"
              placeholder="Search for a cycle..."
              onChange={(e) => setQuery(e.target.value)}
              value={query}
            />
          </div>
          <div className="flex w-full flex-col items-start gap-2 px-5">
            {isPreviewLoading ? (
              <p className="w-full p-5 text-center text-13 text-secondary">Loading...</p>
            ) : filteredOptions ? (
              filteredOptions.length > 0 ? (
                filteredOptions.map((optionId) => {
                  const cycleDetails = getCycleById(optionId);
                  if (!cycleDetails) return null;
                  return (
                    <button
                      key={optionId}
                      type="button"
                      className="flex w-full items-center gap-4 rounded-sm px-4 py-3 text-13 text-secondary hover:bg-surface-2"
                      onClick={() => {
                        void selectDestination(optionId);
                      }}
                    >
                      <CycleIcon className="h-5 w-5" />
                      <div className="flex w-full justify-between truncate">
                        <span className="truncate">{cycleDetails?.name}</span>
                        {cycleDetails.status && (
                          <span className="flex flex-shrink-0 items-center rounded-full bg-layer-1 px-2 capitalize">
                            {cycleDetails.status.toLocaleLowerCase()}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="flex w-full items-center justify-center gap-4 p-5 text-13">
                  <AlertCircle className="h-3.5 w-3.5 text-secondary" />
                  <span className="text-center text-secondary">No open sprint is available as a destination.</span>
                </div>
              )
            ) : (
              <p className="text-center text-secondary">Loading...</p>
            )}
          </div>
        </div>
      )}
    </ModalCore>
  );
});
