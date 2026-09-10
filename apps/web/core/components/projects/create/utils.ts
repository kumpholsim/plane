/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { PROJECT_WORKFLOW_MODE, RANDOM_EMOJI_CODES } from "@plane/constants";
import type { IProject, TProjectWorkflowMode } from "@plane/types";
import { getRandomCoverImage } from "@/helpers/cover-image.helper";

export const getProjectFormValues = (
  workflowMode: TProjectWorkflowMode = PROJECT_WORKFLOW_MODE.SCRUM
): Partial<IProject> => {
  const base: Partial<IProject> = {
    cover_image_url: getRandomCoverImage(),
    description: "",
    logo_props: {
      in_use: "emoji",
      emoji: {
        value: RANDOM_EMOJI_CODES[Math.floor(Math.random() * RANDOM_EMOJI_CODES.length)],
      },
    },
    identifier: "",
    name: "",
    network: 2,
    project_lead: null,
    workflow_mode: workflowMode,
    page_view: true,
  };

  if (workflowMode === PROJECT_WORKFLOW_MODE.STAGED_GATE_SCRUMBAN) {
    return {
      ...base,
      cycle_view: true,
      module_view: true,
      issue_views_view: true,
      inbox_view: true,
    };
  }

  return {
    ...base,
    cycle_view: false,
    module_view: false,
    issue_views_view: false,
    inbox_view: false,
  };
};
