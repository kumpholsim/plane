/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { createContext, useContext } from "react";
import type { TGanttHierarchyMeta, TGanttHierarchyMode } from "./hierarchy";

type TGanttHierarchyContextValue = {
  enabled: boolean;
  mode: TGanttHierarchyMode;
  setMode: (mode: TGanttHierarchyMode) => void;
  metaById: Record<string, TGanttHierarchyMeta>;
  expandedIds: Set<string>;
  toggleExpanded: (id: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  allExpanded: boolean;
};

const GanttHierarchyContext = createContext<TGanttHierarchyContextValue | null>(null);

export const GanttHierarchyProvider = GanttHierarchyContext.Provider;

export const useGanttHierarchy = () => useContext(GanttHierarchyContext);
