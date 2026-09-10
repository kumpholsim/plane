/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useMemo, useState } from "react";
import { sortBy } from "lodash-es";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// components
import { ModuleIcon } from "@plane/propel/icons";
import { Loader } from "@plane/ui";
import { FilterHeader, FilterOption } from "@/components/issues/issue-layouts/filters";
import { useModule } from "@/hooks/store/use-module";

type Option = { id: string; name: string };

type Props = {
  appliedFilters: string[] | null;
  handleUpdate: (val: string) => void;
  searchQuery: string;
};

export const FilterModule = observer(function FilterModule(props: Props) {
  const { appliedFilters, handleUpdate, searchQuery } = props;
  const { projectId } = useParams();
  const { getModuleById, getProjectModuleIds } = useModule();
  const [itemsToRender, setItemsToRender] = useState(5);
  const [previewEnabled, setPreviewEnabled] = useState(true);

  const moduleIds = projectId ? getProjectModuleIds(projectId.toString()) : undefined;
  const options: Option[] | null = moduleIds?.map((moduleId) => getModuleById(moduleId)!) ?? null;
  const appliedFiltersCount = appliedFilters?.length ?? 0;

  const sortedOptions = useMemo(() => {
    const filteredOptions = (options || []).filter((option) =>
      option.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return sortBy(filteredOptions, [
      (option) => !appliedFilters?.includes(option.id),
      (option) => option.name.toLowerCase(),
    ]);
  }, [searchQuery, options, appliedFilters]);

  const handleViewToggle = () => {
    if (!sortedOptions) return;

    if (itemsToRender === sortedOptions.length) setItemsToRender(5);
    else setItemsToRender(sortedOptions.length);
  };

  return (
    <>
      <FilterHeader
        title={`Module ${appliedFiltersCount > 0 ? ` (${appliedFiltersCount})` : ""}`}
        isPreviewEnabled={previewEnabled}
        handleIsPreviewEnabled={() => setPreviewEnabled(!previewEnabled)}
      />
      {previewEnabled && (
        <div>
          {options ? (
            sortedOptions.length > 0 ? (
              <>
                {sortedOptions.slice(0, itemsToRender).map((option) => (
                  <FilterOption
                    key={option.id}
                    isChecked={appliedFilters?.includes(option.id) ?? false}
                    onClick={() => handleUpdate(option.id)}
                    icon={<ModuleIcon className="h-3 w-3 flex-shrink-0" />}
                    title={option.name}
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
              <p className="text-11 text-placeholder italic">No matches found</p>
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
