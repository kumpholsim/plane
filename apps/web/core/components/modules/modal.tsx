/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react";
import { useForm } from "react-hook-form";
// Plane imports
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { IModule, TIssue, TIssuesResponse } from "@plane/types";
import { CustomMenu, EModalPosition, EModalWidth, ModalCore } from "@plane/ui";
// components
import { ModuleForm } from "@/components/modules";
import { HIERARCHY_MODULES_REFRESH_EVENT } from "@/components/modules/hierarchy-modules-list-view";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useProjectHierarchyType } from "@/hooks/store/use-project-hierarchy-type";
import useKeypress from "@/hooks/use-keypress";
import { usePlatformOS } from "@/hooks/use-platform-os";
import { IssueService } from "@/services/issue";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  data?: IModule;
  workspaceSlug: string;
  projectId: string;
};

const defaultValues: Partial<IModule> = {
  name: "",
  description: "",
  status: "backlog",
  lead_id: null,
  member_ids: [],
};

const issueService = new IssueService();

const normalizeIssues = (response: TIssuesResponse | undefined): TIssue[] => {
  const results = response?.results;
  if (!results) return [];
  if (Array.isArray(results)) return results;
  const list: TIssue[] = [];
  for (const groupId in results) {
    const group = results[groupId] as { results?: TIssue[] } | TIssue[];
    if (Array.isArray(group)) list.push(...group);
    else if (Array.isArray(group?.results)) list.push(...group.results);
  }
  return list;
};

export const CreateUpdateModuleModal = observer(function CreateUpdateModuleModal(props: Props) {
  const { isOpen, onClose, data, workspaceSlug, projectId } = props;
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [milestones, setMilestones] = useState<TIssue[]>([]);
  const [milestoneParentId, setMilestoneParentId] = useState<string | null>(null);
  const { workspaceProjectIds } = useProject();
  const { fetchProjectTypes, getActiveProjectTypes, fetchedMap } = useProjectHierarchyType();
  const { isMobile } = usePlatformOS();

  const handleClose = () => {
    reset(defaultValues);
    setMilestoneParentId(null);
    onClose();
  };

  const { reset } = useForm<IModule>({
    defaultValues,
  });

  useEffect(() => {
    if (!isOpen || !workspaceSlug || !projectId) return;
    const load = async () => {
      if (!fetchedMap[projectId]) {
        await fetchProjectTypes(workspaceSlug, projectId);
      }
      const response = await issueService.getIssues(workspaceSlug, projectId, {
        hierarchy_level: "1",
        sub_issue: true,
        per_page: 100,
      });
      setMilestones(normalizeIssues(response));
    };
    void load();
  }, [isOpen, workspaceSlug, projectId, fetchedMap, fetchProjectTypes]);

  const handleCreateModule = async (payload: Partial<IModule>) => {
    if (!workspaceSlug || !projectId) return;

    const selectedProjectId = payload.project_id ?? projectId.toString();
    const epicTypes = getActiveProjectTypes(selectedProjectId, 2) ?? [];
    const epicType = epicTypes.find((t) => t.name.toLowerCase() === "epic") ?? epicTypes[0];

    await issueService
      .createIssue(workspaceSlug.toString(), selectedProjectId, {
        name: payload.name,
        description_html: payload.description ? `<p>${payload.description}</p>` : "<p></p>",
        hierarchy_level: 2,
        hierarchy_type_id: epicType?.id ?? null,
        parent_id: milestoneParentId,
        start_date: payload.start_date ?? null,
        target_date: payload.target_date ?? null,
        assignee_ids: payload.lead_id ? [payload.lead_id] : [],
        priority: "none",
      })
      .then(() => {
        handleClose();
        window.dispatchEvent(new Event(HIERARCHY_MODULES_REFRESH_EVENT));
        setToast({
          type: TOAST_TYPE.SUCCESS,
          title: "Success!",
          message: "Epic created successfully.",
        });
        return undefined;
      })
      .catch((err) => {
        setToast({
          type: TOAST_TYPE.ERROR,
          title: "Error!",
          message: err?.detail ?? err?.error ?? "Epic could not be created. Please try again.",
        });
      });
  };

  const handleFormSubmit = async (formData: Partial<IModule>) => {
    if (!workspaceSlug || !projectId) return;
    if (data) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error!",
        message: "Edit this epic from its work item page.",
      });
      return;
    }
    await handleCreateModule(formData);
  };

  useEffect(() => {
    if (!isOpen) {
      setActiveProject(null);
      return;
    }
    if (data && data.project_id) {
      setActiveProject(data.project_id);
      return;
    }
    if (workspaceProjectIds && workspaceProjectIds.length > 0 && !activeProject)
      setActiveProject(projectId ?? workspaceProjectIds?.[0] ?? null);
  }, [activeProject, data, projectId, workspaceProjectIds, isOpen]);

  useKeypress("Escape", () => {
    if (isOpen) handleClose();
  });

  const selectedMilestone = milestones.find((m) => m.id === milestoneParentId);

  const epicType = useMemo(() => {
    const selectedProjectId = activeProject ?? projectId;
    if (!selectedProjectId) return null;
    const epicTypes = getActiveProjectTypes(selectedProjectId, 2) ?? [];
    return epicTypes.find((t) => t.name.toLowerCase() === "epic") ?? epicTypes[0] ?? null;
  }, [activeProject, projectId, getActiveProjectTypes]);

  return (
    <ModalCore isOpen={isOpen} position={EModalPosition.TOP} width={EModalWidth.XXL}>
      <div className="border-b border-subtle px-5 pt-5 pb-3">
        <label htmlFor="epic-milestone" className="mb-1 block text-13 font-medium text-tertiary">
          Milestone (optional)
        </label>
        <CustomMenu
          placement="bottom-start"
          closeOnSelect
          className="w-full"
          customButton={
            <button
              id="epic-milestone"
              type="button"
              className="flex h-9 w-full items-center justify-between rounded-md border border-subtle px-3 text-13 text-primary hover:bg-layer-1"
            >
              <span className="truncate">{selectedMilestone?.name ?? "No milestone (ungrouped)"}</span>
            </button>
          }
        >
          <CustomMenu.MenuItem onClick={() => setMilestoneParentId(null)}>No milestone (ungrouped)</CustomMenu.MenuItem>
          {milestones.map((milestone) => (
            <CustomMenu.MenuItem key={milestone.id} onClick={() => setMilestoneParentId(milestone.id)}>
              {milestone.name}
            </CustomMenu.MenuItem>
          ))}
        </CustomMenu>
      </div>
      <ModuleForm
        handleFormSubmit={handleFormSubmit}
        handleClose={handleClose}
        status={false}
        projectId={activeProject ?? ""}
        setActiveProject={setActiveProject}
        data={data}
        isMobile={isMobile}
        entityLabel="epic"
        typeBadge={
          epicType ? { name: epicType.name, color: epicType.color || "#6B7280" } : { name: "Epic", color: "#6B7280" }
        }
      />
    </ModalCore>
  );
});
