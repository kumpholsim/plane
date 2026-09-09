/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { usePopper } from "react-popper";
import { Combobox } from "@headlessui/react";
import { L3_PROGRESS_PHASE_FALLBACK_COLORS, L3_PROGRESS_STATUS_OPTIONS, type TL3ProgressPhase } from "@plane/constants";
import { CheckIcon, ChevronDownIcon, SearchIcon } from "@plane/propel/icons";
import type { TDeliveryProgressStatus } from "@plane/types";
import { HIERARCHY_LEVEL_SUB_TASK } from "@plane/types";
import { ComboDropDown } from "@plane/ui";
import { cn } from "@plane/utils";
import { DropdownButton } from "@/components/dropdowns/buttons";
import { getL3ProgressStatusColor } from "@/components/issues/hierarchy-status";
import { BUTTON_VARIANTS_WITH_TEXT } from "@/components/dropdowns/constants";
import type { TDropdownProps } from "@/components/dropdowns/types";
import { useDropdown } from "@/hooks/use-dropdown";
import { useProjectHierarchyType } from "@/hooks/store/use-project-hierarchy-type";

type Props = TDropdownProps & {
  value: TDeliveryProgressStatus | null | undefined;
  onChange: (value: TDeliveryProgressStatus) => void;
  projectId?: string | null;
  dropdownArrow?: boolean;
  dropdownArrowClassName?: string;
};

const phaseFromValue = (value: string | null | undefined): TL3ProgressPhase | null => {
  const option = L3_PROGRESS_STATUS_OPTIONS?.find((o) => o.value === value);
  return option?.phase ?? null;
};

export const ProgressStatusDropdown = observer(function ProgressStatusDropdown(props: Props) {
  const {
    value,
    onChange,
    projectId,
    disabled = false,
    buttonVariant = "transparent-with-text",
    buttonClassName,
    buttonContainerClassName,
    className = "",
    dropdownArrow = false,
    dropdownArrowClassName = "",
    placement,
    tabIndex,
    showTooltip = false,
  } = props;

  const { workspaceSlug } = useParams();
  const { getActiveProjectTypes, fetchProjectTypes, fetchedMap } = useProjectHierarchyType();

  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [referenceElement, setReferenceElement] = useState<HTMLButtonElement | null>(null);
  const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!workspaceSlug || !projectId || fetchedMap[projectId]) return;
    void fetchProjectTypes(workspaceSlug.toString(), projectId);
  }, [workspaceSlug, projectId, fetchedMap, fetchProjectTypes]);

  const phaseColors = useMemo(() => {
    const colors: Record<TL3ProgressPhase, string> = {
      design: L3_PROGRESS_PHASE_FALLBACK_COLORS?.design ?? "#F97316",
      dev: L3_PROGRESS_PHASE_FALLBACK_COLORS?.dev ?? "#3B82F6",
      qa: L3_PROGRESS_PHASE_FALLBACK_COLORS?.qa ?? "#22C55E",
    };
    if (!projectId) return colors;
    const l4Types = getActiveProjectTypes(projectId, HIERARCHY_LEVEL_SUB_TASK) ?? [];
    for (const type of l4Types) {
      const key = (type.name ?? "").trim().toLowerCase();
      if (key === "design" || key === "dev" || key === "qa") {
        colors[key] = type.color || colors[key];
      }
    }
    return colors;
  }, [projectId, getActiveProjectTypes]);

  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    placement: placement ?? "bottom-start",
    modifiers: [{ name: "preventOverflow", options: { padding: 12 } }],
  });

  const { handleClose, handleOnClick, searchInputKeyDown } = useDropdown({
    dropdownRef,
    inputRef,
    isOpen,
    onOpen: undefined,
    query,
    setIsOpen,
    setQuery,
  });

  const options = L3_PROGRESS_STATUS_OPTIONS ?? [];
  const selected = options.find((o) => o.value === value);
  const selectedPhase = phaseFromValue(value);
  const selectedColor = getL3ProgressStatusColor(
    value,
    selectedPhase ? { ...phaseColors, [selectedPhase]: phaseColors[selectedPhase] } : phaseColors
  );

  const filteredOptions =
    query === "" ? options : options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()));

  const dropdownOnChange = (val: TDeliveryProgressStatus) => {
    onChange(val);
    handleClose();
  };

  const comboButton = (
    <button
      tabIndex={tabIndex}
      ref={setReferenceElement}
      type="button"
      className={cn(
        "clickable block h-full max-w-full outline-none",
        {
          "cursor-not-allowed text-secondary": disabled,
          "cursor-pointer": !disabled,
        },
        buttonContainerClassName
      )}
      onClick={handleOnClick}
      disabled={disabled}
    >
      <DropdownButton
        className={buttonClassName}
        isActive={isOpen}
        tooltipHeading="Progress"
        tooltipContent={selected?.label ?? "Progress"}
        showTooltip={showTooltip}
        variant={buttonVariant}
      >
        <span className="size-3.5 flex-shrink-0 rounded-full" style={{ backgroundColor: selectedColor }} aria-hidden />
        {BUTTON_VARIANTS_WITH_TEXT.includes(buttonVariant) && (
          <span className="flex-grow truncate text-left">{selected?.label ?? "Select progress"}</span>
        )}
        {dropdownArrow && (
          <ChevronDownIcon className={cn("h-2.5 w-2.5 flex-shrink-0", dropdownArrowClassName)} aria-hidden="true" />
        )}
      </DropdownButton>
    </button>
  );

  return (
    // oxlint-disable-next-line jsx_a11y/no-static-element-interactions
    <ComboDropDown
      as="div"
      ref={dropdownRef}
      className={cn("h-full w-full", className)}
      value={value ?? null}
      onChange={dropdownOnChange}
      disabled={disabled}
      button={comboButton}
    >
      {isOpen && (
        <Combobox.Options className="fixed z-20" static>
          <div
            className="shadow-md my-1 max-h-72 w-60 overflow-y-auto rounded-md border-[0.5px] border-subtle bg-surface-1"
            ref={setPopperElement}
            style={styles.popper}
            {...attributes.popper}
          >
            <div className="sticky top-0 z-10 flex items-center gap-1.5 bg-surface-1 px-2.5 py-2">
              <SearchIcon className="size-3.5 text-placeholder" />
              <Combobox.Input
                as="input"
                ref={inputRef}
                className="w-full bg-transparent text-body-xs-regular outline-none placeholder:text-placeholder"
                placeholder="Search"
                displayValue={() => query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={searchInputKeyDown}
              />
            </div>
            <div className="space-y-0.5 px-1.5 pb-1.5">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => {
                  const color = getL3ProgressStatusColor(option.value, phaseColors);
                  return (
                    <Combobox.Option
                      key={option.value}
                      value={option.value}
                      className={({ active, selected: isSelected }) =>
                        cn(
                          "flex w-full cursor-pointer items-center justify-between gap-2 truncate rounded px-1.5 py-1.5 text-body-xs-regular select-none",
                          {
                            "bg-surface-2": active,
                            "text-primary": isSelected,
                            "text-secondary": !isSelected,
                          }
                        )
                      }
                    >
                      {({ selected: isSelected }) => (
                        <>
                          <span className="flex min-w-0 items-center gap-2">
                            <span
                              className="size-3.5 flex-shrink-0 rounded-full"
                              style={{ backgroundColor: color }}
                              aria-hidden
                            />
                            <span className="truncate">{option.label}</span>
                          </span>
                          {isSelected && <CheckIcon className="size-3.5 flex-shrink-0" />}
                        </>
                      )}
                    </Combobox.Option>
                  );
                })
              ) : (
                <p className="px-1.5 py-1 text-body-xs-regular text-tertiary">No matches</p>
              )}
            </div>
          </div>
        </Combobox.Options>
      )}
    </ComboDropDown>
  );
});
