/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import type { IProjectHierarchyType } from "@plane/types";
import { APIService } from "@/services/api.service";

export class ProjectHierarchyTypeService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  private base(workspaceSlug: string, projectId: string) {
    return `/api/workspaces/${workspaceSlug}/projects/${projectId}/hierarchy-types/`;
  }

  async getProjectTypes(workspaceSlug: string, projectId: string, level?: number): Promise<IProjectHierarchyType[]> {
    const params = level != null ? { level } : undefined;
    return this.get(this.base(workspaceSlug, projectId), { params })
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async createType(
    workspaceSlug: string,
    projectId: string,
    data: Partial<IProjectHierarchyType>
  ): Promise<IProjectHierarchyType> {
    return this.post(this.base(workspaceSlug, projectId), data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async patchType(
    workspaceSlug: string,
    projectId: string,
    typeId: string,
    data: Partial<IProjectHierarchyType>
  ): Promise<IProjectHierarchyType> {
    return this.patch(`${this.base(workspaceSlug, projectId)}${typeId}/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async deleteType(workspaceSlug: string, projectId: string, typeId: string): Promise<void> {
    return this.delete(`${this.base(workspaceSlug, projectId)}${typeId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}

/** @deprecated */
export class SubWorkItemCategoryService extends ProjectHierarchyTypeService {
  async getProjectCategories(workspaceSlug: string, projectId: string) {
    return this.getProjectTypes(workspaceSlug, projectId, 4);
  }
  async createCategory(workspaceSlug: string, projectId: string, data: Partial<IProjectHierarchyType>) {
    return this.createType(workspaceSlug, projectId, { ...data, level: 4 });
  }
  async patchCategory(
    workspaceSlug: string,
    projectId: string,
    categoryId: string,
    data: Partial<IProjectHierarchyType>
  ) {
    return this.patchType(workspaceSlug, projectId, categoryId, data);
  }
  async deleteCategory(workspaceSlug: string, projectId: string, categoryId: string) {
    return this.deleteType(workspaceSlug, projectId, categoryId);
  }
}
