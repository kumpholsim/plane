/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useTranslation } from "@plane/i18n";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { ToggleSwitch } from "@plane/ui";
import { SettingsBoxedControlItem } from "@/components/settings/boxed-control-item";
import { useProject } from "@/hooks/store/use-project";

type Props = {
  workspaceSlug: string;
  projectId: string;
  isAdmin: boolean;
};

export const ManhourSwitch = observer(function ManhourSwitch(props: Props) {
  const { workspaceSlug, projectId, isAdmin } = props;
  const { t } = useTranslation();
  const { updateProject, currentProjectDetails } = useProject();
  const isEnabled = Boolean(currentProjectDetails?.is_manhour_enabled);

  const handleToggle = async () => {
    if (!workspaceSlug || !projectId || !isAdmin) return;

    try {
      await updateProject(workspaceSlug, projectId, {
        is_manhour_enabled: !isEnabled,
        ...(!isEnabled ? {} : { is_manhour_auto_convert_enabled: false }),
      });
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: t("common.success"),
        message: !isEnabled
          ? t("project_settings.estimates.manhour.toasts.enabled")
          : t("project_settings.estimates.manhour.toasts.disabled"),
      });
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("common.error"),
        message: t("project_settings.estimates.manhour.toasts.error"),
      });
    }
  };

  return (
    <SettingsBoxedControlItem
      title={t("project_settings.estimates.manhour.title")}
      description={t("project_settings.estimates.manhour.description")}
      control={<ToggleSwitch value={isEnabled} onChange={() => void handleToggle()} disabled={!isAdmin} size="sm" />}
    />
  );
});
