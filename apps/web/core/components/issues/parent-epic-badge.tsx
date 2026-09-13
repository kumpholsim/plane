/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { DEFAULT_EPIC_BADGE_COLOR, isStagedGateScrumbanMode } from "@plane/constants";
import { HIERARCHY_LEVEL_DELIVERY, HIERARCHY_LEVEL_EPIC } from "@plane/types";
import type { TIssue } from "@plane/types";
import { Tooltip } from "@plane/propel/tooltip";
import { cn } from "@plane/utils";
import { getHierarchyLevel } from "@/components/issues/issue-detail-widgets/sub-issues/depth";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useProject } from "@/hooks/store/use-project";
import { useProjectHierarchyType } from "@/hooks/store/use-project-hierarchy-type";

type EpicIssueLite = Pick<
  TIssue,
  | "id"
  | "project_id"
  | "parent_id"
  | "hierarchy_level"
  | "hierarchy_type_id"
  | "sub_work_item_category_id"
  | "name"
  | "badge_color"
>;

type ChipProps = {
  epic: EpicIssueLite;
  className?: string;
};

/** Visual chip — epic name + badge_color (solid or gradient). */
export const EpicBadgeChip = observer(function EpicBadgeChip(props: ChipProps) {
  const { epic, className } = props;
  const { getTypeById } = useProjectHierarchyType();

  const typeId = epic.hierarchy_type_id ?? epic.sub_work_item_category_id ?? null;
  const hierarchyType = typeId ? getTypeById(typeId) : null;
  const color = epic.badge_color?.trim() || DEFAULT_EPIC_BADGE_COLOR;
  const label = epic.name?.trim() || hierarchyType?.name || "Epic";

  return (
    <Tooltip tooltipContent={`Epic: ${label}`} position="top">
      {/*
        ~67.5% of HierarchyTypeBadge (h-5 / text-11), width +25%.
        Scale avoids browser min-font-size crushing the chip.
      */}
      {/* oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions */}
      <span
        className={cn("relative inline-block h-[13.5px] w-[67.5px] flex-shrink-0 align-middle", className)}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <span
          className="absolute top-0 left-0 inline-flex h-5 w-[100px] origin-top-left scale-[0.675] items-center justify-center truncate rounded-sm px-1.5 text-11 leading-none font-medium text-white"
          style={{ background: color }}
        >
          <span className="w-full truncate text-center">{label}</span>
        </span>
      </span>
    </Tooltip>
  );
});

type SelfProps = {
  /** Epic issue id (e.g. Scrumban list module group id). */
  epicId: string | null | undefined;
  projectId?: string | null;
  className?: string;
};

/** Badge for an Epic (L2) itself — list group header beside epic title. */
export const EpicSelfBadge = observer(function EpicSelfBadge(props: SelfProps) {
  const { epicId, projectId: projectIdProp, className } = props;
  const { workspaceSlug, projectId: routerProjectId } = useParams();
  const { getProjectById } = useProject();
  const {
    fetchIssue,
    issue: { getIssueById },
  } = useIssueDetail();

  const projectId = projectIdProp || routerProjectId?.toString() || null;
  const isScrumban = isStagedGateScrumbanMode(projectId ? getProjectById(projectId)?.workflow_mode : undefined);
  const epic = epicId ? getIssueById(epicId) : undefined;

  useEffect(() => {
    if (!isScrumban || !epicId || epic || !workspaceSlug || !projectId) return;
    void fetchIssue(workspaceSlug.toString(), projectId, epicId).catch(() => {
      // Epic may be inaccessible; badge stays hidden.
    });
  }, [isScrumban, epicId, epic, workspaceSlug, projectId, fetchIssue]);

  if (!isScrumban || !epicId || !epic) return null;

  const epicLevel = getHierarchyLevel(epic);
  if (epicLevel > 0 && epicLevel !== HIERARCHY_LEVEL_EPIC) return null;

  return <EpicBadgeChip epic={epic} className={className} />;
});

type ParentProps = {
  issue: EpicIssueLite;
  className?: string;
};

/**
 * Compact Epic chip for Scrumban L3 board swimlanes — resolves the parent Epic.
 */
export const ParentEpicBadge = observer(function ParentEpicBadge(props: ParentProps) {
  const { issue, className } = props;
  const { workspaceSlug } = useParams();
  const { getProjectById } = useProject();
  const {
    fetchIssue,
    issue: { getIssueById },
  } = useIssueDetail();

  const projectId = issue.project_id;
  const isScrumban = isStagedGateScrumbanMode(projectId ? getProjectById(projectId)?.workflow_mode : undefined);
  const isL3 = getHierarchyLevel(issue) === HIERARCHY_LEVEL_DELIVERY;
  const epicId = isScrumban && isL3 ? issue.parent_id : null;
  const epic = epicId ? getIssueById(epicId) : undefined;

  useEffect(() => {
    if (!epicId || epic || !workspaceSlug || !projectId) return;
    void fetchIssue(workspaceSlug.toString(), projectId, epicId).catch(() => {
      // Parent may be inaccessible; badge simply stays hidden.
    });
  }, [epicId, epic, workspaceSlug, projectId, fetchIssue]);

  if (!epicId || !epic) return null;

  const epicLevel = getHierarchyLevel(epic);
  if (epicLevel > 0 && epicLevel !== HIERARCHY_LEVEL_EPIC) return null;

  return <EpicBadgeChip epic={epic} className={className} />;
});
