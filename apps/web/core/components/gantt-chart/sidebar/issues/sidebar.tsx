/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { RefObject } from "react";
import { useState } from "react";
import { observer } from "mobx-react";
// ui
import { GANTT_TIMELINE_TYPE } from "@plane/types";
import type { IBlockUpdateData } from "@plane/types";
import { Loader } from "@plane/ui";
// components
import RenderIfVisible from "@/components/core/render-if-visible-HOC";
import { useGanttHierarchy } from "@/components/issues/issue-layouts/gantt/hierarchy-context";
import { GanttLayoutListItemLoader } from "@/components/ui/loader/layouts/gantt-layout-loader";
//hooks
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { useIssuesStore } from "@/hooks/use-issue-layout-store";
import type { TSelectionHelper } from "@/hooks/use-multiple-select";
// local imports
import { useTimeLineChart } from "../../../../hooks/use-timeline-chart";
import { GanttDnDHOC } from "../gantt-dnd-HOC";
import { handleOrderChange } from "../utils";
import { IssuesSidebarBlock } from "./block";

type Props = {
  blockUpdateHandler: (block: any, payload: IBlockUpdateData) => void;
  canLoadMoreBlocks?: boolean;
  loadMoreBlocks?: () => void;
  ganttContainerRef: RefObject<HTMLDivElement>;
  blockIds: string[];
  enableReorder: boolean | ((blockId: string) => boolean);
  enableSelection: boolean;
  showAllBlocks?: boolean;
  selectionHelpers?: TSelectionHelper;
  isEpic?: boolean;
};

export const IssueGanttSidebar = observer(function IssueGanttSidebar(props: Props) {
  const {
    blockUpdateHandler,
    blockIds,
    enableReorder,
    enableSelection,
    loadMoreBlocks,
    canLoadMoreBlocks,
    ganttContainerRef,
    showAllBlocks = false,
    selectionHelpers,
    isEpic = false,
  } = props;

  const { getBlockById } = useTimeLineChart(GANTT_TIMELINE_TYPE.ISSUE);
  const hierarchy = useGanttHierarchy();

  const {
    issues: { getIssueLoader },
  } = useIssuesStore();

  const [intersectionElement, setIntersectionElement] = useState<HTMLDivElement | null>(null);

  const isPaginating = !!getIssueLoader();

  useIntersectionObserver(
    ganttContainerRef,
    isPaginating ? null : intersectionElement,
    loadMoreBlocks,
    "100% 0% 100% 0%"
  );

  const isBlockReorderEnabled = (blockId: string) =>
    typeof enableReorder === "function" ? enableReorder(blockId) : enableReorder;

  const handleOnDrop = (
    draggingBlockId: string | undefined,
    droppedBlockId: string | undefined,
    dropAtEndOfList: boolean
  ) => {
    if (!draggingBlockId || !droppedBlockId) return;

    let targetBlockId = droppedBlockId;
    let dropAtEnd = dropAtEndOfList;

    // When hierarchy is on, only reorder among same-depth siblings (keeps L3↔L3 order correct).
    let orderBlockIds = blockIds;
    if (hierarchy?.enabled) {
      const dragMeta = hierarchy.metaById[draggingBlockId];
      if (!dragMeta) return;
      orderBlockIds = blockIds.filter((id) => {
        const meta = hierarchy.metaById[id];
        return meta && meta.depth === dragMeta.depth && meta.parentId === dragMeta.parentId;
      });
      // Map drop onto a non-sibling (e.g. nested child) to the nearest sibling in the flat list.
      if (!orderBlockIds.includes(targetBlockId)) {
        const flatIndex = blockIds.indexOf(targetBlockId);
        let mapped: string | undefined;
        for (let i = flatIndex; i >= 0; i--) {
          if (orderBlockIds.includes(blockIds[i])) {
            mapped = blockIds[i];
            break;
          }
        }
        if (!mapped) return;
        targetBlockId = mapped;
        dropAtEnd = false;
      }
    }

    handleOrderChange(draggingBlockId, targetBlockId, dropAtEnd, orderBlockIds, getBlockById, blockUpdateHandler);
  };

  return (
    <div>
      {blockIds ? (
        <>
          {blockIds.map((blockId, index) => {
            const block = getBlockById(blockId);
            const isBlockVisibleOnSidebar = block?.start_date && block?.target_date;

            // hide the block if it doesn't have start and target dates and showAllBlocks is false
            if (!block || (!showAllBlocks && !isBlockVisibleOnSidebar)) return;

            return (
              <RenderIfVisible
                key={block.id}
                root={ganttContainerRef}
                horizontalOffset={100}
                verticalOffset={200}
                shouldRecordHeights={false}
                placeholderChildren={<GanttLayoutListItemLoader />}
              >
                <GanttDnDHOC
                  id={block.id}
                  isLastChild={index === blockIds.length - 1}
                  isDragEnabled={isBlockReorderEnabled(block.id)}
                  onDrop={handleOnDrop}
                >
                  {(isDragging: boolean) => (
                    <IssuesSidebarBlock
                      block={block}
                      enableSelection={enableSelection}
                      isDragging={isDragging}
                      selectionHelpers={selectionHelpers}
                      isEpic={isEpic}
                    />
                  )}
                </GanttDnDHOC>
              </RenderIfVisible>
            );
          })}
          {canLoadMoreBlocks && (
            <div ref={setIntersectionElement} className="p-2">
              <div className="flex h-10 w-full animate-pulse items-center justify-between gap-1.5 rounded-sm bg-layer-1 px-4 py-1.5 md:h-8 md:px-1" />
            </div>
          )}
        </>
      ) : (
        <Loader className="space-y-3 pr-2">
          <Loader.Item height="34px" />
          <Loader.Item height="34px" />
          <Loader.Item height="34px" />
          <Loader.Item height="34px" />
        </Loader>
      )}
    </div>
  );
});
