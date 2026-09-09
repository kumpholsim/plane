/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { ModuleIcon } from "@plane/propel/icons";
import type { TIssue } from "@plane/types";
import { getAncestorEpicId } from "@/components/issues/issue-detail-widgets/sub-issues/depth";
import { useIssues } from "@/hooks/store/use-issues";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";

type Props = {
  issue: TIssue;
  onClose: () => void;
  disabled: boolean;
};

export const SpreadsheetModuleColumn = observer(function SpreadsheetModuleColumn(props: Props) {
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
