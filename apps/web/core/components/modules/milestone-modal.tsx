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
import type { IModule, TIssue } from "@plane/types";
import { EModalPosition, EModalWidth, ModalCore } from "@plane/ui";
// components
import { ModuleForm } from "@/components/modules";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useProjectHierarchyType } from "@/hooks/store/use-project-hierarchy-type";
import useKeypress from "@/hooks/use-keypress";
import { usePlatformOS } from "@/hooks/use-platform-os";
import { IssueService } from "@/services/issue";

const HIERARCHY_MODULES_REFRESH_EVENT = "plane:hierarchy-modules-refresh";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  data?: TIssue;
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

const issueToModuleFormData = (issue: TIssue | undefined): Partial<IModule> | undefined => {
  if (!issue) return undefined;
  return {
    id: issue.id,
    name: issue.name,
    description: "",
    project_id: issue.project_id,
    start_date: issue.start_date ?? undefined,
    target_date: issue.target_date ?? undefined,
    lead_id: issue.assignee_ids?.[0] ?? null,
    member_ids: [],
    status: "backlog",
  };
};

export const CreateUpdateMilestoneModal = observer(function CreateUpdateMilestoneModal(props: Props) {
  const { isOpen, onClose, data, workspaceSlug, projectId } = props;
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const { workspaceProjectIds } = useProject();
  const { fetchProjectTypes, getActiveProjectTypes, fetchedMap } = useProjectHierarchyType();
  const { isMobile } = usePlatformOS();

  const formData = useMemo(() => issueToModuleFormData(data), [data]);
  const isEdit = Boolean(data?.id);

  const handleClose = () => {
    reset(defaultValues);
    onClose();
  };

  const { reset } = useForm<IModule>({
    defaultValues,
  });

  useEffect(() => {
    if (!isOpen || !workspaceSlug || !projectId) return;
    if (fetchedMap[projectId]) return;
    void fetchProjectTypes(workspaceSlug, projectId);
  }, [isOpen, workspaceSlug, projectId, fetchedMap, fetchProjectTypes]);

  const handleCreateMilestone = async (payload: Partial<IModule>) => {
    if (!workspaceSlug || !projectId) return;

    const selectedProjectId = payload.project_id ?? projectId.toString();
    const milestoneTypes = getActiveProjectTypes(selectedProjectId, 1) ?? [];
    const milestoneType = milestoneTypes.find((t) => t.name.toLowerCase() === "milestone") ?? milestoneTypes[0];

    if (!milestoneType) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error!",
        message: "No Milestone type found for this project. Check Hierarchy settings.",
      });
      return;
    }

    await issueService
      .createIssue(workspaceSlug.toString(), selectedProjectId, {
        name: payload.name,
        description_html: payload.description ? `<p>${payload.description}</p>` : "<p></p>",
        hierarchy_level: 1,
        hierarchy_type_id: milestoneType.id,
        parent_id: null,
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
          message: "Milestone created successfully.",
        });
        return undefined;
      })
      .catch((err) => {
        setToast({
          type: TOAST_TYPE.ERROR,
          title: "Error!",
          message: err?.detail ?? err?.error ?? "Milestone could not be created. Please try again.",
        });
      });
  };

  const handleUpdateMilestone = async (payload: Partial<IModule>) => {
    if (!workspaceSlug || !projectId || !data?.id) return;

    await issueService
      .patchIssue(workspaceSlug.toString(), projectId.toString(), data.id, {
        name: payload.name,
        description_html: payload.description ? `<p>${payload.description}</p>` : undefined,
        start_date: payload.start_date ?? null,
        target_date: payload.target_date ?? null,
        assignee_ids: payload.lead_id ? [payload.lead_id] : [],
      })
      .then(() => {
        handleClose();
        window.dispatchEvent(new Event(HIERARCHY_MODULES_REFRESH_EVENT));
        setToast({
          type: TOAST_TYPE.SUCCESS,
          title: "Success!",
          message: "Milestone updated successfully.",
        });
        return undefined;
      })
      .catch((err) => {
        setToast({
          type: TOAST_TYPE.ERROR,
          title: "Error!",
          message: err?.detail ?? err?.error ?? "Milestone could not be updated. Please try again.",
        });
      });
  };

  const handleFormSubmit = async (formPayload: Partial<IModule>) => {
    if (!workspaceSlug || !projectId) return;
    if (isEdit) await handleUpdateMilestone(formPayload);
    else await handleCreateMilestone(formPayload);
  };

  useEffect(() => {
    if (!isOpen) {
      setActiveProject(null);
      return;
    }
    if (data?.project_id) {
      setActiveProject(data.project_id);
      return;
    }
    if (workspaceProjectIds && workspaceProjectIds.length > 0 && !activeProject)
      setActiveProject(projectId ?? workspaceProjectIds?.[0] ?? null);
  }, [activeProject, data, projectId, workspaceProjectIds, isOpen]);

  useKeypress("Escape", () => {
    if (isOpen) handleClose();
  });

  const milestoneType = useMemo(() => {
    const selectedProjectId = activeProject ?? projectId;
    if (!selectedProjectId) return null;
    const milestoneTypes = getActiveProjectTypes(selectedProjectId, 1) ?? [];
    return milestoneTypes.find((t) => t.name.toLowerCase() === "milestone") ?? milestoneTypes[0] ?? null;
  }, [activeProject, projectId, getActiveProjectTypes]);

  return (
    <ModalCore isOpen={isOpen} position={EModalPosition.TOP} width={EModalWidth.XXL}>
      <ModuleForm
        handleFormSubmit={handleFormSubmit}
        handleClose={handleClose}
        status={isEdit}
        projectId={activeProject ?? ""}
        setActiveProject={setActiveProject}
        data={formData as IModule | undefined}
        isMobile={isMobile}
        typeBadge={
          milestoneType
            ? { name: milestoneType.name, color: milestoneType.color || "#5B21B6" }
            : { name: "Milestone", color: "#5B21B6" }
        }
      />
    </ModalCore>
  );
});
