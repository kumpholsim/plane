/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { observer } from "mobx-react";
import { cn } from "@plane/utils";
import { useBoardFullscreen } from "./board-fullscreen-context";

type Props = {
  children: React.ReactNode;
  className?: string;
};

/**
 * Portals filter bar + board content together in full screen mode.
 */
export const BoardFullscreenShell = observer(function BoardFullscreenShell(props: Props) {
  const { children, className } = props;
  const boardFullscreen = useBoardFullscreen();
  const fullScreenMode = boardFullscreen?.fullScreenMode ?? false;
  const setFullScreenMode = boardFullscreen?.setFullScreenMode;

  useEffect(() => {
    if (!fullScreenMode || !setFullScreenMode) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullScreenMode(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullScreenMode, setFullScreenMode]);

  const portalContainer =
    typeof document !== "undefined" ? (document.getElementById("full-screen-portal") as HTMLElement | null) : null;

  const content = (
    <div
      className={cn(
        "relative flex h-full w-full flex-col overflow-hidden bg-surface-1",
        fullScreenMode && "inset-0 z-[25]",
        className
      )}
    >
      {children}
    </div>
  );

  if (fullScreenMode && portalContainer) {
    return createPortal(content, portalContainer);
  }

  return content;
});
