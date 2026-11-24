import { useCallback, useState } from "react";

/** An on/off setting kept on this device. */
function useStoredFlag(key: string, fallback: boolean) {
  const [value, setValue] = useState(() => {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : v === "1";
    } catch {
      return fallback;
    }
  });
  const set = useCallback(
    (next: boolean) => {
      setValue(next);
      try {
        localStorage.setItem(key, next ? "1" : "0");
      } catch {
        // Storage can be unavailable; the setting still applies for this run.
      }
    },
    [key],
  );
  return [value, set] as const;
}

/** Captions on or off for every video (the CC button and Video › Captions). Off until turned on. */
export const useCaptionsPref = () => useStoredFlag("lvv.captions", false);

/**
 * View › Show YouTube Controls: YouTube's own control bar over the video (its
 * settings menu for caption language, quality, fullscreen), alongside ours.
 */
export const useYouTubeControlsPref = () => useStoredFlag("lvv.youtubeControls", false);
