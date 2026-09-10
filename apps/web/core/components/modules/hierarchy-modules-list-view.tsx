/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { draggable, dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { attachInstruction, extractInstruction } from "@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { EUserPermissionsLevel } from "@plane/constants";
import { Button } from "@plane/propel/button";
import { EditIcon, TrashIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { TIssue, TIssuesResponse } from "@plane/types";
import { EUserProjectRoles } from "@plane/types";
import { ContentWrapper, CustomMenu, DragHandle, DropIndicator, Loader } from "@plane/ui";
import { cn, generateWorkItemLink } from "@plane/utils";
import { HierarchyTypeBadge } from "@/components/issues/hierarchy-type-badge";
import { isEpicWorkItem } from "@/components/issues/issue-detail-widgets/sub-issues/depth";
import { CreateUpdateEpicModal } from "@/components/modules/modal";
import { CreateUpdateMilestoneModal } from "@/components/modules/milestone-modal";
import { useProject } from "@/hooks/store/use-project";
import { useProjectHierarchyType } from "@/hooks/store/use-project-hierarchy-type";
import { useUserPermissions } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
import { IssueService } from "@/services/issue";

const issueService = new IssueService();
export const HIERARCHY_MODULES_REFRESH_EVENT = "plane:hierarchy-modules-refresh";
export const HIERARCHY_OPEN_MILESTONE_EVENT = "plane:hierarchy-open-milestone";
export const HIERARCHY_OPEN_EPIC_EVENT = "plane:hierarchy-open-epic";

const EPIC_DND_TYPE = "HIERARCHY_EPIC";
const EPIC_ROW_DND_TYPE = "HIERARCHY_EPIC_ROW";
const MILESTONE_GROUP_DND_TYPE = "HIERARCHY_MILESTONE_GROUP";
const SORT_ORDER_GAP = 65535;

type MilestoneGroup = {
  milestoneId: string | null;
  milestoneName: string;
  epics: TIssue[];
};

type EpicDragData = {
  type: typeof EPIC_DND_TYPE;
  epicId: string;
  fromMilestoneId: string | null;
};

type EpicRowDropData = {
  type: typeof EPIC_ROW_DND_TYPE;
  epicId: string;
  milestoneId: string | null;
};

type MilestoneGroupDropData = {
  type: typeof MILESTONE_GROUP_DND_TYPE;
  milestoneId: string | null;
};

type EpicDropArgs = {
  epicId: string;
  milestoneId: string | null;
  relativeToEpicId?: string;
  placeBelow?: boolean;
};

const normalizeIssues = (response: TIssuesResponse | undefined): TIssue[] => {
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

const sortBySortOrder = (items: TIssue[]) => [...items].toSorted((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

const isEpicDragData = (data: Record<string | symbol, unknown>): data is EpicDragData =>
  data.type === EPIC_DND_TYPE && typeof data.epicId === "string";

const isEpicRowDropData = (data: Record<string | symbol, unknown>): data is EpicRowDropData =>
  data.type === EPIC_ROW_DND_TYPE && typeof data.epicId === "string";

const computeSortOrder = (
  destinationEpics: TIssue[],
  draggedEpicId: string,
  relativeToEpicId: string | undefined,
  placeBelow: boolean
): number => {
  const others = destinationEpics.filter((epic) => epic.id !== draggedEpicId);

  if (others.length === 0) return SORT_ORDER_GAP;

  if (!relativeToEpicId) {
    return (others[others.length - 1].sort_order ?? SORT_ORDER_GAP) + SORT_ORDER_GAP;
  }

  const targetIndex = others.findIndex((epic) => epic.id === relativeToEpicId);
  if (targetIndex === -1) {
    return (others[others.length - 1].sort_order ?? SORT_ORDER_GAP) + SORT_ORDER_GAP;
  }

  const insertIndex = placeBelow ? targetIndex + 1 : targetIndex;

  if (insertIndex <= 0) {
    return (others[0].sort_order ?? SORT_ORDER_GAP) - SORT_ORDER_GAP;
  }
  if (insertIndex >= others.length) {
    return (others[others.length - 1].sort_order ?? SORT_ORDER_GAP) + SORT_ORDER_GAP;
  }

  const above = others[insertIndex - 1];
  const below = others[insertIndex];
  return ((above.sort_order ?? 0) + (below.sort_order ?? 0)) / 2;
};

type HierarchyEpicRowProps = {
  epic: TIssue;
  milestoneId: string | null;
  isLastChild: boolean;
  projectIdentifier: string | undefined;
  typeName: string | null;
  canDrag: boolean;
  onOpen: (epic: TIssue) => void;
};

function HierarchyEpicRow(props: HierarchyEpicRowProps) {
  const { epic, milestoneId, isLastChild, projectIdentifier, typeName, canDrag, onOpen } = props;
  const rowRef = useRef<HTMLDivElement | null>(null);
  const dragOccurredRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [instruction, setInstruction] = useState<"DRAG_OVER" | "DRAG_BELOW" | undefined>(undefined);

  useEffect(() => {
    const element = rowRef.current;
    if (!element || !canDrag) return;

    return combine(
      draggable({
        element,
        getInitialData: (): EpicDragData => ({
          type: EPIC_DND_TYPE,
          epicId: epic.id,
          fromMilestoneId: epic.parent_id ?? null,
        }),
        onDragStart: () => {
          dragOccurredRef.current = true;
          setIsDragging(true);
        },
        onDrop: () => setIsDragging(false),
      }),
      dropTargetForElements({
        element,
        canDrop: ({ source }) => isEpicDragData(source.data) && source.data.epicId !== epic.id,
        getData: ({ input, element: dropElement }) => {
          const data: EpicRowDropData = {
            type: EPIC_ROW_DND_TYPE,
            epicId: epic.id,
            milestoneId,
          };
          return attachInstruction(data, {
            input,
            element: dropElement,
            currentLevel: 0,
            indentPerLevel: 0,
            mode: isLastChild ? "last-in-group" : "standard",
          });
        },
        onDrag: ({ self }) => {
          const extracted = extractInstruction(self.data)?.type;
          setInstruction(
            extracted ? (extracted === "reorder-below" && isLastChild ? "DRAG_BELOW" : "DRAG_OVER") : undefined
          );
        },
        onDragLeave: () => setInstruction(undefined),
        onDrop: () => setInstruction(undefined),
      })
    );
  }, [canDrag, epic.id, epic.parent_id, isLastChild, milestoneId]);

  const handleOpen = () => {
    // Skip open if this pointer session was a drag
    if (dragOccurredRef.current) {
      dragOccurredRef.current = false;
      return;
    }
    onOpen(epic);
  };

  return (
    <div className="relative" ref={rowRef}>
      <DropIndicator classNames="absolute top-0 z-[2]" isVisible={instruction === "DRAG_OVER"} />
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-2 border-b border-subtle px-2 py-2 text-left last:border-b-0 hover:bg-layer-1",
          {
            "cursor-grab active:cursor-grabbing": canDrag,
            "opacity-50": isDragging,
          }
        )}
        onClick={handleOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen(epic);
          }
        }}
      >
        {canDrag && <DragHandle className="pointer-events-none cursor-grab" />}
        <div className="flex min-w-0 flex-1 items-center gap-3 px-2 py-1">
          <HierarchyTypeBadge issue={epic} disabled />
          <div className="min-w-0 flex-1">
            <p className="truncate text-14 font-medium text-primary">{epic.name}</p>
            <p className="text-12 text-tertiary">
              {projectIdentifier}-{epic.sequence_id}
              {typeName ? ` · ${typeName}` : ""}
              {epic.sub_issues_count ? ` · ${epic.sub_issues_count} work items` : ""}
            </p>
          </div>
        </div>
      </button>
      {isLastChild && <DropIndicator classNames="absolute bottom-0 z-[2]" isVisible={instruction === "DRAG_BELOW"} />}
    </div>
  );
}

type MilestoneGroupSectionProps = {
  group: MilestoneGroup;
  canDrop: boolean;
  isBusy: boolean;
  canManage: boolean;
  milestone: TIssue | undefined;
  projectIdentifier: string | undefined;
  getTypeName: (typeId: string | null | undefined) => string | null;
  onOpenEpic: (epic: TIssue) => void;
  onOpenMilestone: (milestone: TIssue) => void;
  onEditMilestone: (milestone: TIssue) => void;
  onDeleteMilestone: (milestone: TIssue, epicCount: number) => void;
  onCreateEpic: () => void;
  onDropEpic: (args: EpicDropArgs) => void;
};

function MilestoneGroupSection(props: MilestoneGroupSectionProps) {
  const {
    group,
    canDrop,
    isBusy,
    canManage,
    milestone,
    projectIdentifier,
    getTypeName,
    onOpenEpic,
    onOpenMilestone,
    onEditMilestone,
    onDeleteMilestone,
    onCreateEpic,
    onDropEpic,
  } = props;
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  useEffect(() => {
    const element = sectionRef.current;
    if (!element || !canDrop) return;

    return dropTargetForElements({
      element,
      canDrop: ({ source }) => isEpicDragData(source.data),
      getData: (): MilestoneGroupDropData => ({
        type: MILESTONE_GROUP_DND_TYPE,
        milestoneId: group.milestoneId,
      }),
      onDragEnter: () => setIsDraggingOver(true),
      onDragLeave: () => setIsDraggingOver(false),
      onDrop: ({ source, location }) => {
        setIsDraggingOver(false);
        if (!isEpicDragData(source.data)) return;

        const dropTargets = location.current.dropTargets ?? [];
        const epicTarget = dropTargets.find((target) => isEpicRowDropData(target.data));
        const relativeToEpicId = epicTarget && isEpicRowDropData(epicTarget.data) ? epicTarget.data.epicId : undefined;
        const instruction = epicTarget ? extractInstruction(epicTarget.data)?.type : undefined;
        const placeBelow = instruction === "reorder-below";

        // Same group, no relative target → nothing to change (already in this group)
        if ((source.data.fromMilestoneId ?? null) === (group.milestoneId ?? null) && !relativeToEpicId) {
          return;
        }

        // Dropping on itself
        if (relativeToEpicId === source.data.epicId) return;

        onDropEpic({
          epicId: source.data.epicId,
          milestoneId: group.milestoneId,
          relativeToEpicId,
          placeBelow,
        });
      },
    });
  }, [canDrop, group.milestoneId, onDropEpic]);

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        {milestone ? (
          <button
            type="button"
            className="flex min-w-0 items-center gap-2 rounded-sm text-left hover:opacity-90"
            onClick={() => onOpenMilestone(milestone)}
          >
            <HierarchyTypeBadge issue={milestone} disabled />
            <h3 className="truncate text-13 font-semibold text-primary">{group.milestoneName}</h3>
          </button>
        ) : (
          <h3 className="text-13 font-semibold text-primary">{group.milestoneName}</h3>
        )}
        <span className="text-11 text-placeholder">
          {group.epics.length} epic{group.epics.length === 1 ? "" : "s"}
        </span>
        {canManage && milestone && (
          <div className="ml-auto">
            <CustomMenu ellipsis placement="bottom-end" closeOnSelect disabled={isBusy}>
              <CustomMenu.MenuItem onClick={() => onEditMilestone(milestone)}>
                <div className="flex items-center gap-2">
                  <EditIcon className="size-3.5" />
                  <span>Edit</span>
                </div>
              </CustomMenu.MenuItem>
              <CustomMenu.MenuItem onClick={() => onDeleteMilestone(milestone, group.epics.length)}>
                <div className="flex items-center gap-2 text-danger-primary">
                  <TrashIcon className="size-3.5" />
                  <span>Delete</span>
                </div>
              </CustomMenu.MenuItem>
            </CustomMenu>
          </div>
        )}
      </div>
      <div
        ref={sectionRef}
        className={cn("overflow-hidden rounded-md border border-subtle transition-colors", {
          "border-accent-strong bg-accent-primary/5 ring-1 ring-accent-strong": isDraggingOver,
        })}
      >
        {group.epics.length === 0 ? (
          <div className="px-4 py-6 text-13 text-tertiary">
            {isDraggingOver
              ? "Drop epic here"
              : group.milestoneId
                ? "No epics in this milestone yet. "
                : "No ungrouped epics. "}
            {!isDraggingOver && canManage && (
              <button type="button" className="text-accent-primary hover:underline" onClick={onCreateEpic}>
                Create epic
              </button>
            )}
          </div>
        ) : (
          <div>
            {group.epics.map((epic, index) => (
              <div key={epic.id} className="group/epic-row">
                <HierarchyEpicRow
                  epic={epic}
                  milestoneId={group.milestoneId}
                  isLastChild={index === group.epics.length - 1}
                  projectIdentifier={projectIdentifier}
                  typeName={getTypeName(epic.hierarchy_type_id)}
                  canDrag={canManage}
                  onOpen={onOpenEpic}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export const HierarchyModulesListView = observer(function HierarchyModulesListView() {
  const { workspaceSlug, projectId } = useParams() as { workspaceSlug: string; projectId: string };
  const router = useAppRouter();
  const { getProjectById } = useProject();
  const { fetchProjectTypes, fetchedMap, getTypeById } = useProjectHierarchyType();
  const { allowPermissions } = useUserPermissions();

  const [epics, setEpics] = useState<TIssue[] | undefined>(undefined);
  const [milestones, setMilestones] = useState<TIssue[]>([]);
  const [loader, setLoader] = useState(true);
  const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);
  const [isEpicModalOpen, setIsEpicModalOpen] = useState(false);
  const [epicMilestoneId, setEpicMilestoneId] = useState<string | null>(null);
  const [editingMilestone, setEditingMilestone] = useState<TIssue | undefined>(undefined);
  const [busyMilestoneId, setBusyMilestoneId] = useState<string | null>(null);

  const canCreate = allowPermissions(
    [EUserProjectRoles.ADMIN, EUserProjectRoles.MEMBER],
    EUserPermissionsLevel.PROJECT
  );
  const canManage = canCreate;
  const project = getProjectById(projectId);

  const loadData = useCallback(async () => {
    if (!workspaceSlug || !projectId) return;
    setLoader(true);
    try {
      if (!fetchedMap[projectId]) {
        await fetchProjectTypes(workspaceSlug, projectId);
      }
      const [l2Response, l1Response] = await Promise.all([
        issueService.getIssues(workspaceSlug, projectId, {
          hierarchy_level: "2",
          sub_issue: true,
          per_page: 100,
        }),
        issueService.getIssues(workspaceSlug, projectId, {
          hierarchy_level: "1",
          sub_issue: true,
          per_page: 100,
        }),
      ]);
      setEpics(normalizeIssues(l2Response as TIssuesResponse));
      setMilestones(normalizeIssues(l1Response as TIssuesResponse));
    } catch {
      setEpics([]);
      setMilestones([]);
    } finally {
      setLoader(false);
    }
  }, [workspaceSlug, projectId, fetchedMap, fetchProjectTypes]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const onRefresh = () => void loadData();
    window.addEventListener("focus", onRefresh);
    window.addEventListener(HIERARCHY_MODULES_REFRESH_EVENT, onRefresh);
    return () => {
      window.removeEventListener("focus", onRefresh);
      window.removeEventListener(HIERARCHY_MODULES_REFRESH_EVENT, onRefresh);
    };
  }, [loadData]);

  const groups = useMemo((): MilestoneGroup[] => {
    if (!epics) return [];
    const byMilestone = new Map<string | null, TIssue[]>();
    for (const epic of epics) {
      const key = epic.parent_id ?? null;
      const list = byMilestone.get(key) ?? [];
      list.push(epic);
      byMilestone.set(key, list);
    }
    const result: MilestoneGroup[] = [];
    for (const milestone of milestones) {
      const items = byMilestone.get(milestone.id) ?? [];
      result.push({
        milestoneId: milestone.id,
        milestoneName: milestone.name,
        epics: sortBySortOrder(items),
      });
      byMilestone.delete(milestone.id);
    }
    for (const [parentId, items] of byMilestone) {
      if (parentId === null) continue;
      result.push({
        milestoneId: parentId,
        milestoneName: "Milestone",
        epics: sortBySortOrder(items),
      });
    }
    result.push({
      milestoneId: null,
      milestoneName: "Ungrouped",
      epics: sortBySortOrder(byMilestone.get(null) ?? []),
    });
    return result;
  }, [epics, milestones]);

  const openIssue = useCallback(
    (issue: TIssue) => {
      const link = generateWorkItemLink({
        workspaceSlug,
        projectId: issue.project_id,
        issueId: issue.id,
        projectIdentifier: project?.identifier,
        sequenceId: issue.sequence_id,
        isEpic: isEpicWorkItem(issue),
      });
      router.push(link);
    },
    [workspaceSlug, project?.identifier, router]
  );

  const openCreateMilestoneModal = () => {
    setEditingMilestone(undefined);
    setIsMilestoneModalOpen(true);
  };

  const openEditMilestoneModal = (milestone: TIssue) => {
    setEditingMilestone(milestone);
    setIsMilestoneModalOpen(true);
  };

  const closeMilestoneModal = () => {
    setIsMilestoneModalOpen(false);
    setEditingMilestone(undefined);
  };

  const openCreateEpicModal = (milestoneId: string | null = null) => {
    setEpicMilestoneId(milestoneId);
    setIsEpicModalOpen(true);
  };

  useEffect(() => {
    const onOpenMilestone = () => openCreateMilestoneModal();
    const onOpenEpic = () => openCreateEpicModal(null);
    window.addEventListener(HIERARCHY_OPEN_MILESTONE_EVENT, onOpenMilestone);
    window.addEventListener(HIERARCHY_OPEN_EPIC_EVENT, onOpenEpic);
    return () => {
      window.removeEventListener(HIERARCHY_OPEN_MILESTONE_EVENT, onOpenMilestone);
      window.removeEventListener(HIERARCHY_OPEN_EPIC_EVENT, onOpenEpic);
    };
  }, []);

  const handleDropEpic = useCallback(
    async ({ epicId, milestoneId, relativeToEpicId, placeBelow = false }: EpicDropArgs) => {
      if (!workspaceSlug || !projectId || !canManage) return;

      let previous: TIssue[] | undefined;
      let nextSortOrder = SORT_ORDER_GAP;

      setEpics((curr) => {
        if (!curr) return curr;
        previous = curr;

        const groupmates = curr.filter((epic) => (epic.parent_id ?? null) === (milestoneId ?? null));
        nextSortOrder = computeSortOrder(groupmates, epicId, relativeToEpicId, placeBelow);

        return curr.map((epic) =>
          epic.id === epicId ? { ...epic, parent_id: milestoneId, sort_order: nextSortOrder } : epic
        );
      });

      try {
        await issueService.patchIssue(workspaceSlug, projectId, epicId, {
          parent_id: milestoneId,
          sort_order: nextSortOrder,
        });
      } catch (err: unknown) {
        if (previous) setEpics(previous);
        const message =
          typeof err === "object" && err && "error" in err
            ? String((err as { error: string }).error)
            : "Could not move epic.";
        setToast({ type: TOAST_TYPE.ERROR, title: "Error!", message });
      }
    },
    [workspaceSlug, projectId, canManage]
  );

  const handleDeleteMilestone = async (milestone: TIssue, epicCount: number) => {
    if (!workspaceSlug || !projectId || !canManage) return;
    const warning =
      epicCount > 0
        ? `Delete milestone "${milestone.name}"? Its ${epicCount} epic(s) will become ungrouped (parent removed).`
        : `Delete milestone "${milestone.name}"?`;
    if (!window.confirm(warning)) return;

    setBusyMilestoneId(milestone.id);
    try {
      const childEpics = epics?.filter((e) => e.parent_id === milestone.id) ?? [];
      await Promise.all(
        childEpics.map((epic) => issueService.patchIssue(workspaceSlug, projectId, epic.id, { parent_id: null }))
      );
      await issueService.deleteIssue(workspaceSlug, projectId, milestone.id);
      setToast({ type: TOAST_TYPE.SUCCESS, title: "Success!", message: "Milestone deleted." });
      await loadData();
    } catch (err: unknown) {
      const message =
        typeof err === "object" && err && "error" in err
          ? String((err as { error: string }).error)
          : "Could not delete milestone.";
      setToast({ type: TOAST_TYPE.ERROR, title: "Error!", message });
    } finally {
      setBusyMilestoneId(null);
    }
  };

  const getTypeName = useCallback(
    (typeId: string | null | undefined) => {
      if (!typeId) return null;
      return getTypeById(typeId)?.name ?? null;
    },
    [getTypeById]
  );

  if (loader || epics === undefined) {
    return (
      <ContentWrapper>
        <Loader className="space-y-4">
          <Loader.Item height="48px" />
          <Loader.Item height="48px" />
          <Loader.Item height="48px" />
        </Loader>
      </ContentWrapper>
    );
  }

  return (
    <ContentWrapper>
      <CreateUpdateMilestoneModal
        isOpen={isMilestoneModalOpen}
        onClose={closeMilestoneModal}
        data={editingMilestone}
        workspaceSlug={workspaceSlug}
        projectId={projectId}
      />
      <CreateUpdateEpicModal
        isOpen={isEpicModalOpen}
        onClose={() => {
          setIsEpicModalOpen(false);
          setEpicMilestoneId(null);
        }}
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        initialMilestoneId={epicMilestoneId}
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-13 text-tertiary">
          Drag epics to reorder within a group, or move them between milestones and Ungrouped.
        </p>
        {canCreate && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={openCreateMilestoneModal}>
              Create milestone
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEpicMilestoneId(null);
                setIsEpicModalOpen(true);
              }}
            >
              Create epic
            </Button>
          </div>
        )}
      </div>

      {epics.length === 0 && milestones.length === 0 ? (
        <div className="rounded-md border border-dashed border-subtle px-6 py-10 text-center">
          <p className="text-14 font-medium text-primary">No epics or milestones yet</p>
          <p className="mt-1 text-13 text-tertiary">Create a milestone to group work, then add epics under it.</p>
          {canCreate && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <Button variant="secondary" size="sm" onClick={openCreateMilestoneModal}>
                Create milestone
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setEpicMilestoneId(null);
                  setIsEpicModalOpen(true);
                }}
              >
                Create epic
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => {
            const milestone = group.milestoneId ? milestones.find((m) => m.id === group.milestoneId) : undefined;
            return (
              <MilestoneGroupSection
                key={group.milestoneId ?? "ungrouped"}
                group={group}
                canDrop={canManage}
                isBusy={busyMilestoneId === group.milestoneId}
                canManage={canManage}
                milestone={milestone}
                projectIdentifier={project?.identifier}
                getTypeName={getTypeName}
                onOpenEpic={openIssue}
                onOpenMilestone={openIssue}
                onEditMilestone={openEditMilestoneModal}
                onDeleteMilestone={(m, count) => void handleDeleteMilestone(m, count)}
                onCreateEpic={() => {
                  setEpicMilestoneId(group.milestoneId);
                  setIsEpicModalOpen(true);
                }}
                onDropEpic={(args) => void handleDropEpic(args)}
              />
            );
          })}
        </div>
      )}
    </ContentWrapper>
  );
});
