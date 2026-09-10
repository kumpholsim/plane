/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type React from "react";
import { observer } from "mobx-react";
import type { TIssueServiceType } from "@plane/types";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useIsStagedGateScrumban } from "@/hooks/use-workflow-mode";
// local imports
import { ClassicSubIssuesActionButton } from "./quick-action-button.classic";
import { ScrumbanSubIssuesActionButton } from "./quick-action-button.scrumban";

export { resolveTodoStateId } from "./quick-action-button.scrumban";

type Props = {
  issueId: string;
  customButton?: React.ReactNode;
  customButtonClassName?: string;
  disabled?: boolean;
  issueServiceType: TIssueServiceType;
};

export const SubIssuesActionButton = observer(function SubIssuesActionButton(props: Props) {
  const { issueId, customButton, customButtonClassName, disabled = false, issueServiceType } = props;
  const {
    issue: { getIssueById },
  } = useIssueDetail(issueServiceType);
  const isStagedGateScrumban = useIsStagedGateScrumban(getIssueById(issueId)?.project_id);

  if (isStagedGateScrumban)
    return (
      <ScrumbanSubIssuesActionButton
        issueId={issueId}
        customButton={customButton}
        customButtonClassName={customButtonClassName}
        disabled={disabled}
        issueServiceType={issueServiceType}
      />
    );

  return (
    <ClassicSubIssuesActionButton
      issueId={issueId}
      customButton={customButton}
      disabled={disabled}
      issueServiceType={issueServiceType}
    />
  );
});
