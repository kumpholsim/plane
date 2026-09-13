/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useEffect, useState } from "react";
import { cn } from "@plane/utils";
import type { CustomVideoExtensionType, TCustomVideoAttributes } from "../types";
import { CustomVideoUploader } from "./uploader";

export type CustomVideoNodeViewProps = Omit<NodeViewProps, "extension" | "updateAttributes"> & {
  extension: CustomVideoExtensionType;
  node: NodeViewProps["node"] & {
    attrs: TCustomVideoAttributes;
  };
  updateAttributes: (attrs: Partial<TCustomVideoAttributes>) => void;
};

export function CustomVideoNodeView(props: CustomVideoNodeViewProps) {
  const { editor, extension, node, selected } = props;
  const { src: videoNodeSrc } = node.attrs;

  const [isUploaded, setIsUploaded] = useState(!!videoNodeSrc);
  const [resolvedSrc, setResolvedSrc] = useState<string | undefined>(undefined);
  const [previewFromFileSystem, setPreviewFromFileSystem] = useState<string | undefined>(undefined);
  const [failedToLoadVideo, setFailedToLoadVideo] = useState(false);
  const maxFileSize = extension.storage.maxFileSize;

  useEffect(() => {
    if (resolvedSrc || videoNodeSrc) {
      setIsUploaded(true);
      setPreviewFromFileSystem(undefined);
    } else {
      setIsUploaded(false);
    }
  }, [resolvedSrc, videoNodeSrc]);

  useEffect(() => {
    if (!videoNodeSrc) {
      setResolvedSrc(undefined);
      return;
    }
    setFailedToLoadVideo(false);
    const load = async () => {
      try {
        const url = await extension.options.getVideoSource?.(videoNodeSrc);
        setResolvedSrc(url);
      } catch (error) {
        console.error("Error fetching video source:", error);
        setFailedToLoadVideo(true);
      }
    };
    void load();
  }, [videoNodeSrc, extension.options]);

  const displaySrc = resolvedSrc || previewFromFileSystem;

  return (
    <NodeViewWrapper>
      <div
        className={cn("my-2 w-full max-w-2xl", {
          "ring-accent-primary/40 rounded-md ring-2": selected && editor.isEditable,
        })}
      >
        {isUploaded && displaySrc && !failedToLoadVideo ? (
          <video
            className="max-h-[480px] w-full rounded-md bg-black"
            controls
            preload="metadata"
            src={displaySrc}
            onError={() => setFailedToLoadVideo(true)}
          >
            <track kind="captions" />
          </video>
        ) : (
          <CustomVideoUploader
            {...props}
            failedToLoadVideo={failedToLoadVideo}
            loadVideoFromFileSystem={setPreviewFromFileSystem}
            maxFileSize={maxFileSize}
            setIsUploaded={setIsUploaded}
          />
        )}
      </div>
    </NodeViewWrapper>
  );
}
