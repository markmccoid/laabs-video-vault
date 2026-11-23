import { newerProgress, type WatchProgress } from "./watchProgress";

/**
 * The device's copy of Watch Progress and its sync with the server
 * (docs/adr/0003). Each app supplies a key-value storage (MMKV on mobile,
 * localStorage on desktop) and the two Convex calls.
 */

/** A device's copy. `unsent` until the server has accepted it. */
export type LocalProgress = WatchProgress & { unsent?: boolean };

export type ProgressStorage = {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): void;
  keys(): string[];
};

export type ProgressEntry = WatchProgress & { videoId: string };
export type ServerProgress = ProgressEntry & { updatedAt: number };

export type ProgressRemote = {
  save(entries: ProgressEntry[]): Promise<void>;
  changedSince(
    since: number,
    cursor: string | null,
  ): Promise<{ page: ServerProgress[]; isDone: boolean; continueCursor: string }>;
};

const PREFIX = "wp:";
const CURSOR_KEY = "wp-cursor";
/** Most entries one save call carries (the backend's MAX_BULK). */
const PUSH_BATCH = 200;
/** What each app passes as numItems to changedSince. */
export const PROGRESS_PULL_PAGE = 200;

export type ProgressStore = ReturnType<typeof createProgressStore>;

export function createProgressStore(storage: ProgressStorage, remote: ProgressRemote) {
  const cache = new Map<string, LocalProgress>();
  for (const key of storage.keys()) {
    if (!key.startsWith(PREFIX)) continue;
    try {
      cache.set(key.slice(PREFIX.length), JSON.parse(storage.getString(key) ?? "") as LocalProgress);
    } catch {
      storage.remove(key);
    }
  }
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());

  const write = (videoId: string, p: LocalProgress) => {
    cache.set(videoId, p);
    storage.set(PREFIX + videoId, JSON.stringify(p));
  };

  let syncing: Promise<void> | null = null;

  /** Send unsent copies (all, or just `videoIds`). Failures leave them unsent for the next sync. */
  async function push(videoIds?: string[]) {
    const ids = videoIds ?? [...cache.keys()];
    const pending = ids
      .map((videoId) => ({ videoId, p: cache.get(videoId) }))
      .filter((x): x is { videoId: string; p: LocalProgress } => !!x.p?.unsent);
    for (let i = 0; i < pending.length; i += PUSH_BATCH) {
      const batch = pending.slice(i, i + PUSH_BATCH);
      await remote.save(batch.map(({ videoId, p }) => ({ videoId, seconds: p.seconds, durationSec: p.durationSec, savedAt: p.savedAt })));
      for (const { videoId, p } of batch) {
        const now = cache.get(videoId);
        // Only clear the flag if nothing newer was saved while the call ran.
        if (now && now.savedAt === p.savedAt) write(videoId, { ...now, unsent: false });
      }
    }
  }

  /** Push what's unsent, then take whatever the server changed since the last sync. */
  async function pull() {
    const since = Number(storage.getString(CURSOR_KEY) ?? 0) || 0;
    let cursor: string | null = null;
    let changed = false;
    for (;;) {
      const res = await remote.changedSince(since, cursor);
      for (const s of res.page) {
        const local = cache.get(s.videoId);
        const server: LocalProgress = { seconds: s.seconds, durationSec: s.durationSec, savedAt: s.savedAt };
        if (newerProgress(local, server) === server) {
          write(s.videoId, server);
          changed = true;
        }
      }
      const last = res.page.at(-1);
      if (last) storage.set(CURSOR_KEY, String(last.updatedAt));
      if (res.isDone || res.page.length === 0) break;
      cursor = res.continueCursor;
    }
    if (changed) emit();
  }

  return {
    get: (videoId: string): LocalProgress | undefined => cache.get(videoId),

    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    /** Save on this device. It goes to the server with the next push. */
    record(videoId: string, seconds: number, durationSec: number | undefined, now = Date.now()) {
      const prev = cache.get(videoId);
      write(videoId, {
        seconds: Math.max(0, Math.floor(seconds)),
        durationSec: durationSec && durationSec > 0 ? Math.round(durationSec) : prev?.durationSec,
        savedAt: now,
        unsent: true,
      });
      emit();
    },

    push,

    /** Push unsent copies, then pull changes. Concurrent calls share one run. */
    sync(): Promise<void> {
      syncing ??= (async () => {
        try {
          await push();
        } catch {
          // Still pull; the unsent copies go next time.
        }
        await pull();
      })().finally(() => {
        syncing = null;
      });
      return syncing;
    },

    /** Forget everything on this device (sign-out). */
    clear() {
      for (const key of storage.keys()) if (key.startsWith(PREFIX) || key === CURSOR_KEY) storage.remove(key);
      cache.clear();
      emit();
    },
  };
}
