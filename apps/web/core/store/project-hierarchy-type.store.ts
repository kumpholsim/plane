/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { set, sortBy } from "lodash-es";
import { action, makeObservable, observable, runInAction } from "mobx";
import { computedFn } from "mobx-utils";
import type { IProjectHierarchyType } from "@plane/types";
import { ProjectHierarchyTypeService } from "@/services/issue";
import type { CoreRootStore } from "./root.store";

export interface IProjectHierarchyTypeStore {
  fetchedMap: Record<string, boolean>;
  typeMap: Record<string, IProjectHierarchyType>;
  getProjectTypes: (projectId: string | undefined | null, level: number | null) => IProjectHierarchyType[] | undefined;
  getActiveProjectTypes: (
    projectId: string | undefined | null,
    level: number | null
  ) => IProjectHierarchyType[] | undefined;
  getTypeById: (typeId: string) => IProjectHierarchyType | null;
  fetchProjectTypes: (workspaceSlug: string, projectId: string, level?: number) => Promise<IProjectHierarchyType[]>;
  createType: (
    workspaceSlug: string,
    projectId: string,
    data: Partial<IProjectHierarchyType>
  ) => Promise<IProjectHierarchyType>;
  updateType: (
    workspaceSlug: string,
    projectId: string,
    typeId: string,
    data: Partial<IProjectHierarchyType>
  ) => Promise<IProjectHierarchyType>;
  deleteType: (workspaceSlug: string, projectId: string, typeId: string) => Promise<void>;
  // Back-compat aliases for L4 sub-task categories
  getProjectCategories: (projectId: string | undefined | null) => IProjectHierarchyType[] | undefined;
  getActiveProjectCategories: (projectId: string | undefined | null) => IProjectHierarchyType[] | undefined;
  getCategoryById: (categoryId: string) => IProjectHierarchyType | null;
  fetchProjectCategories: (workspaceSlug: string, projectId: string) => Promise<IProjectHierarchyType[]>;
  createCategory: (
    workspaceSlug: string,
    projectId: string,
    data: Partial<IProjectHierarchyType>
  ) => Promise<IProjectHierarchyType>;
  updateCategory: (
    workspaceSlug: string,
    projectId: string,
    categoryId: string,
    data: Partial<IProjectHierarchyType>
  ) => Promise<IProjectHierarchyType>;
  deleteCategory: (workspaceSlug: string, projectId: string, categoryId: string) => Promise<void>;
  categoryMap: Record<string, IProjectHierarchyType>;
}

export class ProjectHierarchyTypeStore implements IProjectHierarchyTypeStore {
  rootStore;
  typeMap: Record<string, IProjectHierarchyType> = {};
  fetchedMap: Record<string, boolean> = {};
  service;

  constructor(_rootStore: CoreRootStore) {
    makeObservable(this, {
      typeMap: observable,
      fetchedMap: observable,
      fetchProjectTypes: action,
      createType: action,
      updateType: action,
      deleteType: action,
    });

    this.rootStore = _rootStore;
    this.service = new ProjectHierarchyTypeService();
  }

  get categoryMap() {
    return this.typeMap;
  }

  getProjectTypes = computedFn(
    (projectId: string | undefined | null, level: number | null): IProjectHierarchyType[] | undefined => {
      if (!projectId) return undefined;
      if (!this.fetchedMap[projectId]) return undefined;
      let types = Object.values(this.typeMap).filter((t) => t.project_id === projectId);
      if (level != null) types = types.filter((t) => t.level === level);
      return sortBy(types, ["level", "sort_order"]);
    }
  );

  getActiveProjectTypes = computedFn(
    (projectId: string | undefined | null, level: number | null): IProjectHierarchyType[] | undefined => {
      const types = this.getProjectTypes(projectId, level);
      if (!types) return undefined;
      return types.filter((t) => t.is_active);
    }
  );

  getTypeById = computedFn((typeId: string): IProjectHierarchyType | null => {
    if (!typeId) return null;
    return this.typeMap?.[typeId] || this.typeMap?.[String(typeId)] || null;
  });

  fetchProjectTypes = async (workspaceSlug: string, projectId: string, level?: number) => {
    const response = await this.service.getProjectTypes(workspaceSlug, projectId, level);
    runInAction(() => {
      response.forEach((item) => {
        set(this.typeMap, item.id, item);
      });
      set(this.fetchedMap, projectId, true);
    });
    return response;
  };

  createType = async (workspaceSlug: string, projectId: string, data: Partial<IProjectHierarchyType>) => {
    const response = await this.service.createType(workspaceSlug, projectId, data);
    runInAction(() => {
      set(this.typeMap, response.id, response);
    });
    return response;
  };

  updateType = async (
    workspaceSlug: string,
    projectId: string,
    typeId: string,
    data: Partial<IProjectHierarchyType>
  ) => {
    const response = await this.service.patchType(workspaceSlug, projectId, typeId, data);
    runInAction(() => {
      set(this.typeMap, typeId, { ...this.typeMap[typeId], ...response });
    });
    return response;
  };

  deleteType = async (workspaceSlug: string, projectId: string, typeId: string) => {
    await this.service.deleteType(workspaceSlug, projectId, typeId);
    runInAction(() => {
      delete this.typeMap[typeId];
    });
  };

  // L4 back-compat
  getProjectCategories = (projectId: string | undefined | null) => this.getProjectTypes(projectId, 4);
  getActiveProjectCategories = (projectId: string | undefined | null) => this.getActiveProjectTypes(projectId, 4);
  getCategoryById = (categoryId: string) => this.getTypeById(categoryId);
  fetchProjectCategories = (workspaceSlug: string, projectId: string) =>
    this.fetchProjectTypes(workspaceSlug, projectId);
  createCategory = (workspaceSlug: string, projectId: string, data: Partial<IProjectHierarchyType>) =>
    this.createType(workspaceSlug, projectId, { ...data, level: 4 });
  updateCategory = (
    workspaceSlug: string,
    projectId: string,
    categoryId: string,
    data: Partial<IProjectHierarchyType>
  ) => this.updateType(workspaceSlug, projectId, categoryId, data);
  deleteCategory = (workspaceSlug: string, projectId: string, categoryId: string) =>
    this.deleteType(workspaceSlug, projectId, categoryId);
}

/** @deprecated */
export type ISubWorkItemCategoryStore = IProjectHierarchyTypeStore;
export const SubWorkItemCategoryStore = ProjectHierarchyTypeStore;
