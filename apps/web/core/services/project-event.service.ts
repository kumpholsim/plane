/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import type { TProjectEvent, TProjectEventForm } from "@plane/types";
import { APIService } from "@/services/api.service";

export class ProjectEventService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  private base(workspaceSlug: string, projectId: string) {
    return `/api/workspaces/${workspaceSlug}/projects/${projectId}/calendar-events/`;
  }

  async list(
    workspaceSlug: string,
    projectId: string,
    params?: { start?: string; end?: string }
  ): Promise<TProjectEvent[]> {
    return this.get(this.base(workspaceSlug, projectId), { params })
      .then((res) => res?.data)
      .catch((err) => {
        throw err?.response?.data;
      });
  }

  async create(workspaceSlug: string, projectId: string, payload: TProjectEventForm): Promise<TProjectEvent> {
    return this.post(this.base(workspaceSlug, projectId), payload)
      .then((res) => res?.data)
      .catch((err) => {
        throw err?.response?.data;
      });
  }

  async update(
    workspaceSlug: string,
    projectId: string,
    eventId: string,
    payload: Partial<TProjectEventForm>
  ): Promise<TProjectEvent> {
    return this.patch(`${this.base(workspaceSlug, projectId)}${eventId}/`, payload)
      .then((res) => res?.data)
      .catch((err) => {
        throw err?.response?.data;
      });
  }

  async destroy(workspaceSlug: string, projectId: string, eventId: string): Promise<void> {
    return this.delete(`${this.base(workspaceSlug, projectId)}${eventId}/`)
      .then((res) => res?.data)
      .catch((err) => {
        throw err?.response?.data;
      });
  }
}
