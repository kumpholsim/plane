/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslation } from "@plane/i18n";
import { HIERARCHY_LEVEL_LABELS } from "@plane/types";
import { PageHead } from "@/components/core/page-title";
import { useProject } from "@/hooks/store/use-project";
import { useProjectHierarchyType } from "@/hooks/store/use-project-hierarchy-type";

const LEVELS = [1, 2, 3, 4] as const;

const LEVEL_GUIDE: Record<(typeof LEVELS)[number], string> = {
  1: "Create Milestones as top-level planning containers.",
  2: "Add Epics under a Milestone (or as roots).",
  3: "Break Epics into Stories, Bugs, Story-bugs, and Tasks.",
  4: "Split delivery work into Design, Dev, QA (or custom) sub-tasks.",
};

function ProjectHierarchyPage() {
  const { workspaceSlug, projectId } = useParams() as { workspaceSlug: string; projectId: string };
  const { t } = useTranslation();
  const { currentProjectDetails } = useProject();
  const { fetchProjectTypes, getProjectTypes, getActiveProjectTypes, fetchedMap } = useProjectHierarchyType();

  useEffect(() => {
    if (!workspaceSlug || !projectId || fetchedMap[projectId]) return;
    void fetchProjectTypes(workspaceSlug, projectId);
  }, [workspaceSlug, projectId, fetchedMap, fetchProjectTypes]);

  const pageTitle = currentProjectDetails?.name
    ? `${currentProjectDetails.name} - ${t("sidebar.hierarchy")}`
    : t("sidebar.hierarchy");

  return (
    <div className="h-full w-full overflow-y-auto px-6 py-6">
      <PageHead title={pageTitle} />
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="space-y-1">
          <h1 className="text-18 font-semibold text-primary">{t("sidebar.hierarchy")}</h1>
          <p className="text-13 text-tertiary">
            Fixed four-level hierarchy. Customize types under each level in project settings.
          </p>
          <Link
            href={`/${workspaceSlug}/settings/projects/${projectId}/hierarchy`}
            className="inline-block text-13 font-medium text-accent-primary hover:underline"
          >
            Manage hierarchy types
          </Link>
        </div>

        <div className="space-y-4">
          {LEVELS.map((level) => {
            const types = getActiveProjectTypes(projectId, level) ?? getProjectTypes(projectId, level) ?? [];
            return (
              <section key={level} className="rounded-md border border-subtle p-4">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h2 className="text-14 font-semibold text-primary">
                    Level {level}: {HIERARCHY_LEVEL_LABELS[level]}
                  </h2>
                  <span className="text-12 text-tertiary">{types.length} types</span>
                </div>
                <p className="mb-3 text-12 text-tertiary">{LEVEL_GUIDE[level]}</p>
                <div className="flex flex-wrap gap-2">
                  {types.map((item) => (
                    <span
                      key={item.id}
                      className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-12 font-medium text-white"
                      style={{ backgroundColor: item.color }}
                    >
                      {item.name}
                    </span>
                  ))}
                  {types.length === 0 && (
                    <span className="text-12 text-placeholder">No active types — configure in settings.</span>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default observer(ProjectHierarchyPage);
