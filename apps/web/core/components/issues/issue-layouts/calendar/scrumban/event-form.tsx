/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
import { PROJECT_EVENT_COLOR_SWATCHES } from "@plane/types";
import { Button, Input } from "@plane/ui";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { useProjectEvent } from "@/hooks/store/use-project-event";
import { useScrumbanCalendar } from "./context";
import { dateKeyToEndISO, dateKeyToStartISO, toDateKey } from "./event-utils";

const MAX_COVER_BYTES = 900_000; // ~keep data-URL payloads reasonable

export const CalendarEventFormPopover = observer(function CalendarEventFormPopover() {
  const { workspaceSlug, projectId, draft, closeDraft, canEdit } = useScrumbanCalendar();
  const { createEvent, updateEvent, deleteEvent } = useProjectEvent();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isEdit = !!draft?.event;
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(PROJECT_EVENT_COLOR_SWATCHES[0]);
  const [startKey, setStartKey] = useState("");
  const [endKey, setEndKey] = useState("");
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!draft) return;
    setName(draft.event?.name ?? "");
    setColor(draft.event?.color ?? PROJECT_EVENT_COLOR_SWATCHES[0]);
    setStartKey(draft.event ? toDateKey(draft.event.start_at) : draft.startKey);
    setEndKey(draft.event ? toDateKey(draft.event.end_at) : draft.endKey);
    setCoverImage(draft.event?.cover_image ?? null);
  }, [draft]);

  if (!draft) return null;

  const isSingleDay = startKey === endKey || (startKey && endKey && startKey === endKey);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setToast({ type: TOAST_TYPE.ERROR, title: "Error!", message: "Please choose an image file." });
      return;
    }
    if (file.size > MAX_COVER_BYTES) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error!",
        message: "Image is too large (max ~900KB).",
      });
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") setCoverImage(reader.result);
    });
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!canEdit || !name.trim()) return;
    const start = startKey <= endKey ? startKey : endKey;
    const end = startKey <= endKey ? endKey : startKey;
    const singleDay = start === end;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        color,
        start_at: dateKeyToStartISO(start),
        end_at: dateKeyToEndISO(end),
        all_day: true,
        // Cover only applies to single-day events
        cover_image: singleDay ? coverImage : null,
      };
      if (isEdit && draft.event) {
        await updateEvent(workspaceSlug, projectId, draft.event.id, payload);
      } else {
        await createEvent(workspaceSlug, projectId, payload);
      }
      closeDraft();
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error!",
        message: isEdit ? "Could not update event." : "Could not create event.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!canEdit || !draft.event) return;
    setSaving(true);
    try {
      await deleteEvent(workspaceSlug, projectId, draft.event.id);
      closeDraft();
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error!",
        message: "Could not delete event.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    // oxlint-disable-next-line jsx_a11y/click-events-have-key-events, jsx_a11y/no-static-element-interactions
    <div className="fixed inset-0 z-30 flex items-start justify-center bg-black/20 pt-[20vh]" onClick={closeDraft}>
      {/* oxlint-disable-next-line jsx_a11y/click-events-have-key-events, jsx_a11y/no-static-element-interactions */}
      <div
        className="shadow-lg w-full max-w-sm rounded-md border border-subtle bg-surface-1 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-3 text-14 font-semibold text-primary">{isEdit ? "Edit event" : "New event"}</p>
        <div className="space-y-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Event name"
            disabled={!canEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSave();
              if (e.key === "Escape") closeDraft();
            }}
          />
          <div className="flex items-center gap-2">
            <Input type="date" value={startKey} onChange={(e) => setStartKey(e.target.value)} disabled={!canEdit} />
            <span className="text-11 text-tertiary">→</span>
            <Input type="date" value={endKey} onChange={(e) => setEndKey(e.target.value)} disabled={!canEdit} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PROJECT_EVENT_COLOR_SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                disabled={!canEdit}
                className="size-6 rounded-full border-2 transition-transform hover:scale-110"
                style={{
                  backgroundColor: swatch,
                  borderColor: color === swatch ? "var(--color-text-primary)" : "transparent",
                }}
                onClick={() => setColor(swatch)}
                aria-label={`Color ${swatch}`}
              />
            ))}
          </div>

          {isSingleDay && (
            <div className="space-y-2">
              <p className="text-11 font-medium text-secondary">Picture (single-day only)</p>
              {coverImage ? (
                <div className="relative overflow-hidden rounded-sm border border-subtle">
                  <img src={coverImage} alt="" className="h-28 w-full object-cover" />
                  {canEdit && (
                    <button
                      type="button"
                      className="absolute top-1.5 right-1.5 rounded-sm bg-black/60 px-1.5 py-0.5 text-10 text-white"
                      onClick={() => setCoverImage(null)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ) : (
                canEdit && (
                  <button
                    type="button"
                    className="w-full rounded-sm border border-dashed border-subtle px-3 py-4 text-11 text-secondary hover:bg-layer-1"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Upload picture
                  </button>
                )
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            {isEdit && canEdit ? (
              <Button variant="neutral-primary" size="sm" onClick={() => void handleDelete()} disabled={saving}>
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="neutral-primary" size="sm" onClick={closeDraft} disabled={saving}>
                Cancel
              </Button>
              {canEdit && (
                <Button variant="primary" size="sm" onClick={() => void handleSave()} disabled={saving || !name.trim()}>
                  {isEdit ? "Save" : "Create"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
