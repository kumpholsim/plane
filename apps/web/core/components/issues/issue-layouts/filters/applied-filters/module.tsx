/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// hooks
import { CloseIcon, ModuleIcon } from "@plane/propel/icons";
import { useIssues } from "@/hooks/store/use-issues";

type Props = {
  handleRemove: (val: string) => void;
  values: string[];
  editable: boolean | undefined;
};

export const AppliedModuleFilters = observer(function AppliedModuleFilters(props: Props) {
  const { handleRemove, values, editable } = props;
  const { issueMap } = useIssues();

  return (
    <>
      {values.map((epicId) => {
        const epicDetails = issueMap[epicId] ?? null;

        if (!epicDetails) return null;

        return (
          <div key={epicId} className="flex items-center gap-1 truncate rounded-sm bg-layer-1 p-1 text-11">
            <ModuleIcon className="h-3 w-3 flex-shrink-0" />
            <span className="truncate normal-case">{epicDetails.name}</span>
            {editable && (
              <button
                type="button"
                className="grid place-items-center text-tertiary hover:text-secondary"
                onClick={() => handleRemove(epicId)}
              >
                <CloseIcon height={10} width={10} strokeWidth={2} />
              </button>
            )}
          </div>
        );
      })}
    </>
  );
});
