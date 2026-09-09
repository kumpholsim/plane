/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TIssue, TIssuesResponse } from "@plane/types";
import { store } from "@/lib/store-context";
import { IssueService } from "@/services/issue";
import { useProjectEstimates } from "./store/estimates";
import { useCycle } from "./store/use-cycle";
import { useLabel } from "./store/use-label";
import { useMember } from "./store/use-member";
import { useProjectHierarchyType } from "./store/use-project-hierarchy-type";
import { useProjectState } from "./store/use-project-state";

const issueService = new IssueService();

const normalizeIssueList = (response: TIssuesResponse | undefined): TIssue[] => {
  const results = response?.results;
  if (!results) return [];
  if (Array.isArray(results)) return results;
  const list: TIssue[] = [];
  for (const groupId in results) {
    const group = results[groupId];
    if (Array.isArray(group?.results)) list.push(...group.results);
    else if (Array.isArray(group)) list.push(...(group as TIssue[]));
  }
  return list;
};

export const useProjectIssueProperties = () => {
  const { fetchProjectStates } = useProjectState();
  const {
    project: { fetchProjectMembers },
  } = useMember();
  const { fetchProjectLabels } = useLabel();
  const { fetchAllCycles: fetchProjectAllCycles } = useCycle();
  const { getProjectEstimates } = useProjectEstimates();
  const { fetchProjectTypes, fetchedMap } = useProjectHierarchyType();

  // fetching project states
  const fetchStates = async (
    workspaceSlug: string | string[] | undefined,
    projectId: string | string[] | undefined
  ) => {
    if (workspaceSlug && projectId) {
      await fetchProjectStates(workspaceSlug.toString(), projectId.toString());
    }
  };
  // fetching project members
  const fetchMembers = async (
    workspaceSlug: string | string[] | undefined,
    projectId: string | string[] | undefined
  ) => {
    if (workspaceSlug && projectId) {
      await fetchProjectMembers(workspaceSlug.toString(), projectId.toString());
    }
  };

  // fetching project labels
  const fetchLabels = async (
    workspaceSlug: string | string[] | undefined,
    projectId: string | string[] | undefined
  ) => {
    if (workspaceSlug && projectId) {
      await fetchProjectLabels(workspaceSlug.toString(), projectId.toString());
    }
  };
  // fetching project cycles
  const fetchCycles = async (
    workspaceSlug: string | string[] | undefined,
    projectId: string | string[] | undefined
  ) => {
    if (workspaceSlug && projectId) {
      await fetchProjectAllCycles(workspaceSlug.toString(), projectId.toString());
    }
  };
  // fetching project epics (L2) into the shared issues map for filters / group-by
  const fetchModules = async (
    workspaceSlug: string | string[] | undefined,
    projectId: string | string[] | undefined
  ) => {
    if (workspaceSlug && projectId) {
      try {
        const response = await issueService.getIssues(workspaceSlug.toString(), projectId.toString(), {
          hierarchy_level: "2",
          sub_issue: true,
          per_page: 100,
        });
        store.issue.issues.addIssue(normalizeIssueList(response as TIssuesResponse));
      } catch {
        // ignore — filters will show empty epic options
      }
    }
  };
  // fetching project estimates
  const fetchEstimates = async (
    workspaceSlug: string | string[] | undefined,
    projectId: string | string[] | undefined
  ) => {
    if (workspaceSlug && projectId) {
      await getProjectEstimates(workspaceSlug.toString(), projectId.toString());
    }
  };

  const fetchHierarchyTypes = async (
    workspaceSlug: string | string[] | undefined,
    projectId: string | string[] | undefined
  ) => {
    if (workspaceSlug && projectId && !fetchedMap[projectId.toString()]) {
      await fetchProjectTypes(workspaceSlug.toString(), projectId.toString());
    }
  };

  const fetchAll = async (workspaceSlug: string | string[] | undefined, projectId: string | string[] | undefined) => {
    if (workspaceSlug && projectId) {
      await fetchStates(workspaceSlug, projectId);
      await fetchMembers(workspaceSlug, projectId);
      await fetchLabels(workspaceSlug, projectId);
      await fetchCycles(workspaceSlug, projectId);
      await fetchModules(workspaceSlug, projectId);
      await fetchEstimates(workspaceSlug, projectId);
      await fetchHierarchyTypes(workspaceSlug, projectId);
    }
  };

  return {
    fetchAll,
    fetchStates,
    fetchMembers,
    fetchLabels,
    fetchCycles,
    fetchModules,
    fetchEstimates,
    fetchHierarchyTypes,
  };
};
