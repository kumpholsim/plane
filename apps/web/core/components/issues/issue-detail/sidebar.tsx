/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// hooks
import { useIsStagedGateScrumban } from "@/hooks/use-workflow-mode";
// local imports
import { ClassicIssueDetailsSidebar } from "./sidebar.classic";
import { ScrumbanIssueDetailsSidebar } from "./sidebar.scrumban";
import type { TIssueOperations } from "./root";

type Props = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  issueOperations: TIssueOperations;
  isEditable: boolean;
};

export const IssueDetailsSidebar = observer(function IssueDetailsSidebar(props: Props) {
  const isStagedGateScrumban = useIsStagedGateScrumban(props.projectId);

  if (isStagedGateScrumban) return <ScrumbanIssueDetailsSidebar {...props} />;
  return <ClassicIssueDetailsSidebar {...props} />;
});
