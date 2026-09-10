/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback } from "react";
import { xor } from "lodash-es";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// types
import { ModuleIcon } from "@plane/propel/icons";
import type { TIssue } from "@plane/types";
// components
import { ModuleDropdown } from "@/components/dropdowns/module/dropdown";
import { getAncestorEpicId } from "@/components/issues/issue-detail-widgets/sub-issues/depth";
// hooks
import { useIssues } from "@/hooks/store/use-issues";
import { useIssuesStore, useIssueStoreType } from "@/hooks/use-issue-layout-store";
import { useIsStagedGateScrumban } from "@/hooks/use-workflow-mode";

type Props = {
  issue: TIssue;
  onClose: () => void;
  disabled: boolean;
};

/** Scrumban shows the ancestor epic in this column instead of module membership. */
const ScrumbanEpicCell = observer(function ScrumbanEpicCell(props: { issue: TIssue }) {
  const { issue } = props;
  const storeType = useIssueStoreType();
  const { issueMap } = useIssues(storeType);
  const epicId = getAncestorEpicId(issue, (id) => issueMap[id]);
  const epicIssue = epicId ? issueMap[epicId] : undefined;

  return (
    <div className="flex h-11 items-center border-b-[0.5px] border-subtle px-page-x text-body-xs-regular text-secondary">
      {epicIssue ? (
        <span className="flex items-center gap-1 truncate">
          <ModuleIcon className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">{epicIssue.name}</span>
        </span>
      ) : (
        <span className="text-placeholder">—</span>
      )}
    </div>
  );
});

const ClassicModuleCell = observer(function ClassicModuleCell(props: Props) {
  const { issue, disabled, onClose } = props;
  // router
  const { workspaceSlug } = useParams();
  // hooks
  const {
    issues: { changeModulesInIssue },
  } = useIssuesStore();

  const handleModule = useCallback(
    async (moduleIds: string[] | null) => {
      if (!workspaceSlug || !issue || !issue.project_id || !issue.module_ids || !moduleIds) return;

      const updatedModuleIds = xor(issue.module_ids, moduleIds);
      const modulesToAdd: string[] = [];
      const modulesToRemove: string[] = [];
      for (const moduleId of updatedModuleIds) {
        if (issue.module_ids.includes(moduleId)) modulesToRemove.push(moduleId);
        else modulesToAdd.push(moduleId);
      }
      changeModulesInIssue(workspaceSlug.toString(), issue.project_id, issue.id, modulesToAdd, modulesToRemove);
    },
    [workspaceSlug, issue, changeModulesInIssue]
  );

  return (
    <div className="h-11 border-b-[0.5px] border-subtle">
      <ModuleDropdown
        projectId={issue?.project_id ?? undefined}
        value={issue?.module_ids ?? []}
        onChange={handleModule}
        disabled={disabled}
        placeholder="Select modules"
        buttonVariant="transparent-with-text"
        buttonContainerClassName="w-full relative flex items-center p-2 group-[.selected-issue-row]:bg-accent-primary/5 group-[.selected-issue-row]:hover:bg-accent-primary/10 px-page-x"
        buttonClassName="relative leading-4 h-4.5 bg-transparent hover:bg-transparent !px-0"
        onClose={onClose}
        multiple
        showCount
        showTooltip
      />
    </div>
  );
});

export const SpreadsheetModuleColumn = observer(function SpreadsheetModuleColumn(props: Props) {
  const isStagedGateScrumban = useIsStagedGateScrumban(props.issue.project_id);

  if (isStagedGateScrumban) return <ScrumbanEpicCell issue={props.issue} />;
  return <ClassicModuleCell {...props} />;
});
