/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Editor } from "@tiptap/core";
import { CORE_EXTENSIONS } from "@/constants/extension";
import type { CustomVideoExtensionStorage, TCustomVideoAttributes } from "./types";
import { ECustomVideoAttributeNames, ECustomVideoStatus } from "./types";

export const DEFAULT_CUSTOM_VIDEO_ATTRIBUTES: TCustomVideoAttributes = {
  [ECustomVideoAttributeNames.ID]: null,
  [ECustomVideoAttributeNames.SOURCE]: null,
  [ECustomVideoAttributeNames.STATUS]: ECustomVideoStatus.PENDING,
};

export const getVideoComponentFileMap = (editor: Editor) =>
  (editor.storage[CORE_EXTENSIONS.CUSTOM_VIDEO] as CustomVideoExtensionStorage | undefined)?.fileMap;
