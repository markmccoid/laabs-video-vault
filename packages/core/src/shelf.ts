/**
 * Pure helpers for the Shelf UI (design_handoff_shelf): folder tones,
 * timestamps, notes, and search match highlighting.
 */
import { formatDuration } from "./youtube";
import type { FolderLike } from "./folders";

// ─── Folder tones ────────────────────────────────────────────────────────────

export const FOLDER_TONES = ["accent", "sage", "neutral"] as const;
export type FolderTone = (typeof FOLDER_TONES)[number];

type TonedFolder = FolderLike & { color?: string };

function isTone(value: string | undefined): value is FolderTone {
  return (FOLDER_TONES as readonly string[]).includes(value ?? "");
}

/**
 * A folder's colour tone. Only top-level folders carry one: a saved `color`
 * when it's a tone name, otherwise accent / sage / neutral in turn by
 * position. Subfolders inherit their top-level ancestor's tone.
 */
export function folderTone<F extends TonedFolder>(folders: F[], folderId: F["_id"]): FolderTone {
  const byId = new Map<string, F>(folders.map((f) => [f._id, f]));
  let top = byId.get(folderId);
  for (let i = 0; top?.parentId && i < 5; i++) top = byId.get(top.parentId) ?? top;
  if (!top) return "neutral";
  if (isTone(top.color)) return top.color;
  const roots = folders
    .filter((f) => !f.parentId)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  const index = roots.findIndex((f) => f._id === top._id);
  return FOLDER_TONES[Math.max(0, index) % FOLDER_TONES.length]!;
}

// ─── Timestamps ──────────────────────────────────────────────────────────────

/** Longest timestamp description, in characters. */
export const MAX_TIMESTAMP_LABEL = 120;

/**
 * Clean a timestamp description: collapse whitespace and cap the length. An
 * empty description falls back to the time itself ("3:40").
 */
export function timestampLabel(label: string, seconds: number): string {
  const clean = label.replace(/\s+/g, " ").trim().slice(0, MAX_TIMESTAMP_LABEL).trim();
  return clean || formatDuration(seconds);
}

/** Whole, non-negative seconds for a player position. */
export function timestampSeconds(position: number): number {
  return Number.isFinite(position) && position > 0 ? Math.floor(position) : 0;
}

// ─── Notes ───────────────────────────────────────────────────────────────────

export function wordCount(text: string): number {
  const words = text.trim().match(/\S+/g);
  return words ? words.length : 0;
}

// ─── Search matching ─────────────────────────────────────────────────────────

export type SearchScope = "all" | "title" | "description" | "tags";

export type MatchableVideo = { title: string; description: string; tagNames: string[] };

/**
 * Narrow server search results to a scope with a case-insensitive substring
 * match. "all" keeps every result: the server already matched title, channel,
 * tags, notes, timestamps, and description.
 */
export function matchesScope(video: MatchableVideo, query: string, scope: SearchScope): boolean {
  const q = query.trim().toLowerCase();
  if (!q || scope === "all") return true;
  const has = (s: string) => s.toLowerCase().includes(q);
  const title = has(video.title);
  const description = has(video.description);
  const tags = video.tagNames.some(has);
  switch (scope) {
    case "title":
      return title;
    case "description":
      return description;
    default:
      return tags;
  }
}

export type HighlightSegment = { text: string; match: boolean };

/** Split `text` into matched and unmatched runs of `query` (case-insensitive). */
export function highlight(text: string, query: string): HighlightSegment[] {
  const q = query.trim().toLowerCase();
  if (!q) return [{ text, match: false }];
  const lower = text.toLowerCase();
  const out: HighlightSegment[] = [];
  let from = 0;
  for (let at = lower.indexOf(q); at !== -1; at = lower.indexOf(q, at + q.length)) {
    if (at > from) out.push({ text: text.slice(from, at), match: false });
    out.push({ text: text.slice(at, at + q.length), match: true });
    from = at + q.length;
  }
  if (from < text.length) out.push({ text: text.slice(from), match: false });
  return out.length ? out : [{ text, match: false }];
}

/**
 * A one-line excerpt of `text` around the first match of `query`, with an
 * ellipsis where it's cut. Null when there's no match.
 */
export function snippet(text: string, query: string, radius = 40): string | null {
  const q = query.trim().toLowerCase();
  const flat = text.replace(/\s+/g, " ");
  const at = q ? flat.toLowerCase().indexOf(q) : -1;
  if (at === -1) return null;
  const start = Math.max(0, at - radius);
  const end = Math.min(flat.length, at + q.length + radius);
  return `${start > 0 ? "…" : ""}${flat.slice(start, end).trim()}${end < flat.length ? "…" : ""}`;
}
