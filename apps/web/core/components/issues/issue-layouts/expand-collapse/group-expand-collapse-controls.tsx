/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { ChevronsUpDown, Expand, FoldVertical, LayoutGrid, Rows3, Shrink, UnfoldVertical } from "lucide-react";
import { EIssueFilterType } from "@plane/constants";
import { IconButton } from "@plane/propel/icon-button";
import { Tooltip } from "@plane/propel/tooltip";
import { EIssueLayoutTypes } from "@plane/types";
import { useIssues } from "@/hooks/store/use-issues";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
import { useIssuesActions } from "@/hooks/use-issues-actions";
import { useIsStagedGateScrumban } from "@/hooks/use-workflow-mode";
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
  const { updateFilters } = useIssuesActions(storeType);
  const { projectId } = useParams();
  const isStagedGateScrumban = useIsStagedGateScrumban();
  const boardFullscreen = useBoardFullscreen();
  const layout = issuesFilter?.issueFilters?.displayFilters?.layout;
  const showBoardFullscreen = layout === EIssueLayoutTypes.KANBAN && !!boardFullscreen;
  const showBoardViewToggle = layout === EIssueLayoutTypes.KANBAN && isStagedGateScrumban && !!projectId;
  const isStoryBoardView = issuesFilter?.issueFilters?.displayFilters?.board_view === "story";

  const toggleBoardView = () => {
    if (!projectId) return;
    void updateFilters(projectId.toString(), EIssueFilterType.DISPLAY_FILTERS, {
      board_view: isStoryBoardView ? "swimlane" : "story",
    });
  };

  if (!isAvailable && !showBoardFullscreen && !showBoardViewToggle) return null;

  return (
    <div className="flex items-center gap-1">
      {showBoardViewToggle && (
        <Tooltip tooltipContent={isStoryBoardView ? "Swimlane view" : "Story view"} position="bottom">
          <IconButton
            size="lg"
            variant="secondary"
            icon={isStoryBoardView ? Rows3 : LayoutGrid}
            onClick={toggleBoardView}
          />
        </Tooltip>
      )}
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
