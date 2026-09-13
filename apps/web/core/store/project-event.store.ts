/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { set } from "lodash-es";
import { action, makeObservable, observable, runInAction } from "mobx";
import { computedFn } from "mobx-utils";
import type { TLoader, TProjectEvent, TProjectEventForm } from "@plane/types";
import { ProjectEventService } from "@/services/project-event.service";

export interface IProjectEventStore {
  loader: TLoader;
  eventsMap: Record<string, TProjectEvent>;
  fetchEvents: (workspaceSlug: string, projectId: string, start: string, end: string) => Promise<TProjectEvent[]>;
  createEvent: (workspaceSlug: string, projectId: string, payload: TProjectEventForm) => Promise<TProjectEvent>;
  updateEvent: (
    workspaceSlug: string,
    projectId: string,
    eventId: string,
    payload: Partial<TProjectEventForm>
  ) => Promise<TProjectEvent>;
  deleteEvent: (workspaceSlug: string, projectId: string, eventId: string) => Promise<void>;
  getEventById: (eventId: string) => TProjectEvent | undefined;
  getEventsForDate: (dateKey: string) => TProjectEvent[];
  getEventsOverlappingRange: (startKey: string, endKey: string) => TProjectEvent[];
}

const toDateKey = (iso: string) => iso.slice(0, 10);

export class ProjectEventStore implements IProjectEventStore {
  loader: TLoader = undefined;
  eventsMap: Record<string, TProjectEvent> = {};
  private service = new ProjectEventService();

  constructor() {
    makeObservable(this, {
      loader: observable,
      eventsMap: observable,
      fetchEvents: action,
      createEvent: action,
      updateEvent: action,
      deleteEvent: action,
    });
  }

  getEventById = computedFn((eventId: string) => this.eventsMap[eventId]);

  getEventsForDate = computedFn((dateKey: string) =>
    Object.values(this.eventsMap)
      .filter((event) => {
        const start = toDateKey(event.start_at);
        const end = toDateKey(event.end_at);
        return start <= dateKey && end >= dateKey;
      })
      .sort((a, b) => a.start_at.localeCompare(b.start_at) || a.name.localeCompare(b.name))
  );

  getEventsOverlappingRange = computedFn((startKey: string, endKey: string) =>
    Object.values(this.eventsMap).filter((event) => {
      const start = toDateKey(event.start_at);
      const end = toDateKey(event.end_at);
      return start <= endKey && end >= startKey;
    })
  );

  fetchEvents = async (workspaceSlug: string, projectId: string, start: string, end: string) => {
    this.loader = "init-loader";
    try {
      const results = await this.service.list(workspaceSlug, projectId, { start, end });
      const list = Array.isArray(results) ? results : ((results as { results?: TProjectEvent[] })?.results ?? []);
      runInAction(() => {
        for (const event of list) {
          set(this.eventsMap, event.id, event);
        }
        this.loader = undefined;
      });
      return list;
    } catch (error) {
      runInAction(() => {
        this.loader = undefined;
      });
      throw error;
    }
  };

  createEvent = async (workspaceSlug: string, projectId: string, payload: TProjectEventForm) => {
    const event = await this.service.create(workspaceSlug, projectId, payload);
    runInAction(() => {
      set(this.eventsMap, event.id, event);
    });
    return event;
  };

  updateEvent = async (
    workspaceSlug: string,
    projectId: string,
    eventId: string,
    payload: Partial<TProjectEventForm>
  ) => {
    const event = await this.service.update(workspaceSlug, projectId, eventId, payload);
    runInAction(() => {
      set(this.eventsMap, event.id, event);
    });
    return event;
  };

  deleteEvent = async (workspaceSlug: string, projectId: string, eventId: string) => {
    await this.service.destroy(workspaceSlug, projectId, eventId);
    runInAction(() => {
      delete this.eventsMap[eventId];
    });
  };
}
