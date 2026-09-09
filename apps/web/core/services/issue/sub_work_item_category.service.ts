/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import type { ISubWorkItemCategory } from "@plane/types";
// services
import { APIService } from "@/services/api.service";

export class SubWorkItemCategoryService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async getProjectCategories(workspaceSlug: string, projectId: string): Promise<ISubWorkItemCategory[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/sub-work-item-categories/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async createCategory(
    workspaceSlug: string,
    projectId: string,
    data: Partial<ISubWorkItemCategory>
  ): Promise<ISubWorkItemCategory> {
    return this.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/sub-work-item-categories/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async patchCategory(
    workspaceSlug: string,
    projectId: string,
    categoryId: string,
    data: Partial<ISubWorkItemCategory>
  ): Promise<ISubWorkItemCategory> {
    return this.patch(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/sub-work-item-categories/${categoryId}/`,
      data
    )
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async deleteCategory(workspaceSlug: string, projectId: string, categoryId: string): Promise<void> {
    return this.delete(`/api/workspaces/${workspaceSlug}/projects/${projectId}/sub-work-item-categories/${categoryId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
