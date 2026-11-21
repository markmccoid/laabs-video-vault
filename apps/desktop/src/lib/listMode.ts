import { useCallback, useState } from "react";

/**
 * How much room the video list gets while a video is open.
 * - browse: the list stretches and the detail pane stays narrow (the layout with nothing open)
 * - compact: a narrow list beside a wide detail pane
 * - hidden: the detail pane takes the whole width
 */
export type ListMode = "browse" | "compact" | "hidden";
type FocusMode = Exclude<ListMode, "browse">;

const KEY = "lvv.listFocusMode";

function readFocusMode(): FocusMode {
  try {
    return localStorage.getItem(KEY) === "hidden" ? "hidden" : "compact";
  } catch {
    return "compact";
  }
}

/**
 * The list mode while a video is open. Opening a video from nothing uses the
 * last focus mode (compact or hidden) picked on this device; picking browse
 * doesn't change that default, since browse is where the app starts anyway.
 */
export function useListMode() {
  const [mode, setModeState] = useState<ListMode>("browse");

  const setMode = useCallback((next: ListMode) => {
    setModeState(next);
    if (next === "browse") return;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Storage can be unavailable; the mode still applies for this run.
    }
  }, []);

  const focus = useCallback(() => setModeState(readFocusMode()), []);
  const reset = useCallback(() => setModeState("browse"), []);

  return { mode, setMode, focus, reset };
}

const NEXT: Record<ListMode, ListMode> = { browse: "compact", compact: "hidden", hidden: "browse" };
export const nextListMode = (m: ListMode): ListMode => NEXT[m];
