/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ReactNodeViewRenderer } from "@tiptap/react";
import { v4 as uuidv4 } from "uuid";
import { ACCEPTED_VIDEO_MIME_TYPES } from "@/constants/config";
import { isFileValid } from "@/helpers/file";
import { insertEmptyParagraphAtNodeBoundaries } from "@/helpers/insert-empty-paragraph-at-node-boundary";
import type { TFileHandler } from "@/types";
import type { CustomVideoNodeViewProps } from "./components/node-view";
import { CustomVideoNodeView } from "./components/node-view";
import { CustomVideoExtensionConfig } from "./extension-config";
import type { CustomVideoExtensionOptions, CustomVideoExtensionStorage } from "./types";
import { ECustomVideoAttributeNames, ECustomVideoStatus } from "./types";
import { getVideoComponentFileMap } from "./utils";

type Props = {
  fileHandler: TFileHandler;
  isEditable: boolean;
};

export function CustomVideoExtension(props: Props) {
  const { fileHandler, isEditable } = props;
  const { getAssetSrc } = fileHandler;

  return CustomVideoExtensionConfig.extend<CustomVideoExtensionOptions, CustomVideoExtensionStorage>({
    selectable: isEditable,
    draggable: isEditable,

    addOptions() {
      const upload = "upload" in fileHandler ? fileHandler.upload : undefined;
      return {
        ...this.parent?.(),
        getVideoSource: getAssetSrc,
        uploadVideo: upload,
      };
    },

    addStorage() {
      const maxFileSize = "validation" in fileHandler ? fileHandler.validation?.maxFileSize : 0;
      return {
        fileMap: new Map(),
        maxFileSize,
        markdown: {
          serialize() {},
        },
      };
    },

    addCommands() {
      return {
        insertVideoComponent:
          (commandProps) =>
          ({ commands }) => {
            if (
              commandProps?.file &&
              !isFileValid({
                acceptedMimeTypes: ACCEPTED_VIDEO_MIME_TYPES,
                file: commandProps.file,
                maxFileSize: this.storage.maxFileSize,
                onError: (_error, message) => alert(message),
              })
            ) {
              return false;
            }

            const fileId = uuidv4();
            const videoComponentFileMap = getVideoComponentFileMap(this.editor);

            if (videoComponentFileMap) {
              if (commandProps?.event === "drop" && commandProps.file) {
                videoComponentFileMap.set(fileId, {
                  file: commandProps.file,
                  event: commandProps.event,
                });
              } else if (commandProps.event === "insert") {
                videoComponentFileMap.set(fileId, {
                  event: commandProps.event,
                  hasOpenedFileInputOnce: false,
                });
              }
            }

            const attributes = {
              [ECustomVideoAttributeNames.ID]: fileId,
              [ECustomVideoAttributeNames.STATUS]: ECustomVideoStatus.PENDING,
            };

            if (commandProps.pos) {
              return commands.insertContentAt(commandProps.pos, {
                type: this.name,
                attrs: attributes,
              });
            }
            return commands.insertContent({
              type: this.name,
              attrs: attributes,
            });
          },
      };
    },

    addKeyboardShortcuts() {
      return {
        ArrowDown: insertEmptyParagraphAtNodeBoundaries("down", this.name),
        ArrowUp: insertEmptyParagraphAtNodeBoundaries("up", this.name),
      };
    },

    addNodeView() {
      return ReactNodeViewRenderer((nodeViewProps) => (
        <CustomVideoNodeView {...nodeViewProps} node={nodeViewProps.node as CustomVideoNodeViewProps["node"]} />
      ));
    },
  });
}
