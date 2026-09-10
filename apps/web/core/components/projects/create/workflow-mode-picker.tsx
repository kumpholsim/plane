/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { PROJECT_WORKFLOW_MODE } from "@plane/constants";
import type { TProjectWorkflowMode } from "@plane/types";
import { cn } from "@plane/utils";

type Props = {
  value: TProjectWorkflowMode;
  onChange: (mode: TProjectWorkflowMode) => void;
};

const OPTIONS: {
  mode: TProjectWorkflowMode;
  title: string;
}[] = [
  {
    mode: PROJECT_WORKFLOW_MODE.SCRUM,
    title: "Scrum",
  },
  {
    mode: PROJECT_WORKFLOW_MODE.STAGED_GATE_SCRUMBAN,
    title: "Staged-gate Scrumban",
  },
];

export function ProjectWorkflowModePicker(props: Props) {
  const { value, onChange } = props;

  return (
    <div className="space-y-2">
      <p className="text-13 font-medium text-primary">Workflow</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {OPTIONS.map((option) => {
          const selected = value === option.mode;
          return (
            <button
              key={option.mode}
              type="button"
              onClick={() => onChange(option.mode)}
              className={cn(
                "rounded-lg border px-3 py-3 text-left transition-colors",
                selected
                  ? "border-accent-strong bg-accent-primary/10"
                  : "border-subtle bg-surface-1 hover:border-strong"
              )}
            >
              <p className="text-13 font-medium text-primary">{option.title}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
