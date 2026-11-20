/**
 * Pure helpers for the Shelf UI (design_handoff_shelf): folder tones, note
 * timestamps, and search match highlighting.
 */
import { formatDuration, parseTimestamp } from "./youtube";
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

// ─── Notes ───────────────────────────────────────────────────────────────────

export type NoteSegment = { text: string; seconds?: number };

const STAMP = /\[(\d{1,2}(?::\d{2}){1,2})\]/g;

/** Split notes into text and `[m:ss]` / `[h:mm:ss]` stamps (stamps carry `seconds`). */
export function parseNoteStamps(notes: string): NoteSegment[] {
  const out: NoteSegment[] = [];
  let last = 0;
  for (const match of notes.matchAll(STAMP)) {
    const seconds = parseTimestamp(match[1]!);
    if (seconds === undefined) continue;
    if (match.index > last) out.push({ text: notes.slice(last, match.index) });
    out.push({ text: match[0], seconds });
    last = match.index + match[0].length;
  }
  if (last < notes.length) out.push({ text: notes.slice(last) });
  return out;
}

/** Append a `[m:ss] ` stamp for `seconds` on a new line. */
export function appendNoteStamp(notes: string, seconds: number): string {
  const stamp = `[${formatDuration(seconds)}] `;
  if (!notes) return stamp;
  return notes.endsWith("\n") ? notes + stamp : `${notes}\n${stamp}`;
}

export function wordCount(text: string): number {
  const words = text.trim().match(/\S+/g);
  return words ? words.length : 0;
}

// ─── Search matching ─────────────────────────────────────────────────────────

export type SearchScope = "all" | "title" | "description" | "tags";

export type MatchableVideo = { title: string; description: string; tagNames: string[] };

/** Case-insensitive substring match on the fields `scope` covers. */
export function matchesScope(video: MatchableVideo, query: string, scope: SearchScope): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const has = (s: string) => s.toLowerCase().includes(q);
  const title = has(video.title);
  const description = has(video.description);
  const tags = video.tagNames.some(has);
  switch (scope) {
    case "title":
      return title;
    case "description":
      return description;
    case "tags":
      return tags;
    default:
      return title || description || tags;
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
