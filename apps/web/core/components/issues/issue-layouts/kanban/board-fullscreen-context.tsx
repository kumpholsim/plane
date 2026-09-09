/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type TBoardFullscreenContext = {
  fullScreenMode: boolean;
  setFullScreenMode: (value: boolean) => void;
  toggleFullScreenMode: () => void;
};

const BoardFullscreenContext = createContext<TBoardFullscreenContext | null>(null);

export function BoardFullscreenProvider(props: { children: React.ReactNode }) {
  const { children } = props;
  const [fullScreenMode, setFullScreenMode] = useState(false);
  const toggleFullScreenMode = useCallback(() => setFullScreenMode((prev) => !prev), []);
  const value = useMemo(
    () => ({ fullScreenMode, setFullScreenMode, toggleFullScreenMode }),
    [fullScreenMode, toggleFullScreenMode]
  );

  return <BoardFullscreenContext.Provider value={value}>{children}</BoardFullscreenContext.Provider>;
}

export function useBoardFullscreen(): TBoardFullscreenContext | null {
  return useContext(BoardFullscreenContext);
}
