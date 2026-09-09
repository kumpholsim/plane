/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { redirect } from "react-router";
import type { Route } from "./+types/page";

/** Legacy Sub-task categories URL → Hierarchy settings */
export const clientLoader = ({ params }: Route.ClientLoaderArgs) => {
  const { workspaceSlug, projectId } = params;
  throw redirect(`/${workspaceSlug}/settings/projects/${projectId}/hierarchy/`);
};

export default function SubWorkItemCategoriesRedirect() {
  return null;
}
