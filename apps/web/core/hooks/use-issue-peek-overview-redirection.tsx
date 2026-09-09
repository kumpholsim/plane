/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRouter } from "next/navigation";
// types
import type { TIssue } from "@plane/types";
import { EIssueServiceType } from "@plane/types";
// helpers
import { generateWorkItemLink } from "@plane/utils";
// hooks
import { useIssueDetail } from "./store/use-issue-detail";
import { useProject } from "./store/use-project";

type TPeekRedirectionOptions = {
  /** When true and peek is already open, push current peek onto history (sub-work navigation). */
  fromSubWork?: boolean;
};

const useIssuePeekOverviewRedirection = (isEpic: boolean = false) => {
  // router
  const router = useRouter();
  //   store hooks
  const { getIsIssuePeeked, setPeekIssue, navigatePeekIssue, isPeekOpen } = useIssueDetail(
    isEpic ? EIssueServiceType.EPICS : EIssueServiceType.ISSUES
  );
  const { getProjectIdentifierById } = useProject();

  const handleRedirection = (
    workspaceSlug: string | undefined,
    issue: TIssue | undefined,
    isMobile = false,
    nestingLevel?: number,
    options?: TPeekRedirectionOptions
  ) => {
    if (!issue) return;
    const { project_id, id, archived_at, tempId } = issue;
    const projectIdentifier = getProjectIdentifierById(issue?.project_id);

    const workItemLink = generateWorkItemLink({
      workspaceSlug,
      projectId: project_id,
      issueId: id,
      projectIdentifier,
      sequenceId: issue?.sequence_id,
      isEpic,
      isArchived: !!archived_at,
    });
    if (workspaceSlug && project_id && id && !getIsIssuePeeked(id) && !tempId) {
      if (isMobile) {
        router.push(workItemLink);
      } else {
        const nextPeek = {
          workspaceSlug,
          projectId: project_id,
          issueId: id,
          nestingLevel,
          isArchived: !!archived_at,
        };
        if (options?.fromSubWork && isPeekOpen) {
          navigatePeekIssue(nextPeek);
        } else {
          setPeekIssue(nextPeek);
        }
      }
    }
  };

  return { handleRedirection };
};

export default useIssuePeekOverviewRedirection;
