/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { ChevronsUpDown, Expand, FoldVertical, Shrink, UnfoldVertical } from "lucide-react";
import { IconButton } from "@plane/propel/icon-button";
import { Tooltip } from "@plane/propel/tooltip";
import { EIssueLayoutTypes } from "@plane/types";
import { useIssues } from "@/hooks/store/use-issues";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
import { useBoardFullscreen } from "../kanban/board-fullscreen-context";
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
  const storeType = useIssueStoreType();
  const { issuesFilter } = useIssues(storeType);
  const boardFullscreen = useBoardFullscreen();
  const layout = issuesFilter?.issueFilters?.displayFilters?.layout;
  const showBoardFullscreen = layout === EIssueLayoutTypes.KANBAN && !!boardFullscreen;

  if (!isAvailable && !showBoardFullscreen) return null;

  return (
    <div className="flex items-center gap-1">
      {isAvailable && (
        <Tooltip tooltipContent={NEXT_ACTION_UI[nextAction].tooltip} position="bottom">
          <IconButton size="lg" variant="secondary" icon={NEXT_ACTION_UI[nextAction].icon} onClick={cycle} />
        </Tooltip>
      )}
      {showBoardFullscreen && (
        <Tooltip
          tooltipContent={boardFullscreen.fullScreenMode ? "Exit full screen" : "Full screen board"}
          position="bottom"
        >
          <IconButton
            size="lg"
            variant="secondary"
            icon={boardFullscreen.fullScreenMode ? Shrink : Expand}
            onClick={boardFullscreen.toggleFullScreenMode}
          />
        </Tooltip>
      )}
    </div>
  );
});
