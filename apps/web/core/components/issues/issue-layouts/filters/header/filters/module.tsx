/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useEffect, useMemo, useState } from "react";
import { sortBy } from "lodash-es";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// components
import { ModuleIcon } from "@plane/propel/icons";
import type { TIssue, TIssuesResponse } from "@plane/types";
import { Loader } from "@plane/ui";
import { FilterHeader, FilterOption } from "@/components/issues/issue-layouts/filters";
import { store } from "@/lib/store-context";
import { IssueService } from "@/services/issue";

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

type Props = {
  appliedFilters: string[] | null;
  handleUpdate: (val: string) => void;
  searchQuery: string;
};

export const FilterModule = observer(function FilterModule(props: Props) {
  const { appliedFilters, handleUpdate, searchQuery } = props;
  const { workspaceSlug, projectId } = useParams();
  const [itemsToRender, setItemsToRender] = useState(5);
  const [previewEnabled, setPreviewEnabled] = useState(true);
  const [epics, setEpics] = useState<TIssue[] | null>(null);

  useEffect(() => {
    if (!workspaceSlug || !projectId) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await issueService.getIssues(workspaceSlug.toString(), projectId.toString(), {
          hierarchy_level: "2",
          sub_issue: true,
          per_page: 100,
        });
        const issues = normalizeIssueList(response as TIssuesResponse);
        if (cancelled) return;
        store.issue.issues.addIssue(issues);
        setEpics(issues);
      } catch {
        if (!cancelled) setEpics([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId]);

  const appliedFiltersCount = appliedFilters?.length ?? 0;

  const sortedOptions = useMemo(() => {
    const filteredOptions = (epics || []).filter((epic) => epic.name.toLowerCase().includes(searchQuery.toLowerCase()));

    return sortBy(filteredOptions, [(epic) => !appliedFilters?.includes(epic.id), (epic) => epic.name.toLowerCase()]);
  }, [searchQuery, epics, appliedFilters]);

  const handleViewToggle = () => {
    if (!sortedOptions) return;

    if (itemsToRender === sortedOptions.length) setItemsToRender(5);
    else setItemsToRender(sortedOptions.length);
  };

  return (
    <>
      <FilterHeader
        title={`Epic ${appliedFiltersCount > 0 ? ` (${appliedFiltersCount})` : ""}`}
        isPreviewEnabled={previewEnabled}
        handleIsPreviewEnabled={() => setPreviewEnabled(!previewEnabled)}
      />
      {previewEnabled && (
        <div>
          {epics ? (
            sortedOptions.length > 0 ? (
              <>
                {sortedOptions.slice(0, itemsToRender).map((epic) => (
                  <FilterOption
                    key={epic.id}
                    isChecked={appliedFilters?.includes(epic.id)}
                    onClick={() => handleUpdate(epic.id)}
                    icon={<ModuleIcon className="h-3 w-3 flex-shrink-0" />}
                    title={epic.name}
                  />
                ))}
                {sortedOptions.length > 5 && (
                  <button
                    type="button"
                    className="ml-8 text-11 font-medium text-accent-primary"
                    onClick={handleViewToggle}
                  >
                    {itemsToRender === sortedOptions.length ? "View less" : "View all"}
                  </button>
                )}
              </>
            ) : (
              <p className="text-xs text-placeholder italic">No matches found</p>
            )
          ) : (
            <Loader className="space-y-2">
              <Loader.Item height="20px" />
              <Loader.Item height="20px" />
              <Loader.Item height="20px" />
            </Loader>
          )}
        </div>
      )}
    </>
  );
});
