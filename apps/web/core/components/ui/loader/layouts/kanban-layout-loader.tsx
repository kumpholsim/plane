/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { forwardRef } from "react";
import { range } from "lodash-es";
// plane ui
import { EIssuesStoreType } from "@plane/types";
import { ContentWrapper } from "@plane/ui";
// plane utils
import { cn } from "@plane/utils";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
import { useIsStagedGateScrumban } from "@/hooks/use-workflow-mode";

export const KanbanIssueBlockLoader = forwardRef(function KanbanIssueBlockLoader(
  { cardHeight, shouldAnimate = true }: { cardHeight?: number; shouldAnimate?: boolean },
  ref: React.ForwardedRef<HTMLSpanElement>
) {
  const storeType = useIssueStoreType();
  const isCompact = useIsStagedGateScrumban() && storeType === EIssuesStoreType.CYCLE;
  const resolvedHeight = cardHeight ?? (isCompact ? 80 : 100);

  return (
    <span
      ref={ref}
      className={cn(`block rounded-sm bg-[var(--illustration-fill-secondary)]`, { "animate-pulse": shouldAnimate })}
      style={{ height: `${resolvedHeight}px` }}
    />
  );
});

export function KanbanColumnLoader({
  cardsInColumn = 3,
  ignoreHeader = false,
  cardHeight = 100,
  shouldAnimate = true,
}: {
  cardsInColumn?: number;
  ignoreHeader?: boolean;
  cardHeight?: number;
  shouldAnimate?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      {!ignoreHeader && (
        <div className="flex h-9 w-80 items-center justify-between">
          <div className="item-center flex gap-3">
            <span className={cn("h-6 w-6 rounded-sm bg-layer-1", { "animate-pulse": shouldAnimate })} />
            <span className={cn("h-6 w-24 rounded-sm bg-layer-1", { "animate-pulse": shouldAnimate })} />
          </div>
        </div>
      )}
      {range(cardsInColumn).map((cardIndex) => (
        <KanbanIssueBlockLoader key={cardIndex} cardHeight={cardHeight} shouldAnimate={shouldAnimate} />
      ))}
    </div>
  );
}

KanbanIssueBlockLoader.displayName = "KanbanIssueBlockLoader";

export function KanbanLayoutLoader({ cardsInEachColumn = [2, 3, 2, 4, 3] }: { cardsInEachColumn?: number[] }) {
  const columns = cardsInEachColumn.map((cardsInColumn, columnIndex) => ({
    cardsInColumn,
    id: `column-${cardsInEachColumn.slice(0, columnIndex + 1).join("-")}`,
  }));

  return (
    <ContentWrapper className="flex-row gap-5 overflow-x-auto py-1.5">
      {columns.map(({ cardsInColumn, id }) => (
        <KanbanColumnLoader key={id} cardsInColumn={cardsInColumn} />
      ))}
    </ContentWrapper>
  );
}
