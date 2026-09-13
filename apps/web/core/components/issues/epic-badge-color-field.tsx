/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Popover, Transition } from "@headlessui/react";
import * as React from "react";
import * as ColorPicker from "react-color";
import type { ColorResult } from "react-color";
import { usePopper } from "react-popper";
import { DEFAULT_EPIC_BADGE_COLOR, EPIC_BADGE_GRADIENT_PRESETS, isEpicBadgeGradient } from "@plane/constants";
import { Button, Input } from "@plane/ui";
import { cn } from "@plane/utils";

type Props = {
  value: string | null | undefined;
  disabled?: boolean;
  inputName: string;
  onChange: (next: string | null) => void;
};

type TMode = "solid" | "gradient";

const DEFAULT_GRADIENT_B = "#EC4899";

const extractHexStops = (value: string): [string, string] => {
  const hexes = value.match(/#[0-9A-Fa-f]{3,8}\b/g);
  if (hexes && hexes.length >= 2) return [hexes[0], hexes[1]];
  if (hexes && hexes.length === 1) return [hexes[0], DEFAULT_GRADIENT_B];
  return [DEFAULT_EPIC_BADGE_COLOR, DEFAULT_GRADIENT_B];
};

const buildGradient = (from: string, to: string) => `linear-gradient(90deg, ${from}, ${to})`;

/** Solid + custom gradient via always-visible paintboard (no Solid toggle that hides the picker). */
export function EpicBadgeColorField(props: Props) {
  const { value, disabled, inputName, onChange } = props;
  const resolved = value?.trim() || DEFAULT_EPIC_BADGE_COLOR;
  const gradient = isEpicBadgeGradient(resolved);

  const [mode, setMode] = React.useState<TMode>(gradient ? "gradient" : "solid");
  const [from, setFrom] = React.useState(() => (gradient ? extractHexStops(resolved)[0] : resolved));
  const [to, setTo] = React.useState(() => (gradient ? extractHexStops(resolved)[1] : DEFAULT_GRADIENT_B));
  const [activeStop, setActiveStop] = React.useState<"from" | "to">("from");
  const [referenceElement, setReferenceElement] = React.useState<HTMLButtonElement | null>(null);
  const [popperElement, setPopperElement] = React.useState<HTMLDivElement | null>(null);

  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    placement: "bottom-end",
  });

  // Keep local stops in sync when parent value changes (e.g. after save / reopen).
  React.useEffect(() => {
    if (isEpicBadgeGradient(resolved)) {
      const [a, b] = extractHexStops(resolved);
      setFrom(a);
      setTo(b);
      setMode("gradient");
      return;
    }
    setFrom(resolved);
    setMode("solid");
  }, [resolved]);

  const sketchColor = mode === "solid" ? (gradient ? from : resolved) : activeStop === "from" ? from : to;

  const commitSolid = (hex: string) => {
    setMode("solid");
    setFrom(hex);
    onChange(hex);
  };

  const commitGradient = (nextFrom: string, nextTo: string) => {
    setMode("gradient");
    setFrom(nextFrom);
    setTo(nextTo);
    onChange(buildGradient(nextFrom, nextTo));
  };

  const handleSketchChange = (result: ColorResult) => {
    if (disabled) return;
    const hex = result.hex;
    if (mode === "solid") {
      commitSolid(hex);
      return;
    }
    if (activeStop === "from") commitGradient(hex, to);
    else commitGradient(from, hex);
  };

  const handleModeChange = (next: TMode) => {
    if (disabled) return;
    setMode(next);
    if (next === "solid") {
      commitSolid(from || DEFAULT_EPIC_BADGE_COLOR);
      return;
    }
    commitGradient(from || DEFAULT_EPIC_BADGE_COLOR, to || DEFAULT_GRADIENT_B);
  };

  return (
    <div className="relative flex w-full items-center gap-2 px-1">
      <span className="size-4 shrink-0 rounded-sm border border-subtle" style={{ background: resolved }} aria-hidden />
      <div className="relative w-full">
        <Input
          id={inputName}
          name={inputName}
          type="text"
          value={resolved}
          placeholder={DEFAULT_EPIC_BADGE_COLOR}
          hasError={false}
          disabled={disabled}
          className="h-7.5 w-full border-[0.5px] border-subtle pr-8 text-body-xs-regular"
          onChange={(e) => {
            if (disabled) return;
            onChange(e.target.value?.trim() || null);
          }}
        />
        <Popover as="div" className="absolute top-1/2 right-1 z-10 -translate-y-1/2">
          {() => (
            <>
              <Popover.Button as={React.Fragment}>
                <Button
                  ref={setReferenceElement}
                  variant="neutral-primary"
                  className="border-none !bg-transparent"
                  disabled={disabled}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="lucide lucide-palette"
                  >
                    <circle cx="13.5" cy="6.5" r=".5" />
                    <circle cx="17.5" cy="10.5" r=".5" />
                    <circle cx="8.5" cy="7.5" r=".5" />
                    <circle cx="6.5" cy="12.5" r=".5" />
                    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
                  </svg>
                </Button>
              </Popover.Button>
              <Transition
                as={React.Fragment}
                enter="transition ease-out duration-200"
                enterFrom="opacity-0 translate-y-1"
                enterTo="opacity-100 translate-y-0"
                leave="transition ease-in duration-150"
                leaveFrom="opacity-100 translate-y-0"
                leaveTo="opacity-0 translate-y-1"
              >
                <Popover.Panel>
                  <div
                    className="z-20 w-[240px] overflow-hidden rounded-sm border border-subtle bg-surface-1 p-2 shadow-raised-200"
                    ref={setPopperElement}
                    style={styles.popper}
                    {...attributes.popper}
                  >
                    <div className="mb-2 flex gap-1 rounded-sm bg-surface-2 p-0.5">
                      <button
                        type="button"
                        className={cn(
                          "flex-1 rounded-sm px-2 py-1 text-11 font-medium",
                          mode === "solid" ? "shadow-sm bg-surface-1 text-primary" : "text-secondary"
                        )}
                        onClick={() => handleModeChange("solid")}
                      >
                        Solid
                      </button>
                      <button
                        type="button"
                        className={cn(
                          "flex-1 rounded-sm px-2 py-1 text-11 font-medium",
                          mode === "gradient" ? "shadow-sm bg-surface-1 text-primary" : "text-secondary"
                        )}
                        onClick={() => handleModeChange("gradient")}
                      >
                        Gradient
                      </button>
                    </div>

                    {mode === "gradient" && (
                      <div className="mb-2 space-y-2">
                        <div
                          className="h-6 w-full rounded-sm border border-subtle"
                          style={{ background: buildGradient(from, to) }}
                          aria-hidden
                        />
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            className={cn(
                              "flex flex-1 items-center gap-1.5 rounded-sm border px-1.5 py-1 text-11",
                              activeStop === "from" ? "border-accent-primary" : "border-subtle"
                            )}
                            onClick={() => setActiveStop("from")}
                          >
                            <span
                              className="size-3.5 shrink-0 rounded-sm border border-subtle"
                              style={{ background: from }}
                            />
                            From
                          </button>
                          <button
                            type="button"
                            className={cn(
                              "flex flex-1 items-center gap-1.5 rounded-sm border px-1.5 py-1 text-11",
                              activeStop === "to" ? "border-accent-primary" : "border-subtle"
                            )}
                            onClick={() => setActiveStop("to")}
                          >
                            <span
                              className="size-3.5 shrink-0 rounded-sm border border-subtle"
                              style={{ background: to }}
                            />
                            To
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1" role="listbox" aria-label="Gradient presets">
                          {EPIC_BADGE_GRADIENT_PRESETS.map((preset) => {
                            const selected = resolved === preset;
                            return (
                              <button
                                key={preset}
                                type="button"
                                role="option"
                                aria-selected={selected}
                                title="Preset"
                                className={cn(
                                  "size-5 shrink-0 rounded-sm border border-subtle",
                                  selected && "ring-accent-primary ring-offset-surface-1 ring-1 ring-offset-1"
                                )}
                                style={{ background: preset }}
                                onClick={() => {
                                  const [a, b] = extractHexStops(preset);
                                  commitGradient(a, b);
                                }}
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="[&_.sketch-picker]:!w-full [&_.sketch-picker]:!rounded-none [&_.sketch-picker]:!bg-transparent [&_.sketch-picker]:!p-0 [&_.sketch-picker]:!shadow-none">
                      <ColorPicker.SketchPicker color={sketchColor} onChange={handleSketchChange} width="224px" />
                    </div>
                  </div>
                </Popover.Panel>
              </Transition>
            </>
          )}
        </Popover>
      </div>
    </div>
  );
}
