/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { AtSign, Briefcase } from "lucide-react";
// plane imports
import { Logo } from "@plane/propel/emoji-icon-picker";
import {
  CalendarLayoutIcon,
  CycleGroupIcon,
  CycleIcon,
  ModuleIcon,
  StatePropertyIcon,
  PriorityIcon,
  StateGroupIcon,
  MembersPropertyIcon,
  LabelPropertyIcon,
  StartDatePropertyIcon,
  DueDatePropertyIcon,
  UserCirclePropertyIcon,
  PriorityPropertyIcon,
} from "@plane/propel/icons";
import type {
  ICycle,
  IState,
  IUserLite,
  TFilterConfig,
  IIssueLabel,
  IProject,
  TIssue,
  TIssuesResponse,
  TWorkItemFilterProperty,
} from "@plane/types";
import { Avatar } from "@plane/ui";
import {
  cn,
  getAssigneeFilterConfig,
  getCreatedAtFilterConfig,
  getCreatedByFilterConfig,
  getCycleFilterConfig,
  getFileURL,
  getLabelFilterConfig,
  getMentionFilterConfig,
  getModuleFilterConfig,
  getPriorityFilterConfig,
  getProgressStatusFilterConfig,
  getProjectFilterConfig,
  getStartDateFilterConfig,
  getStateFilterConfig,
  getStateGroupFilterConfig,
  getSubscriberFilterConfig,
  getTargetDateFilterConfig,
  getUpdatedAtFilterConfig,
  isLoaderReady,
} from "@plane/utils";
import type { TEpicFilterOption } from "@plane/utils";
// store hooks
import { useCycle } from "@/hooks/store/use-cycle";
import { useLabel } from "@/hooks/store/use-label";
import { useMember } from "@/hooks/store/use-member";
import { useProject } from "@/hooks/store/use-project";
import { useProjectHierarchyType } from "@/hooks/store/use-project-hierarchy-type";
import { useProjectState } from "@/hooks/store/use-project-state";
// plane web imports
import { useFiltersOperatorConfigs } from "@/hooks/rich-filters/use-filters-operator-configs";
import { store } from "@/lib/store-context";
import { IssueService } from "@/services/issue";
import { isL3DoneProgressStatus } from "@/components/issues/hierarchy-status";
import { L3_PROGRESS_PHASE_FALLBACK_COLORS, L3_PROGRESS_STATUS_OPTIONS } from "@plane/constants";

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

export type TWorkItemFiltersEntityProps = {
  workspaceSlug: string;
  cycleIds?: string[];
  labelIds?: string[];
  memberIds?: string[];
  /** @deprecated Classic module ids — epic options are fetched by hierarchy_level=2. */
  moduleIds?: string[];
  projectId?: string;
  projectIds?: string[];
  stateIds?: string[];
};

export type TUseWorkItemFiltersConfigProps = {
  allowedFilters: TWorkItemFilterProperty[];
} & TWorkItemFiltersEntityProps;

export type TWorkItemFiltersConfig = {
  areAllConfigsInitialized: boolean;
  configs: TFilterConfig<TWorkItemFilterProperty>[];
  configMap: {
    [key in TWorkItemFilterProperty]?: TFilterConfig<TWorkItemFilterProperty>;
  };
  isFilterEnabled: (key: TWorkItemFilterProperty) => boolean;
  members: IUserLite[];
};

export const useWorkItemFiltersConfig = (props: TUseWorkItemFiltersConfigProps): TWorkItemFiltersConfig => {
  const { allowedFilters, cycleIds, labelIds, memberIds, projectId, projectIds, stateIds, workspaceSlug } = props;
  // store hooks
  const { loader: projectLoader, getProjectById } = useProject();
  const { getCycleById } = useCycle();
  const { getLabelById } = useLabel();
  const { getStateById } = useProjectState();
  const { getActiveProjectTypes } = useProjectHierarchyType();
  const { getUserDetails } = useMember();
  // derived values
  const operatorConfigs = useFiltersOperatorConfigs({ workspaceSlug });
  const filtersToShow = useMemo(() => new Set(allowedFilters), [allowedFilters]);
  const project = useMemo(() => getProjectById(projectId), [projectId, getProjectById]);
  const members: IUserLite[] | undefined = useMemo(
    () =>
      memberIds
        ? (memberIds.map((memberId) => getUserDetails(memberId)).filter((member) => member) as IUserLite[])
        : undefined,
    [memberIds, getUserDetails]
  );
  const workItemStates: IState[] | undefined = useMemo(
    () =>
      stateIds ? (stateIds.map((stateId) => getStateById(stateId)).filter((state) => state) as IState[]) : undefined,
    [stateIds, getStateById]
  );
  const workItemLabels: IIssueLabel[] | undefined = useMemo(
    () =>
      labelIds
        ? (labelIds.map((labelId) => getLabelById(labelId)).filter((label) => label) as IIssueLabel[])
        : undefined,
    [labelIds, getLabelById]
  );
  const cycles = useMemo(
    () => (cycleIds ? (cycleIds.map((cycleId) => getCycleById(cycleId)).filter((cycle) => cycle) as ICycle[]) : []),
    [cycleIds, getCycleById]
  );
  const [epics, setEpics] = useState<TEpicFilterOption[] | undefined>(undefined);
  const projectTypes = useMemo(() => getActiveProjectTypes(projectId, 4) ?? [], [getActiveProjectTypes, projectId]);
  const projects = useMemo(
    () =>
      projectIds
        ? (projectIds.map((id) => getProjectById(id)).filter((projectOption) => projectOption) as IProject[])
        : [],
    [projectIds, getProjectById]
  );
  const areAllConfigsInitialized = useMemo(() => isLoaderReady(projectLoader), [projectLoader]);
  const progressPhaseColors = useMemo(() => {
    const colors = {
      design: L3_PROGRESS_PHASE_FALLBACK_COLORS.design ?? "#F97316",
      dev: L3_PROGRESS_PHASE_FALLBACK_COLORS.dev ?? "#3B82F6",
      qa: L3_PROGRESS_PHASE_FALLBACK_COLORS.qa ?? "#22C55E",
    };

    for (const type of projectTypes) {
      const key = (type.name ?? "").trim().toLowerCase();
      if (key === "design" || key === "dev" || key === "qa") {
        colors[key] = type.color || colors[key];
      }
    }

    return colors;
  }, [projectTypes]);

  /**
   * Checks if a filter is enabled based on the filters to show.
   * @param key - The filter key.
   * @param level - The level of the filter.
   * @returns True if the filter is enabled, false otherwise.
   */
  const isFilterEnabled = useCallback((key: TWorkItemFilterProperty) => filtersToShow.has(key), [filtersToShow]);

  // Load L2 epics for the (legacy module_id) filter options
  useEffect(() => {
    if (!workspaceSlug || !projectId || !isFilterEnabled("module_id") || project?.module_view !== true) {
      setEpics([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const response = await issueService.getIssues(workspaceSlug, projectId, {
          hierarchy_level: "2",
          sub_issue: true,
          per_page: "100",
        });
        const issues = normalizeIssueList(response as TIssuesResponse);
        if (cancelled) return;
        store.issue.issues.addIssue(issues);
        setEpics(issues.map((issue) => ({ id: issue.id, name: issue.name })));
      } catch {
        if (!cancelled) setEpics([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId, project?.module_view, isFilterEnabled]);

  // state group filter config
  const stateGroupFilterConfig = useMemo(
    () =>
      getStateGroupFilterConfig<TWorkItemFilterProperty>("state_group")({
        isEnabled: isFilterEnabled("state_group"),
        filterIcon: StatePropertyIcon,
        getOptionIcon: (stateGroupKey) => <StateGroupIcon stateGroup={stateGroupKey} />,
        ...operatorConfigs,
      }),
    [isFilterEnabled, operatorConfigs]
  );

  // state filter config
  const stateFilterConfig = useMemo(
    () =>
      getStateFilterConfig<TWorkItemFilterProperty>("state_id")({
        isEnabled: isFilterEnabled("state_id") && workItemStates !== undefined,
        filterIcon: StatePropertyIcon,
        getOptionIcon: (state) => <StateGroupIcon stateGroup={state.group} color={state.color} />,
        states: workItemStates ?? [],
        ...operatorConfigs,
      }),
    [isFilterEnabled, workItemStates, operatorConfigs]
  );

  const progressStatusFilterConfig = useMemo(
    () =>
      getProgressStatusFilterConfig<TWorkItemFilterProperty>("progress_status")({
        isEnabled: isFilterEnabled("progress_status") && projectId !== undefined,
        filterIcon: StatePropertyIcon,
        options: L3_PROGRESS_STATUS_OPTIONS.map((option) => ({
          value: option.value,
          label: option.label,
          color: progressPhaseColors[option.phase],
        })),
        getOptionIcon: (option) => (
          <span
            className={cn(
              "flex size-5 items-center justify-center rounded",
              isL3DoneProgressStatus(option.value) ? "bg-success-subtle" : undefined
            )}
          >
            <span className="size-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: option.color }} />
          </span>
        ),
        ...operatorConfigs,
      }),
    [isFilterEnabled, projectId, operatorConfigs, progressPhaseColors]
  );

  // label filter config
  const labelFilterConfig = useMemo(
    () =>
      getLabelFilterConfig<TWorkItemFilterProperty>("label_id")({
        isEnabled: isFilterEnabled("label_id") && workItemLabels !== undefined,
        filterIcon: LabelPropertyIcon,
        labels: workItemLabels ?? [],
        getOptionIcon: (color) => (
          <span className="flex size-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
        ),
        ...operatorConfigs,
      }),
    [isFilterEnabled, workItemLabels, operatorConfigs]
  );

  // cycle filter config
  const cycleFilterConfig = useMemo(
    () =>
      getCycleFilterConfig<TWorkItemFilterProperty>("cycle_id")({
        isEnabled: isFilterEnabled("cycle_id") && project?.cycle_view === true && cycles !== undefined,
        filterIcon: CycleIcon,
        getOptionIcon: (cycleGroup) => <CycleGroupIcon cycleGroup={cycleGroup} className="h-3.5 w-3.5 flex-shrink-0" />,
        cycles: cycles ?? [],
        ...operatorConfigs,
      }),
    [isFilterEnabled, project?.cycle_view, cycles, operatorConfigs]
  );

  // epic filter config (property key remains module_id)
  const moduleFilterConfig = useMemo(
    () =>
      getModuleFilterConfig<TWorkItemFilterProperty>("module_id")({
        isEnabled: isFilterEnabled("module_id") && project?.module_view === true && epics !== undefined,
        filterIcon: ModuleIcon,
        getOptionIcon: () => <ModuleIcon className="h-3 w-3 flex-shrink-0" />,
        epics: epics ?? [],
        ...operatorConfigs,
      }),
    [isFilterEnabled, project?.module_view, epics, operatorConfigs]
  );

  // assignee filter config
  const assigneeFilterConfig = useMemo(
    () =>
      getAssigneeFilterConfig<TWorkItemFilterProperty>("assignee_id")({
        isEnabled: isFilterEnabled("assignee_id") && members !== undefined,
        filterIcon: MembersPropertyIcon,
        members: members ?? [],
        getOptionIcon: (memberDetails) => (
          <Avatar
            name={memberDetails.display_name}
            src={getFileURL(memberDetails.avatar_url)}
            showTooltip={false}
            size="sm"
          />
        ),
        ...operatorConfigs,
      }),
    [isFilterEnabled, members, operatorConfigs]
  );

  // mention filter config
  const mentionFilterConfig = useMemo(
    () =>
      getMentionFilterConfig<TWorkItemFilterProperty>("mention_id")({
        isEnabled: isFilterEnabled("mention_id") && members !== undefined,
        filterIcon: AtSign,
        members: members ?? [],
        getOptionIcon: (memberDetails) => (
          <Avatar
            name={memberDetails.display_name}
            src={getFileURL(memberDetails.avatar_url)}
            showTooltip={false}
            size="sm"
          />
        ),
        ...operatorConfigs,
      }),
    [isFilterEnabled, members, operatorConfigs]
  );

  // created by filter config
  const createdByFilterConfig = useMemo(
    () =>
      getCreatedByFilterConfig<TWorkItemFilterProperty>("created_by_id")({
        isEnabled: isFilterEnabled("created_by_id") && members !== undefined,
        filterIcon: UserCirclePropertyIcon,
        members: members ?? [],
        getOptionIcon: (memberDetails) => (
          <Avatar
            name={memberDetails.display_name}
            src={getFileURL(memberDetails.avatar_url)}
            showTooltip={false}
            size="sm"
          />
        ),
        ...operatorConfigs,
      }),
    [isFilterEnabled, members, operatorConfigs]
  );

  // subscriber filter config
  const subscriberFilterConfig = useMemo(
    () =>
      getSubscriberFilterConfig<TWorkItemFilterProperty>("subscriber_id")({
        isEnabled: isFilterEnabled("subscriber_id") && members !== undefined,
        filterIcon: MembersPropertyIcon,
        members: members ?? [],
        getOptionIcon: (memberDetails) => (
          <Avatar
            name={memberDetails.display_name}
            src={getFileURL(memberDetails.avatar_url)}
            showTooltip={false}
            size="sm"
          />
        ),
        ...operatorConfigs,
      }),
    [isFilterEnabled, members, operatorConfigs]
  );

  // priority filter config
  const priorityFilterConfig = useMemo(
    () =>
      getPriorityFilterConfig<TWorkItemFilterProperty>("priority")({
        isEnabled: isFilterEnabled("priority"),
        filterIcon: PriorityPropertyIcon,
        getOptionIcon: (priority) => <PriorityIcon priority={priority} />,
        ...operatorConfigs,
      }),
    [isFilterEnabled, operatorConfigs]
  );

  // start date filter config
  const startDateFilterConfig = useMemo(
    () =>
      getStartDateFilterConfig<TWorkItemFilterProperty>("start_date")({
        isEnabled: true,
        filterIcon: StartDatePropertyIcon,
        ...operatorConfigs,
      }),
    [operatorConfigs]
  );

  // target date filter config
  const targetDateFilterConfig = useMemo(
    () =>
      getTargetDateFilterConfig<TWorkItemFilterProperty>("target_date")({
        isEnabled: true,
        filterIcon: DueDatePropertyIcon,
        ...operatorConfigs,
      }),
    [operatorConfigs]
  );

  // created at filter config
  const createdAtFilterConfig = useMemo(
    () =>
      getCreatedAtFilterConfig<TWorkItemFilterProperty>("created_at")({
        isEnabled: true,
        filterIcon: CalendarLayoutIcon,
        ...operatorConfigs,
      }),
    [operatorConfigs]
  );

  // updated at filter config
  const updatedAtFilterConfig = useMemo(
    () =>
      getUpdatedAtFilterConfig<TWorkItemFilterProperty>("updated_at")({
        isEnabled: true,
        filterIcon: CalendarLayoutIcon,
        ...operatorConfigs,
      }),
    [operatorConfigs]
  );

  // project filter config
  const projectFilterConfig = useMemo(
    () =>
      getProjectFilterConfig<TWorkItemFilterProperty>("project_id")({
        isEnabled: isFilterEnabled("project_id") && projects !== undefined,
        filterIcon: Briefcase,
        projects: projects,
        getOptionIcon: (projectOption) => <Logo logo={projectOption.logo_props} size={12} />,
        ...operatorConfigs,
      }),
    [isFilterEnabled, projects, operatorConfigs]
  );

  return {
    areAllConfigsInitialized,
    configs: [
      stateFilterConfig,
      progressStatusFilterConfig,
      stateGroupFilterConfig,
      assigneeFilterConfig,
      priorityFilterConfig,
      projectFilterConfig,
      mentionFilterConfig,
      labelFilterConfig,
      cycleFilterConfig,
      moduleFilterConfig,
      startDateFilterConfig,
      targetDateFilterConfig,
      createdAtFilterConfig,
      updatedAtFilterConfig,
      createdByFilterConfig,
      subscriberFilterConfig,
    ],
    configMap: {
      project_id: projectFilterConfig,
      state_group: stateGroupFilterConfig,
      state_id: stateFilterConfig,
      progress_status: progressStatusFilterConfig,
      label_id: labelFilterConfig,
      cycle_id: cycleFilterConfig,
      module_id: moduleFilterConfig,
      assignee_id: assigneeFilterConfig,
      mention_id: mentionFilterConfig,
      created_by_id: createdByFilterConfig,
      subscriber_id: subscriberFilterConfig,
      priority: priorityFilterConfig,
      start_date: startDateFilterConfig,
      target_date: targetDateFilterConfig,
      created_at: createdAtFilterConfig,
      updated_at: updatedAtFilterConfig,
    },
    isFilterEnabled,
    members: members ?? [],
  };
};
