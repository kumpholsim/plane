/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import type { TIssueServiceType } from "@plane/types";
import { EIssueServiceType } from "@plane/types";
import { CircularProgressIndicator, CollapsibleButton } from "@plane/ui";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useIsStagedGateScrumban } from "@/hooks/use-workflow-mode";
import { SubWorkItemTitleActions } from "./title-actions";
import { childrenSectionTitleKey, getHierarchyLevel } from "./depth";

type Props = {
  isOpen: boolean;
  parentIssueId: string;
  disabled: boolean;
  issueServiceType?: TIssueServiceType;
  projectId: string;
  workspaceSlug: string;
};

export const SubIssuesCollapsibleTitle = observer(function SubIssuesCollapsibleTitle(props: Props) {
  const { isOpen, parentIssueId, disabled, issueServiceType = EIssueServiceType.ISSUES, projectId } = props;
  // translation
  const { t } = useTranslation();
  // store hooks
  const {
    issue: { getIssueById },
    subIssues: { subIssuesByIssueId, stateDistributionByIssueId },
  } = useIssueDetail(issueServiceType);
  const isStagedGateScrumban = useIsStagedGateScrumban(projectId);
  // derived values
  const subIssuesDistribution = stateDistributionByIssueId(parentIssueId);
  const storedSubIssues = subIssuesByIssueId(parentIssueId);
  const parentIssue = getIssueById(parentIssueId);
  const parentLevel = getHierarchyLevel(parentIssue);
  const isEpicService = issueServiceType === EIssueServiceType.EPICS;

  // Scrumban always renders the header so sub-tasks can be added; classic hides it until one exists
  if (!isStagedGateScrumban && !storedSubIssues) return null;

  const subIssues = storedSubIssues ?? [];
  const title = isStagedGateScrumban
    ? t(childrenSectionTitleKey(parentLevel, isEpicService), { count: 2 })
    : isEpicService
      ? t("issue.label", { count: 1 })
      : t("common.sub_work_items");

  // calculate percentage of completed sub-issues
  const completedCount = subIssuesDistribution?.completed?.length ?? 0;
  const totalCount = subIssues.length;
  const percentage = completedCount && totalCount ? (completedCount / totalCount) * 100 : 0;

  return (
    <CollapsibleButton
      isOpen={isOpen}
      title={title}
      indicatorElement={
        <div className="flex items-center gap-1.5 text-13 text-tertiary">
          <CircularProgressIndicator size={18} percentage={percentage} strokeWidth={3} />
          <span>
            {completedCount}/{totalCount} {t("common.done")}
          </span>
        </div>
      }
      actionItemElement={
        <SubWorkItemTitleActions
          projectId={projectId}
          parentId={parentIssueId}
          disabled={disabled}
          issueServiceType={issueServiceType}
        />
      }
    />
  );
});
