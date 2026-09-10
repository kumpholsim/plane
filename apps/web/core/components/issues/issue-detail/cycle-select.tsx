/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState } from "react";
import { observer } from "mobx-react";
import { useTranslation } from "@plane/i18n";
// hooks
// components
import { cn } from "@plane/utils";
import { CycleDropdown } from "@/components/dropdowns/cycle";
import {
  canEditCycle,
  getHierarchyLevel,
  shouldShowCycleProperty,
} from "@/components/issues/issue-detail-widgets/sub-issues/depth";
// ui
// helpers
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
// types
import type { TIssueOperations } from "./root";

type TIssueCycleSelect = {
  className?: string;
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  issueOperations: TIssueOperations;
  disabled?: boolean;
  /** Scrumban only: restrict cycle to L3/L4 and let L4 inherit its parent's cycle. */
  enforceHierarchyRules?: boolean;
};

export const IssueCycleSelect = observer(function IssueCycleSelect(props: TIssueCycleSelect) {
  const {
    className = "",
    workspaceSlug,
    projectId,
    issueId,
    issueOperations,
    disabled = false,
    enforceHierarchyRules = false,
  } = props;
  const { t } = useTranslation();
  // states
  const [isUpdating, setIsUpdating] = useState(false);
  // store hooks
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  // derived values
  const issue = getIssueById(issueId);
  const level = getHierarchyLevel(issue);
  const parent = issue?.parent_id ? getIssueById(issue.parent_id) : undefined;
  // Prefer own cycle; fall back to parent when L4 has not been assigned yet
  const cycleId = enforceHierarchyRules ? (issue?.cycle_id ?? parent?.cycle_id ?? null) : (issue?.cycle_id ?? null);
  const cycleEditable = (!enforceHierarchyRules || canEditCycle(level)) && !disabled;
  const disableSelect = disabled || isUpdating || !cycleEditable;

  const handleIssueCycleChange = async (nextCycleId: string | null) => {
    if (!issue || !cycleEditable || issue.cycle_id === nextCycleId) return;
    setIsUpdating(true);
    if (nextCycleId) await issueOperations.addCycleToIssue?.(workspaceSlug, projectId, nextCycleId, issueId);
    else await issueOperations.removeIssueFromCycle?.(workspaceSlug, projectId, issue.cycle_id ?? "", issueId);
    setIsUpdating(false);
  };

  if (enforceHierarchyRules && !shouldShowCycleProperty(level)) return null;

  return (
    <div className={cn("flex h-full items-center gap-1", className)}>
      <CycleDropdown
        value={cycleId}
        onChange={handleIssueCycleChange}
        projectId={projectId}
        disabled={disableSelect}
        buttonVariant="transparent-with-text"
        className="group w-full"
        buttonContainerClassName="w-full text-left h-7.5 rounded-sm"
        buttonClassName={`text-body-xs-medium justify-between ${cycleId ? "" : "text-placeholder"}`}
        placeholder={t("cycle.no_cycle")}
        hideIcon
        dropdownArrow
        dropdownArrowClassName="h-3.5 w-3.5 hidden group-hover:inline"
      />
    </div>
  );
});
