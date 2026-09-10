/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useCallback, useMemo } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { EUserPermissionsLevel, EUserPermissions, isStagedGateScrumbanMode } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { CycleIcon, IntakeIcon, LayersIcon, ModuleIcon, PageIcon, ViewsIcon, WorkItemsIcon } from "@plane/propel/icons";
import type { EUserProjectRoles } from "@plane/types";
// plane ui
// components
import { SidebarNavItem } from "@/components/sidebar/sidebar-navigation";
// hooks
import { isEpicWorkItem, isModulesTabWorkItem } from "@/components/issues/issue-detail-widgets/sub-issues/depth";
import { useAppTheme } from "@/hooks/store/use-app-theme";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";

export type TNavigationItem = {
  name: string;
  href: string;
  icon: React.ElementType;
  access: EUserPermissions[] | EUserProjectRoles[];
  shouldRender: boolean;
  sortOrder: number;
  i18n_key: string;
  key: string;
};

type TProjectItemsProps = {
  workspaceSlug: string;
  projectId: string;
  additionalNavigationItems?: (workspaceSlug: string, projectId: string) => TNavigationItem[];
};

export const ProjectNavigation = observer(function ProjectNavigation(props: TProjectItemsProps) {
  const { workspaceSlug, projectId, additionalNavigationItems } = props;
  const { workItem: workItemIdentifierFromRoute } = useParams();
  // store hooks
  const { t } = useTranslation();
  const { isExtendedProjectSidebarOpened, toggleExtendedProjectSidebar, toggleSidebar } = useAppTheme();
  const { getPartialProjectById } = useProject();
  const { allowPermissions } = useUserPermissions();
  const {
    issue: { getIssueIdByIdentifier, getIssueById },
  } = useIssueDetail();
  // pathname
  const pathname = usePathname();
  // derived values
  const workItemId = workItemIdentifierFromRoute
    ? getIssueIdByIdentifier(workItemIdentifierFromRoute?.toString())
    : undefined;
  const workItem = workItemId ? getIssueById(workItemId) : undefined;
  const project = getPartialProjectById(projectId);
  const isScrumban = isStagedGateScrumbanMode(project?.workflow_mode);
  // handlers
  const handleProjectClick = () => {
    if (window.innerWidth < 768) {
      toggleSidebar();
    }
    // close the extended sidebar if it is open
    if (isExtendedProjectSidebarOpened) {
      toggleExtendedProjectSidebar(false);
    }
  };

  const baseNavigation = useCallback(
    (slug: string, id: string): TNavigationItem[] => [
      {
        i18n_key: "sidebar.work_items",
        key: "work_items",
        name: "Work items",
        href: `/${slug}/projects/${id}/issues`,
        icon: WorkItemsIcon,
        access: [EUserPermissions.ADMIN, EUserPermissions.MEMBER, EUserPermissions.GUEST],
        shouldRender: !isScrumban,
        sortOrder: 1,
      },
      {
        i18n_key: "sidebar.cycles",
        key: "cycles",
        name: "Cycles",
        href: `/${slug}/projects/${id}/cycles`,
        icon: CycleIcon,
        access: [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
        shouldRender: project?.cycle_view ?? false,
        sortOrder: 2,
      },
      {
        i18n_key: "sidebar.modules",
        key: "modules",
        name: "Modules",
        href: `/${slug}/projects/${id}/modules`,
        icon: ModuleIcon,
        access: [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
        shouldRender: project?.module_view ?? false,
        sortOrder: 3,
      },
      {
        i18n_key: "sidebar.views",
        key: "views",
        name: "Views",
        href: `/${slug}/projects/${id}/views`,
        icon: ViewsIcon,
        access: [EUserPermissions.ADMIN, EUserPermissions.MEMBER, EUserPermissions.GUEST],
        shouldRender: project?.issue_views_view ?? false,
        sortOrder: 4,
      },
      {
        i18n_key: "sidebar.pages",
        key: "pages",
        name: "Pages",
        href: `/${slug}/projects/${id}/pages`,
        icon: PageIcon,
        access: [EUserPermissions.ADMIN, EUserPermissions.MEMBER, EUserPermissions.GUEST],
        shouldRender: project?.page_view ?? false,
        sortOrder: 5,
      },
      {
        i18n_key: "sidebar.intake",
        key: "intake",
        name: "Intake",
        href: `/${slug}/projects/${id}/intake`,
        icon: IntakeIcon,
        access: [EUserPermissions.ADMIN, EUserPermissions.MEMBER, EUserPermissions.GUEST],
        shouldRender: project?.inbox_view ?? false,
        sortOrder: 6,
      },
      {
        i18n_key: "sidebar.hierarchy",
        key: "hierarchy",
        name: "Hierarchy",
        href: `/${slug}/projects/${id}/hierarchy`,
        icon: LayersIcon,
        access: [EUserPermissions.ADMIN, EUserPermissions.MEMBER, EUserPermissions.GUEST],
        shouldRender: isScrumban,
        sortOrder: 7,
      },
    ],
    [isScrumban, project]
  );

  // memoized navigation items and adding additional navigation items
  const navigationItemsMemo = useMemo(() => {
    const navigationItems = (slug: string, id: string): TNavigationItem[] => {
      const navItems = baseNavigation(slug, id);

      if (additionalNavigationItems) {
        navItems.push(...additionalNavigationItems(slug, id));
      }

      return navItems;
    };

    // sort navigation items by sortOrder
    const sortedNavigationItems = navigationItems(workspaceSlug, projectId).toSorted(
      (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)
    );

    return sortedNavigationItems;
  }, [workspaceSlug, projectId, baseNavigation, additionalNavigationItems]);

  const isActive = useCallback(
    (item: TNavigationItem) => {
      const belongsToProject = Boolean(workItemId && workItem && workItem.project_id === projectId);
      // Only Scrumban routes milestones and epics through the Modules tab
      const isModulesItem = isScrumban && belongsToProject && isModulesTabWorkItem(workItem);
      const isEpicItem = belongsToProject && isEpicWorkItem(workItem);
      const isWorkItemActive = item.key === "work_items" && belongsToProject && !isModulesItem && !isEpicItem;
      const isEpicActive = item.key === "epics" && isEpicItem;
      const isModuleActive = item.key === "modules" && isModulesItem;
      const isPathnameActive = pathname.includes(item.href);
      return isWorkItemActive || isEpicActive || isModuleActive || isPathnameActive;
    },
    [isScrumban, pathname, workItem, workItemId, projectId]
  );

  if (!project) return null;

  return (
    <>
      {navigationItemsMemo.map((item) => {
        if (!item.shouldRender) return;

        const hasAccess = allowPermissions(item.access, EUserPermissionsLevel.PROJECT, workspaceSlug, project.id);
        if (!hasAccess) return null;

        const shouldShowCount = item.key === "intake" && (project.intake_count ?? 0) > 0;

        return (
          <Link key={item.key} href={item.href} onClick={handleProjectClick}>
            <SidebarNavItem isActive={!!isActive(item)}>
              <div className="flex w-full items-center justify-between gap-1.5 py-[1px]">
                <div className="flex items-center gap-1.5">
                  <item.icon
                    className={`size-4 flex-shrink-0 ${item.name === "Intake" ? "stroke-1" : "stroke-[1.5]"}`}
                  />
                  <span className="text-11 font-medium">{t(item.i18n_key)}</span>
                </div>
                {shouldShowCount && <span className="text-11 font-medium text-tertiary">{project.intake_count}</span>}
              </div>
            </SidebarNavItem>
          </Link>
        );
      })}
    </>
  );
});
