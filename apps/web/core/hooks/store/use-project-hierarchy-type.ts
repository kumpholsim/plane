/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useContext } from "react";
import { StoreContext } from "@/lib/store-context";
import type { IProjectHierarchyTypeStore } from "@/store/project-hierarchy-type.store";

export const useProjectHierarchyType = (): IProjectHierarchyTypeStore => {
  const context = useContext(StoreContext);
  if (context === undefined) throw new Error("useProjectHierarchyType must be used within StoreProvider");
  return context.projectHierarchyType;
};

/** @deprecated Use useProjectHierarchyType */
export const useSubWorkItemCategory = useProjectHierarchyType;
