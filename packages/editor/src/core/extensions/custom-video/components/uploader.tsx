/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Film, RotateCcw } from "lucide-react";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { cn } from "@plane/utils";
import { ACCEPTED_VIDEO_MIME_TYPES } from "@/constants/config";
import { CORE_EXTENSIONS } from "@/constants/extension";
import type { EFileError } from "@/helpers/file";
import { useUploader, useDropZone, uploadFirstFileAndInsertRemaining } from "@/hooks/use-file-upload";
import { ECustomVideoStatus } from "../types";
import { getVideoComponentFileMap } from "../utils";
import type { CustomVideoNodeViewProps } from "./node-view";

type Props = CustomVideoNodeViewProps & {
  failedToLoadVideo: boolean;
  loadVideoFromFileSystem: (file: string) => void;
  maxFileSize: number;
  setIsUploaded: (isUploaded: boolean) => void;
};

export function CustomVideoUploader(props: Props) {
  const {
    editor,
    extension,
    failedToLoadVideo,
    getPos,
    loadVideoFromFileSystem,
    maxFileSize,
    node,
    selected,
    setIsUploaded,
    updateAttributes,
  } = props;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasTriggeredFilePickerRef = useRef(false);
  const hasTriedUploadingOnMountRef = useRef(false);
  const { id: videoEntityId } = node.attrs;
  const videoComponentFileMap = useMemo(() => getVideoComponentFileMap(editor), [editor]);
  const isTouchDevice = !!editor.storage.utility.isTouchDevice;

  const onUpload = useCallback(
    (url: string) => {
      if (!url || !videoEntityId) return;
      setIsUploaded(true);
      updateAttributes({
        src: url,
        status: ECustomVideoStatus.UPLOADED,
      });
      videoComponentFileMap?.delete(videoEntityId);

      const pos = getPos();
      const getCurrentSelection = editor.state.selection;
      const currentNode = editor.state.doc.nodeAt(getCurrentSelection.from);
      if (
        currentNode &&
        currentNode.type.name === node.type.name &&
        currentNode.attrs.src === url &&
        pos !== undefined
      ) {
        const nextNode = editor.state.doc.nodeAt(pos + 1);
        if (nextNode && nextNode.type.name === CORE_EXTENSIONS.PARAGRAPH) {
          editor.commands.setTextSelection(pos + 1);
        } else {
          editor.commands.createParagraphNear();
        }
      }
    },
    [editor, getPos, node.type.name, setIsUploaded, updateAttributes, videoComponentFileMap, videoEntityId]
  );

  const uploadVideoEditorCommand = useCallback(
    async (file: File) => {
      updateAttributes({ status: ECustomVideoStatus.UPLOADING });
      return await extension.options.uploadVideo?.(videoEntityId ?? "", file);
    },
    [extension.options, updateAttributes, videoEntityId]
  );

  const handleProgressStatus = useCallback(
    (isUploading: boolean) => {
      editor.storage.utility.uploadInProgress = isUploading;
    },
    [editor]
  );

  const handleInvalidFile = useCallback((_error: EFileError, _file: File, message: string) => {
    alert(message);
  }, []);

  const { isUploading, uploadFile } = useUploader({
    acceptedMimeTypes: ACCEPTED_VIDEO_MIME_TYPES,
    editorCommand: uploadVideoEditorCommand,
    handleProgressStatus,
    loadFileFromFileSystem: loadVideoFromFileSystem,
    maxFileSize,
    onInvalidFile: handleInvalidFile,
    onUpload,
  });

  const { draggedInside, onDrop, onDragEnter, onDragLeave } = useDropZone({
    editor,
    getPos,
    type: "video",
    uploader: uploadFile,
  });

  useEffect(() => {
    if (hasTriedUploadingOnMountRef.current) return;
    const meta = videoComponentFileMap?.get(videoEntityId ?? "");
    if (meta) {
      if (meta.event === "drop" && "file" in meta) {
        hasTriedUploadingOnMountRef.current = true;
        void uploadFile(meta.file);
      } else if (meta.event === "insert" && fileInputRef.current && !hasTriggeredFilePickerRef.current) {
        if (meta.hasOpenedFileInputOnce) return;
        if (!isTouchDevice) {
          fileInputRef.current.click();
        }
        hasTriggeredFilePickerRef.current = true;
        videoComponentFileMap?.set(videoEntityId ?? "", { ...meta, hasOpenedFileInputOnce: true });
      }
    } else {
      hasTriedUploadingOnMountRef.current = true;
    }
  }, [isTouchDevice, uploadFile, videoComponentFileMap, videoEntityId]);

  const onFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      e.preventDefault();
      const filesList = e.target.files;
      const pos = getPos();
      if (!filesList || pos === undefined) return;
      await uploadFirstFileAndInsertRemaining({
        editor,
        filesList,
        pos,
        type: "video",
        uploader: uploadFile,
      });
    },
    [editor, getPos, uploadFile]
  );

  const isErrorState = failedToLoadVideo;
  const message = isErrorState
    ? "Error loading video"
    : isUploading
      ? "Uploading..."
      : draggedInside && editor.isEditable
        ? "Drop video here"
        : "Add a video";

  return (
    // oxlint-disable-next-line jsx_a11y/click-events-have-key-events, jsx_a11y/no-static-element-interactions
    <div
      className={cn(
        "flex cursor-default items-center justify-start gap-2 rounded-lg border border-dashed bg-layer-3 px-2 py-3 text-tertiary transition-all",
        {
          "border-subtle": !(selected && editor.isEditable && !isErrorState),
          "cursor-pointer hover:bg-layer-3-hover hover:text-secondary": editor.isEditable && !isErrorState,
          "bg-layer-3-hover text-secondary": draggedInside && editor.isEditable && !isErrorState,
          "bg-accent-primary/10 text-accent-secondary": selected && editor.isEditable && !isErrorState,
          "cursor-default bg-danger-subtle text-danger-primary": isErrorState,
        }
      )}
      onDrop={onDrop}
      onDragOver={onDragEnter}
      onDragLeave={onDragLeave}
      contentEditable={false}
      onClick={() => {
        if (!failedToLoadVideo && editor.isEditable) fileInputRef.current?.click();
      }}
    >
      <Film className="size-4" />
      <div className="flex-1 text-14 font-medium">{message}</div>
      {isErrorState && editor.isEditable && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-11 font-medium"
        >
          <RotateCcw className="size-3" />
          Retry
        </button>
      )}
      <input
        className="size-0 overflow-hidden"
        ref={fileInputRef}
        hidden
        type="file"
        accept={ACCEPTED_VIDEO_MIME_TYPES.join(",")}
        onChange={(e) => void onFileChange(e)}
        multiple
      />
    </div>
  );
}
