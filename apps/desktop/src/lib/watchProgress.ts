import {
  createProgressStore,
  finalSaveDue,
  markSaved,
  newViewing,
  periodicSaveDue,
  PROGRESS_PULL_PAGE,
  trackTime,
  type LocalProgress,
  type ProgressStorage,
} from "@lvv/core";
import { useConvexAuth } from "convex/react";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { api, type Id } from "./api";
import { convex } from "./convex";

/**
 * Watch Progress on this Mac (localStorage), pushed to Convex once per viewing
 * and pulled with one-shot requests at launch and when the window comes back
 * (docs/adr/0003). Never read it with useQuery: a subscription is what the ADR avoids.
 */
const PREFIX = "lvv.";

/** localStorage can throw (blocked storage); progress then lives in memory for the session. */
const storage: ProgressStorage = {
  getString: (k) => {
    try {
      return localStorage.getItem(PREFIX + k) ?? undefined;
    } catch {
      return undefined;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(PREFIX + k, v);
    } catch {
      // Ignore.
    }
  },
  remove: (k) => {
    try {
      localStorage.removeItem(PREFIX + k);
    } catch {
      // Ignore.
    }
  },
  keys: () => {
    try {
      return Object.keys(localStorage)
        .filter((k) => k.startsWith(PREFIX))
        .map((k) => k.slice(PREFIX.length));
    } catch {
      return [];
    }
  },
};

export const progressStore = createProgressStore(storage, {
  save: async (entries) => {
    await convex.mutation(api.watchProgress.save, {
      entries: entries.map((e) => ({ ...e, videoId: e.videoId as Id<"videos"> })),
    });
  },
  changedSince: (since, cursor) =>
    convex.query(api.watchProgress.changedSince, { since, paginationOpts: { numItems: PROGRESS_PULL_PAGE, cursor } }),
});

/** This Mac's Watch Progress for a video. */
export function useWatchProgress(videoId: string): LocalProgress | undefined {
  return useSyncExternalStore(progressStore.subscribe, () => progressStore.get(videoId));
}

/** Sync once signed in, and again each time the window becomes visible. */
export function useProgressSync() {
  const { isAuthenticated } = useConvexAuth();
  useEffect(() => {
    if (!isAuthenticated) return;
    const sync = () => void progressStore.sync().catch(() => {});
    sync();
    const onVisible = () => document.visibilityState === "visible" && sync();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [isAuthenticated]);
}

/** Before signing out: send what's unsent (best effort), then forget this Mac's copy. */
export async function signOutProgress() {
  await progressStore.push().catch(() => {});
  progressStore.clear();
}

/**
 * Records one viewing's Watch Progress: on this Mac while playing (every
 * 60s), on pause, and on leaving the video or hiding the window, when it also
 * pushes to the server. Pass `enabled: false` for Shorts.
 */
export function useProgressRecorder(videoId: string, enabled: boolean) {
  const tracker = useRef(newViewing());
  const duration = useRef<number | undefined>(undefined);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const save = useCallback(
    (final: boolean) => {
      const tr = tracker.current;
      const now = Date.now();
      if (!enabledRef.current || tr.lastT === null) return;
      if (!(final ? finalSaveDue(tr) : periodicSaveDue(tr, now))) return;
      progressStore.record(videoId, tr.lastT, duration.current, now);
      tracker.current = markSaved(tr, now);
    },
    [videoId],
  );

  useEffect(() => {
    tracker.current = newViewing();
    duration.current = undefined;
    const leave = () => {
      save(true);
      void progressStore.push([videoId]).catch(() => {});
    };
    const onHide = () => document.visibilityState === "hidden" && leave();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", leave);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, [videoId, save]);

  return {
    onTime: useCallback(
      (t: number, d: number) => {
        tracker.current = trackTime(tracker.current, t);
        if (d > 0) duration.current = d;
        save(false);
      },
      [save],
    ),
    onPause: useCallback(() => save(true), [save]),
  };
}
