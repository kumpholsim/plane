/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { MANHOUR_HOURS_PER_SP } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { AlertModalCore, ToggleSwitch } from "@plane/ui";
import { SettingsBoxedControlItem } from "@/components/settings/boxed-control-item";
import { useProject } from "@/hooks/store/use-project";

type Props = {
  workspaceSlug: string;
  projectId: string;
  isAdmin: boolean;
};

export const ManhourAutoConvertSwitch = observer(function ManhourAutoConvertSwitch(props: Props) {
  const { workspaceSlug, projectId, isAdmin } = props;
  const { t } = useTranslation();
  const { updateProject, currentProjectDetails } = useProject();
  const isEnabled = Boolean(currentProjectDetails?.is_manhour_auto_convert_enabled);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const persist = async (next: boolean) => {
    await updateProject(workspaceSlug, projectId, {
      is_manhour_auto_convert_enabled: next,
    });
    setToast({
      type: TOAST_TYPE.SUCCESS,
      title: t("common.success"),
      message: next
        ? t("project_settings.estimates.manhour.auto_convert.toasts.enabled")
        : t("project_settings.estimates.manhour.auto_convert.toasts.disabled"),
    });
  };

  const handleToggle = () => {
    if (!workspaceSlug || !projectId || !isAdmin) return;
    if (!isEnabled) {
      setIsConfirmOpen(true);
      return;
    }
    void persist(false).catch(() => {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("common.error"),
        message: t("project_settings.estimates.manhour.auto_convert.toasts.error"),
      });
    });
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await persist(true);
      setIsConfirmOpen(false);
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("common.error"),
        message: t("project_settings.estimates.manhour.auto_convert.toasts.error"),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <SettingsBoxedControlItem
        title={t("project_settings.estimates.manhour.auto_convert.title")}
        description={t("project_settings.estimates.manhour.auto_convert.description", {
          hours: MANHOUR_HOURS_PER_SP,
        })}
        control={<ToggleSwitch value={isEnabled} onChange={handleToggle} disabled={!isAdmin} size="sm" />}
      />
      <AlertModalCore
        isOpen={isConfirmOpen}
        isSubmitting={isSubmitting}
        handleClose={() => setIsConfirmOpen(false)}
        handleSubmit={() => void handleConfirm()}
        variant="primary"
        title={t("project_settings.estimates.manhour.auto_convert.modal.title")}
        content={t("project_settings.estimates.manhour.auto_convert.modal.content", {
          hours: MANHOUR_HOURS_PER_SP,
        })}
        primaryButtonText={{
          default: t("project_settings.estimates.manhour.auto_convert.modal.confirm"),
          loading: t("project_settings.estimates.manhour.auto_convert.modal.confirming"),
        }}
      />
    </>
  );
});
