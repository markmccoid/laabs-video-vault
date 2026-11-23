import {
  createProgressStore,
  finalSaveDue,
  markSaved,
  newViewing,
  periodicSaveDue,
  PROGRESS_PULL_PAGE,
  trackTime,
  type LocalProgress,
} from "@lvv/core";
import { useConvexAuth } from "convex/react";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { createMMKV } from "react-native-mmkv";
import { api, type Id } from "@/lib/api";
import { convex } from "@/lib/convex";

/**
 * Watch Progress on this device (MMKV), pushed to Convex once per viewing and
 * pulled with one-shot requests at launch and foreground (docs/adr/0003).
 * Never read it with useQuery: a subscription is what the ADR avoids.
 */
const mmkv = createMMKV({ id: "watch-progress" });

export const progressStore = createProgressStore(
  {
    getString: (k) => mmkv.getString(k),
    set: (k, v) => mmkv.set(k, v),
    remove: (k) => void mmkv.remove(k),
    keys: () => mmkv.getAllKeys(),
  },
  {
    save: async (entries) => {
      await convex.mutation(api.watchProgress.save, {
        entries: entries.map((e) => ({ ...e, videoId: e.videoId as Id<"videos"> })),
      });
    },
    changedSince: (since, cursor) =>
      convex.query(api.watchProgress.changedSince, { since, paginationOpts: { numItems: PROGRESS_PULL_PAGE, cursor } }),
  },
);

/** This device's Watch Progress for a video. */
export function useWatchProgress(videoId: string): LocalProgress | undefined {
  return useSyncExternalStore(progressStore.subscribe, () => progressStore.get(videoId));
}

/** Sync once signed in, and again each time the app comes to the foreground. */
export function useProgressSync() {
  const { isAuthenticated } = useConvexAuth();
  useEffect(() => {
    if (!isAuthenticated) return;
    const sync = () => void progressStore.sync().catch(() => {});
    sync();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") sync();
    });
    return () => sub.remove();
  }, [isAuthenticated]);
}

/** Before signing out: send what's unsent (best effort), then forget this device's copy. */
export async function signOutProgress() {
  await progressStore.push().catch(() => {});
  progressStore.clear();
}

/**
 * Records one viewing's Watch Progress: on this device while playing (every
 * 60s), on pause, and on leaving or going to the background, when it also
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
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background") leave();
    });
    return () => {
      sub.remove();
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
