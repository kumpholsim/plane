/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 *
 * Lazy store accessor to avoid circular imports:
 * BaseIssuesStore → utils → store-context → RootStore → *Issues extends BaseIssuesStore
 */

import type { RootStore } from "@/store/root.store";

let rootStoreRef: RootStore | null = null;

export const setRootStoreRef = (store: RootStore) => {
  rootStoreRef = store;
};

export const getRootStoreRef = (): RootStore => {
  if (!rootStoreRef) {
    throw new Error("Root store has not been initialized yet");
  }
  return rootStoreRef;
};
