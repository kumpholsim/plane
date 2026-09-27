/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { isStagedGateScrumbanMode } from "@plane/constants";
import { HIERARCHY_LEVEL_SHORT_LABELS, HIERARCHY_LEVEL_SUB_TASK } from "@plane/types";
import type { TIssue } from "@plane/types";
import { LockIcon } from "@plane/propel/icons";
import { Tooltip } from "@plane/ui";
import { cn } from "@plane/utils";
import { useProject } from "@/hooks/store/use-project";
import { useProjectHierarchyType } from "@/hooks/store/use-project-hierarchy-type";

const mixColorChannel = (channel: number) => Math.round(channel + (255 - channel) * 0.5);

/** Dilute L4 (sub-task) badge colors 50% toward white — keeps hue, softer fill (menu dots / legacy). */
export const diluteHierarchyBadgeColor = (hex: string, level: number): string => {
  if (level !== HIERARCHY_LEVEL_SUB_TASK) return hex;
  const raw = hex.startsWith("#") ? hex : `#${hex}`;
  const normalized = raw.length === 4 ? `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}` : raw.slice(0, 7);
  if (!/^#[0-9A-Fa-f]{6}$/.test(normalized)) return hex;
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  const toHex = (channel: number) => mixColorChannel(channel).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

/** Three thick horizontal bars in type color — quiet L4 Design/Dev/QA accent. */
export function HierarchyTypeLines(props: { color: string; className?: string }) {
  const { color, className } = props;
  return (
    <span
      className={cn("inline-flex h-3.5 w-3 flex-shrink-0 flex-col items-stretch justify-center gap-[3px]", className)}
      aria-hidden
    >
      <span className="h-[2.5px] w-full rounded-full" style={{ backgroundColor: color }} />
      <span className="h-[2.5px] w-full rounded-full" style={{ backgroundColor: color }} />
      <span className="h-[2.5px] w-full rounded-full" style={{ backgroundColor: color }} />
    </span>
  );
}

type Props = {
  issue: Pick<
    TIssue,
    | "id"
    | "project_id"
    | "parent_id"
    | "hierarchy_type_id"
    | "sub_work_item_category_id"
    | "hierarchy_level"
    | "sub_issues_count"
  >;
  disabled?: boolean;
  className?: string;
  updateIssue?: ((projectId: string | null, issueId: string, data: Partial<TIssue>) => Promise<void>) | undefined;
};

export const HierarchyTypeBadge = observer(function HierarchyTypeBadge(props: Props) {
  const { issue, className } = props;
  const { workspaceSlug } = useParams();
  const { getProjectById } = useProject();
  const { getTypeById, fetchProjectTypes, fetchedMap } = useProjectHierarchyType();

  const projectId = issue.project_id;
  const isScrumban = isStagedGateScrumbanMode(projectId ? getProjectById(projectId)?.workflow_mode : undefined);

  const typeId = issue.hierarchy_type_id ?? issue.sub_work_item_category_id ?? null;
  const hierarchyType = typeId ? getTypeById(typeId) : null;
  const currentLevel = (hierarchyType?.level ?? issue.hierarchy_level ?? 3) as 1 | 2 | 3 | 4;
  const name = hierarchyType?.name ?? HIERARCHY_LEVEL_SHORT_LABELS[currentLevel] ?? "Work item";
  const isSubTaskLevel = currentLevel === HIERARCHY_LEVEL_SUB_TASK;
  const rawTypeColor = hierarchyType?.color || "#6B7280";
  const color = diluteHierarchyBadgeColor(rawTypeColor, currentLevel);

  useEffect(() => {
    if (!isScrumban || !workspaceSlug || !projectId || fetchedMap[projectId]) return;
    void fetchProjectTypes(workspaceSlug.toString(), projectId);
  }, [isScrumban, workspaceSlug, projectId, fetchedMap, fetchProjectTypes]);

  // Classic Scrum has no hierarchy type chips (Milestone / Epic / Story / …)
  if (!isScrumban) return null;

  return (
    <Tooltip tooltipContent={`${name} · locked`} position="top">
      <span className="relative inline-flex items-center self-center">
        <span
          className={cn(
            "inline-flex flex-shrink-0 items-center truncate rounded-sm text-11 font-medium",
            isSubTaskLevel
              ? "h-3.5 w-auto justify-center bg-transparent px-0 text-primary"
              : "h-5 w-20 justify-center px-1.5 text-white",
            "cursor-default opacity-90",
            className
          )}
          style={isSubTaskLevel ? undefined : { backgroundColor: color }}
          aria-label={`${name} (locked)`}
          title={`${name} (locked)`}
        >
          {isSubTaskLevel ? (
            <HierarchyTypeLines color={rawTypeColor} />
          ) : (
            <span className="w-full truncate text-center">{name}</span>
          )}
        </span>
        <span
          className="shadow-sm absolute -right-0.5 -bottom-0.5 flex size-2.5 items-center justify-center rounded-full bg-surface-1 text-tertiary"
          aria-hidden
        >
          <LockIcon className="size-2" />
        </span>
      </span>
    </Tooltip>
  );
});
