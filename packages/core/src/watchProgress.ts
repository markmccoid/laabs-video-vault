/**
 * Watch Progress rules shared by the mobile and desktop players and the
 * backend (docs/adr/0003). Each device keeps its own copy and pushes to
 * Convex once per viewing; the copy saved most recently wins.
 */

/** A viewing must play this long before it records anything, so a quick peek leaves no progress. */
export const MIN_WATCHED_SEC = 10;
/** Resume this far before the saved point, for a little context. */
export const RESUME_REWIND_SEC = 3;
/** While playing, save on the device at most this often… */
export const PERIODIC_SAVE_MS = 60_000;
/** …and only after moving at least this far since the last save. */
export const PERIODIC_MIN_MOVE_SEC = 15;

export type WatchProgress = {
  /** Position reached, in seconds. */
  seconds: number;
  /** Video length as the player reported it, when known. */
  durationSec?: number;
  /** When it was saved, in ms since the epoch. Newer wins. */
  savedAt: number;
};

/** Where to start a video: a little before its Watch Progress, or 0. Shorts always start at 0. */
export function resumeSeconds(progress: Pick<WatchProgress, "seconds"> | undefined, isShort: boolean): number {
  if (!progress || isShort) return 0;
  return Math.max(0, Math.floor(progress.seconds - RESUME_REWIND_SEC));
}

/** Of two copies of the same video's progress, the one saved later. */
export function newerProgress<T extends WatchProgress>(a: T | undefined, b: T | undefined): T | undefined {
  if (!a) return b;
  if (!b) return a;
  return b.savedAt > a.savedAt ? b : a;
}

/** How much of the video the bar shows filled, 0–1. Undefined when there's nothing to show. */
export function progressFraction(
  progress: Pick<WatchProgress, "seconds" | "durationSec"> | undefined,
  videoDurationSec: number | undefined,
): number | undefined {
  if (!progress) return undefined;
  const duration = progress.durationSec || videoDurationSec;
  if (!duration || duration <= 0) return undefined;
  return Math.min(1, Math.max(0, progress.seconds / duration));
}

/**
 * Follows one viewing: how long it has actually played, and where it last
 * saved. Feed it every time report from the player.
 */
export type ViewingTracker = {
  /** Seconds actually played this viewing (seeks don't count). */
  watched: number;
  /** Last reported position, or null before the first report. */
  lastT: number | null;
  /** Position at the last save, or null if this viewing hasn't saved. */
  savedT: number | null;
  /** When this viewing last saved (ms), 0 if never. */
  savedAt: number;
};

export function newViewing(): ViewingTracker {
  return { watched: 0, lastT: null, savedT: null, savedAt: 0 };
}

/** Longest gap between two reports that still counts as playing rather than a seek. */
const MAX_TICK_SEC = 2.5;

/** Record a time report. Small forward steps count as watched; jumps are seeks. */
export function trackTime(tracker: ViewingTracker, t: number): ViewingTracker {
  const step = tracker.lastT === null ? 0 : t - tracker.lastT;
  const watched = step > 0 && step <= MAX_TICK_SEC ? tracker.watched + step : tracker.watched;
  return { ...tracker, watched, lastT: t };
}

/** Whether a while-playing save is due. */
export function periodicSaveDue(tracker: ViewingTracker, now: number): boolean {
  if (tracker.watched < MIN_WATCHED_SEC || tracker.lastT === null) return false;
  if (now - tracker.savedAt < PERIODIC_SAVE_MS) return false;
  return tracker.savedT === null || Math.abs(tracker.lastT - tracker.savedT) >= PERIODIC_MIN_MOVE_SEC;
}

/** Whether a save on pause, leaving, or going to the background would record anything new. */
export function finalSaveDue(tracker: ViewingTracker): boolean {
  if (tracker.watched < MIN_WATCHED_SEC || tracker.lastT === null) return false;
  return tracker.savedT === null || Math.floor(tracker.lastT) !== Math.floor(tracker.savedT);
}

export function markSaved(tracker: ViewingTracker, now: number): ViewingTracker {
  return { ...tracker, savedT: tracker.lastT, savedAt: now };
}
