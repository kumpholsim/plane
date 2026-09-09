/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { ChevronsUpDown, FoldVertical, UnfoldVertical } from "lucide-react";
import { IconButton } from "@plane/propel/icon-button";
import { Tooltip } from "@plane/propel/tooltip";
import { useIssueExpandCollapse } from "./context";

type Props = {
  isEpic?: boolean;
};

const NEXT_ACTION_UI = {
  collapse: {
    icon: FoldVertical,
    tooltip: "Collapse all",
  },
  expand: {
    icon: UnfoldVertical,
    tooltip: "Expand all",
  },
  "expand-l3": {
    icon: UnfoldVertical,
    tooltip: "Show work items under epics",
  },
  "expand-l4": {
    icon: ChevronsUpDown,
    tooltip: "Show sub-tasks under work items",
  },
} as const;

export const GroupExpandCollapseControls = observer(function GroupExpandCollapseControls(_props: Props) {
  const { cycle, isAvailable, nextAction } = useIssueExpandCollapse();

  if (!isAvailable) return null;

  const { icon: Icon, tooltip } = NEXT_ACTION_UI[nextAction];

  return (
    <Tooltip tooltipContent={tooltip} position="bottom">
      <IconButton size="lg" variant="secondary" icon={Icon} onClick={cycle} />
    </Tooltip>
  );
});
