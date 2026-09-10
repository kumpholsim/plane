/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// hooks
import { useIsStagedGateScrumban } from "@/hooks/use-workflow-mode";
// local imports
import type { TIssueOperations } from "../issue-detail";
import { ClassicPeekOverviewProperties } from "./properties.classic";
import { ScrumbanPeekOverviewProperties } from "./properties.scrumban";

interface IPeekOverviewProperties {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  disabled: boolean;
  issueOperations: TIssueOperations;
}

export const PeekOverviewProperties = observer(function PeekOverviewProperties(props: IPeekOverviewProperties) {
  const isStagedGateScrumban = useIsStagedGateScrumban(props.projectId);

  if (isStagedGateScrumban) return <ScrumbanPeekOverviewProperties {...props} />;
  return <ClassicPeekOverviewProperties {...props} />;
});
