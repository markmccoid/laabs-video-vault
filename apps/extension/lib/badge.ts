/**
 * The toolbar ✓ for saved videos. Results are cached per YouTube ID in
 * chrome.storage.session (cleared when the browser closes), so going back and
 * forth between videos costs one Convex query per video. "Not saved" expires
 * after a few minutes, so a video saved on another device shows up.
 */
import { authedClient } from "./session";
import { api } from "./api";

const PREFIX = "saved:";
const NOT_SAVED_TTL_MS = 10 * 60_000;

type Entry = { saved: boolean; at: number };

export async function cachedSaved(youtubeId: string): Promise<boolean | null> {
  const key = PREFIX + youtubeId;
  const entry = (await browser.storage.session.get(key))[key] as Entry | undefined;
  if (!entry) return null;
  if (!entry.saved && Date.now() - entry.at > NOT_SAVED_TTL_MS) return null;
  return entry.saved;
}

export async function rememberSaved(youtubeId: string, saved: boolean): Promise<void> {
  await browser.storage.session.set({ [PREFIX + youtubeId]: { saved, at: Date.now() } satisfies Entry });
}

export async function forgetAll(): Promise<void> {
  const all = await browser.storage.session.get(null);
  const keys = Object.keys(all).filter((k) => k.startsWith(PREFIX));
  if (keys.length) await browser.storage.session.remove(keys);
}

/** Whether a video is saved (not trashed), from the cache or one query. Throws when signed out. */
export async function isSaved(youtubeId: string): Promise<boolean> {
  const cached = await cachedSaved(youtubeId);
  if (cached !== null) return cached;
  const client = await authedClient();
  const result = await client.query(api.videos.lookup, { input: youtubeId });
  const saved = result.status === "saved";
  await rememberSaved(youtubeId, saved);
  return saved;
}

export async function showBadge(tabId: number, saved: boolean): Promise<void> {
  await browser.action.setBadgeText({ tabId, text: saved ? "✓" : "" });
  if (saved) await browser.action.setBadgeBackgroundColor({ tabId, color: "#7a8a5e" });
  await browser.action.setTitle({ tabId, title: saved ? "In your Video Vault" : "Save to Vault" });
}
