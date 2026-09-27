/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { useTranslation } from "@plane/i18n";
import { Input } from "@plane/ui";
import { cn } from "@plane/utils";

type Props = {
  value: number | null | undefined;
  disabled?: boolean;
  onChange: (value: number | null) => void;
  variant?: "compact" | "sidebar";
  className?: string;
};

const toDraft = (value: number | null | undefined) => (value == null ? "" : String(value));

export function ManhourField(props: Props) {
  const { value, disabled = false, onChange, variant = "compact", className } = props;
  const { t } = useTranslation();
  const [draft, setDraft] = useState(toDraft(value));

  useEffect(() => {
    setDraft(toDraft(value));
  }, [value]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === "") {
      if (value != null) onChange(null);
      else setDraft("");
      return;
    }
    const parsed = Number(trimmed);
    if (Number.isNaN(parsed) || parsed < 0) {
      setDraft(toDraft(value));
      return;
    }
    if (parsed !== value) onChange(parsed);
  };

  return (
    <Input
      type="number"
      min={0}
      step={0.5}
      value={draft}
      disabled={disabled}
      placeholder={variant === "compact" ? "–" : t("common.none")}
      inputSize="xs"
      mode="true-transparent"
      aria-label={t("common.manhour")}
      className={cn(
        "bg-transparent",
        variant === "compact"
          ? "h-5 w-10 px-0 text-11 font-semibold text-secondary"
          : cn("h-7.5 w-full px-2 text-body-xs-regular", draft === "" ? "text-placeholder" : "text-primary"),
        className
      )}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}
