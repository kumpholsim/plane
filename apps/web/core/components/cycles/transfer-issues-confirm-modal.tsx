/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import Link from "next/link";
import { observer } from "mobx-react";
import { CloseIcon, TransferIcon } from "@plane/propel/icons";
import { Button } from "@plane/propel/button";
import { generateWorkItemLink } from "@plane/utils";

export type TTransferPreviewItem = {
  id: string;
  name: string;
  sequence_id: number;
};

type Props = {
  isSubmitting: boolean;
  workspaceSlug: string;
  projectId: string;
  projectIdentifier: string | undefined;
  destinationName: string;
  staying: TTransferPreviewItem[];
  transferring: TTransferPreviewItem[];
  onBack: () => void;
  onClose: () => void;
  onConfirm: () => void;
};

function WorkItemNameList(props: {
  items: TTransferPreviewItem[];
  emptyLabel: string;
  workspaceSlug: string;
  projectId: string;
  projectIdentifier: string | undefined;
}) {
  const { items, emptyLabel, workspaceSlug, projectId, projectIdentifier } = props;
  if (items.length === 0) {
    return <p className="py-2 text-13 text-tertiary">{emptyLabel}</p>;
  }
  return (
    <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
      {items.map((item) => {
        const href = generateWorkItemLink({
          workspaceSlug,
          projectId,
          issueId: item.id,
          projectIdentifier,
          sequenceId: item.sequence_id,
        });
        return (
          <li key={item.id}>
            <Link
              href={href}
              className="block truncate rounded-sm px-2 py-1.5 text-13 text-accent-primary hover:bg-surface-2 hover:underline"
            >
              {item.sequence_id ? `#${item.sequence_id} ` : ""}
              {item.name}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export const TransferIssuesConfirmModal = observer(function TransferIssuesConfirmModal(props: Props) {
  const {
    isSubmitting,
    workspaceSlug,
    projectId,
    projectIdentifier,
    destinationName,
    staying,
    transferring,
    onBack,
    onClose,
    onConfirm,
  } = props;

  return (
    <div className="flex max-h-[min(36rem,80vh)] flex-col">
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex min-w-0 items-center gap-1">
          <TransferIcon className="w-5 shrink-0 fill-primary" />
          <h4 className="truncate text-18 font-medium text-primary">Confirm transfer to {destinationName}</h4>
        </div>
        <button type="button" onClick={onClose} className="shrink-0">
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-4 overflow-hidden px-5 pb-4">
        <section className="flex min-h-0 flex-col gap-2">
          <h5 className="text-13 font-medium text-primary">Completed ({staying.length})</h5>
          <WorkItemNameList
            items={staying}
            emptyLabel="None"
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            projectIdentifier={projectIdentifier}
          />
        </section>
        <section className="flex min-h-0 flex-col gap-2">
          <h5 className="text-13 font-medium text-primary">To transfer ({transferring.length})</h5>
          <WorkItemNameList
            items={transferring}
            emptyLabel="None"
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            projectIdentifier={projectIdentifier}
          />
        </section>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-subtle px-5 py-4">
        <Button variant="secondary" size="lg" onClick={onBack} disabled={isSubmitting}>
          Back
        </Button>
        <Button
          variant="primary"
          size="lg"
          onClick={onConfirm}
          disabled={isSubmitting || transferring.length === 0}
          loading={isSubmitting}
        >
          Transfer
        </Button>
      </div>
    </div>
  );
});
