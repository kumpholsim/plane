/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import type { TIssue } from "@plane/types";
import { formatL3EstimateRollup } from "@/components/issues/hierarchy-status";

type Props = {
  issue: TIssue;
};

/** Read-only Design / Dev / QA story-point sums for Scrumban L3. */
export const L3TotalSPValue = observer(function L3TotalSPValue(props: Props) {
  const { issue } = props;

  return (
    <div className="flex h-7.5 w-full grow items-center truncate text-left" title="Design · Dev · QA story points">
      <span className="truncate px-2 text-body-xs-regular text-placeholder">
        {formatL3EstimateRollup(issue.design_estimate_points)}
        {" · "}
        {formatL3EstimateRollup(issue.dev_estimate_points)}
        {" · "}
        {formatL3EstimateRollup(issue.qa_estimate_points)}
      </span>
    </div>
  );
});
