/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import type { IIssueDisplayProperties, TIssue } from "@plane/types";
// hooks
import { useIsStagedGateScrumban } from "@/hooks/use-workflow-mode";
// local imports
import { ClassicIssueProperties } from "./all-properties.classic";
import { ScrumbanIssueProperties } from "./all-properties.scrumban";

export interface IIssueProperties {
  issue: TIssue;
  updateIssue: ((projectId: string | null, issueId: string, data: Partial<TIssue>) => Promise<void>) | undefined;
  displayProperties: IIssueDisplayProperties | undefined;
  isReadOnly: boolean;
  className: string;
  activeLayout: string;
  isEpic?: boolean;
}

export const IssueProperties = observer(function IssueProperties(props: IIssueProperties) {
  const isStagedGateScrumban = useIsStagedGateScrumban(props.issue.project_id);

  if (isStagedGateScrumban) return <ScrumbanIssueProperties {...props} />;
  return <ClassicIssueProperties {...props} />;
});
