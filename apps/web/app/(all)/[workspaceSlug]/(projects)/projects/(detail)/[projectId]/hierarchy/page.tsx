/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { isStagedGateScrumbanMode } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { PageHead } from "@/components/core/page-title";
import { HierarchyModulesListView } from "@/components/modules/hierarchy-modules-list-view";
import { useProject } from "@/hooks/store/use-project";

function ProjectHierarchyPage() {
  const { workspaceSlug, projectId } = useParams() as { workspaceSlug: string; projectId: string };
  const { t } = useTranslation();
  const { currentProjectDetails } = useProject();
  const isScrumban = isStagedGateScrumbanMode(currentProjectDetails?.workflow_mode);

  const pageTitle = currentProjectDetails?.name
    ? `${currentProjectDetails.name} - Milestones & Epics`
    : t("sidebar.hierarchy");

  if (!isScrumban) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <PageHead title={pageTitle} />
        <p className="text-13 text-tertiary">Milestones and epics are available on Staged-gate Scrumban projects.</p>
      </div>
    );
  }

  return (
    <>
      <PageHead title={pageTitle} />
      <div className="flex h-full w-full flex-col">
        <div className="flex flex-wrap items-end justify-between gap-3 px-page-x pt-4">
          <div className="space-y-1">
            <h1 className="text-18 font-semibold text-primary">Milestones & Epics</h1>
            <p className="text-13 text-tertiary">
              Create milestones, then group epics under them. Drag epics to reorder or move between groups.
            </p>
          </div>
          <Link
            href={`/${workspaceSlug}/settings/projects/${projectId}/hierarchy`}
            className="text-13 font-medium text-accent-primary hover:underline"
          >
            Manage hierarchy types
          </Link>
        </div>
        <HierarchyModulesListView />
      </div>
    </>
  );
}

export default observer(ProjectHierarchyPage);
