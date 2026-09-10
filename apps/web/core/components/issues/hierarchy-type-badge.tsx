/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useMemo } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { isStagedGateScrumbanMode } from "@plane/constants";
import {
  HIERARCHY_LEVEL_LABELS,
  HIERARCHY_LEVEL_MILESTONE,
  HIERARCHY_LEVEL_SHORT_LABELS,
  HIERARCHY_LEVEL_SUB_TASK,
} from "@plane/types";
import type { IProjectHierarchyType, TIssue } from "@plane/types";
import { CheckIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { CustomMenu, Tooltip } from "@plane/ui";
import { cn } from "@plane/utils";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useIssues } from "@/hooks/store/use-issues";
import { useProject } from "@/hooks/store/use-project";
import { useProjectHierarchyType } from "@/hooks/store/use-project-hierarchy-type";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";

const mixColorChannel = (channel: number) => Math.round(channel + (255 - channel) * 0.5);

/** Dilute L4 (sub-task) badge colors 50% toward white — keeps hue, softer fill */
const diluteHierarchyBadgeColor = (hex: string, level: number): string => {
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
  const { issue, disabled = false, className, updateIssue: updateIssueProp } = props;
  const { workspaceSlug } = useParams();
  const storeType = useIssueStoreType();
  const {
    issues: { updateIssue: storeUpdateIssue },
  } = useIssues(storeType);
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  const { getProjectById } = useProject();
  const { getTypeById, getActiveProjectTypes, fetchProjectTypes, fetchedMap } = useProjectHierarchyType();

  const projectId = issue.project_id;
  const isScrumban = isStagedGateScrumbanMode(projectId ? getProjectById(projectId)?.workflow_mode : undefined);

  const typeId = issue.hierarchy_type_id ?? issue.sub_work_item_category_id ?? null;
  const hierarchyType = typeId ? getTypeById(typeId) : null;
  const currentLevel = (hierarchyType?.level ?? issue.hierarchy_level ?? 3) as 1 | 2 | 3 | 4;
  const name = hierarchyType?.name ?? HIERARCHY_LEVEL_SHORT_LABELS[currentLevel] ?? "Work item";
  const isSubTaskLevel = currentLevel === HIERARCHY_LEVEL_SUB_TASK;
  const color = diluteHierarchyBadgeColor(hierarchyType?.color || "#6B7280", currentLevel);

  useEffect(() => {
    if (!isScrumban || !workspaceSlug || !projectId || fetchedMap[projectId]) return;
    void fetchProjectTypes(workspaceSlug.toString(), projectId);
  }, [isScrumban, workspaceSlug, projectId, fetchedMap, fetchProjectTypes]);

  const allowedLevels = useMemo(() => {
    if (issue.parent_id) {
      const parent = getIssueById(issue.parent_id);
      const parentLevel = (parent?.hierarchy_level ?? 3) as number;
      return [Math.min(parentLevel + 1, 4)];
    }
    // Roots with children can only change type within the same level
    if ((issue.sub_issues_count ?? 0) > 0) return [currentLevel];
    // Roots without children may be Milestone, Epic, or Delivery
    return [1, 2, 3];
  }, [issue.parent_id, issue.sub_issues_count, currentLevel, getIssueById]);

  const options = useMemo(() => {
    if (!projectId) return [] as IProjectHierarchyType[];
    const all = getActiveProjectTypes(projectId, null) ?? [];
    return all.filter((t) => allowedLevels.includes(t.level));
  }, [projectId, getActiveProjectTypes, allowedLevels]);

  const groupedOptions = useMemo(() => {
    const groups: { level: 1 | 2 | 3 | 4; items: IProjectHierarchyType[] }[] = [];
    for (const level of allowedLevels as (1 | 2 | 3 | 4)[]) {
      const items = options.filter((t) => t.level === level);
      if (items.length) groups.push({ level, items });
    }
    return groups;
  }, [allowedLevels, options]);

  const handleSelect = async (nextType: IProjectHierarchyType) => {
    if (disabled || !projectId || !workspaceSlug) return;
    if (nextType.id === typeId) return;

    const data: Partial<TIssue> = {
      hierarchy_type_id: nextType.id,
      hierarchy_level: nextType.level,
      sub_work_item_category_id: nextType.id,
    };
    // Milestones are always roots
    if (nextType.level === HIERARCHY_LEVEL_MILESTONE) {
      data.parent_id = null;
    }

    try {
      if (updateIssueProp) {
        await updateIssueProp(projectId, issue.id, data);
      } else {
        await storeUpdateIssue(workspaceSlug.toString(), projectId, issue.id, data);
      }
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error!",
        message: "Could not update work item type.",
      });
    }
  };

  // Classic Scrum has no hierarchy type chips (Milestone / Epic / Story / …)
  if (!isScrumban) return null;

  const badgeButton = (
    <button
      type="button"
      disabled={disabled || options.length === 0}
      className={cn(
        "inline-flex h-5 w-20 flex-shrink-0 items-center justify-center truncate rounded-sm px-1.5 text-11 font-medium",
        isSubTaskLevel ? "text-primary" : "text-white",
        {
          "cursor-pointer hover:opacity-90": !disabled && options.length > 0,
          "cursor-default opacity-90": disabled || options.length === 0,
        },
        className
      )}
      style={{ backgroundColor: color }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <span className="w-full truncate text-center">{name}</span>
    </button>
  );

  if (disabled || options.length === 0) {
    return (
      <Tooltip tooltipContent={name} position="top">
        {badgeButton}
      </Tooltip>
    );
  }

  return (
    // oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions
    <div
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <CustomMenu placement="bottom-start" closeOnSelect className="flex-shrink-0" customButton={badgeButton}>
        {groupedOptions.map((group) => (
          <div key={group.level}>
            {groupedOptions.length > 1 && (
              <div className="px-2 py-1 text-11 font-medium text-tertiary">{HIERARCHY_LEVEL_LABELS[group.level]}</div>
            )}
            {group.items.map((item) => (
              <CustomMenu.MenuItem key={item.id} onClick={() => void handleSelect(item)}>
                <div className="flex w-full items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: diluteHierarchyBadgeColor(item.color, item.level) }}
                  />
                  <span className="flex-1 truncate">{item.name}</span>
                  {typeId === item.id && <CheckIcon className="size-3.5 flex-shrink-0 text-secondary" />}
                </div>
              </CustomMenu.MenuItem>
            ))}
          </div>
        ))}
      </CustomMenu>
    </div>
  );
});
