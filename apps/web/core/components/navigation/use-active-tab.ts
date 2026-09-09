/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useMemo } from "react";
import type { TIssue } from "@plane/types";
import type { TNavigationItem } from "@/components/navigation/tab-navigation-root";
import { isEpicWorkItem, isModulesTabWorkItem } from "@/components/issues/issue-detail-widgets/sub-issues/depth";

type UseActiveTabProps = {
  navigationItems: TNavigationItem[];
  pathname: string;
  workItemId?: string;
  workItem?: TIssue;
  projectId: string;
};

export const useActiveTab = ({ navigationItems, pathname, workItemId, workItem, projectId }: UseActiveTabProps) => {
  // Check if a navigation item is active
  const isActive = useCallback(
    (item: TNavigationItem) => {
      const belongsToProject = Boolean(workItemId && workItem && workItem.project_id === projectId);
      const isModulesItem = belongsToProject && isModulesTabWorkItem(workItem);
      const isEpicItem = belongsToProject && isEpicWorkItem(workItem);
      // Delivery / sub-task detail → Work items; Milestone / Epic → Modules (or Epics if present)
      const isWorkItemActive = item.key === "work_items" && belongsToProject && !isModulesItem;
      const isEpicActive = item.key === "epics" && isEpicItem;
      const isModuleActive = item.key === "modules" && isModulesItem;
      // Pathname condition - use exact match or startsWith for better accuracy
      const isPathnameActive = pathname === item.href || pathname.startsWith(item.href + "/");
      // Return
      return isWorkItemActive || isEpicActive || isModuleActive || isPathnameActive;
    },
    [pathname, workItem, workItemId, projectId]
  );

  // Find active item
  const activeItem = useMemo(() => navigationItems.find((item) => isActive(item)), [navigationItems, isActive]);

  return { isActive, activeItem };
};
