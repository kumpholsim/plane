/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import type { Control } from "react-hook-form";
import type { ISearchIssueResponse, TIssue } from "@plane/types";
// hooks
import { useIsStagedGateScrumban } from "@/hooks/use-workflow-mode";
// local imports
import { ClassicIssueDefaultProperties } from "./default-properties.classic";
import { ScrumbanIssueDefaultProperties } from "./default-properties.scrumban";

type TIssueDefaultPropertiesProps = {
  control: Control<TIssue>;
  id: string | undefined;
  projectId: string | null;
  workspaceSlug: string;
  selectedParentIssue: ISearchIssueResponse | null;
  startDate: string | null;
  targetDate: string | null;
  parentId: string | null;
  isDraft: boolean;
  handleFormChange: () => void;
  setSelectedParentIssue: (issue: ISearchIssueResponse) => void;
};

export const IssueDefaultProperties = observer(function IssueDefaultProperties(props: TIssueDefaultPropertiesProps) {
  const isStagedGateScrumban = useIsStagedGateScrumban(props.projectId);

  if (isStagedGateScrumban) return <ScrumbanIssueDefaultProperties {...props} />;
  return <ClassicIssueDefaultProperties {...props} />;
});
