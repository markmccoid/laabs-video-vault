import { parseTimestamp } from "./youtube";

export type Chapter = { seconds: number; label: string };

/**
 * Parse chapter markers from a video description, following YouTube's own
 * rules: the first timestamp must be 0:00, there must be at least 3 chapters,
 * and timestamps must be in ascending order. Returns [] if the description
 * doesn't qualify.
 *
 * Handles common line shapes:
 *   0:00 Intro
 *   0:00 - Intro
 *   (1:23) Setup
 *   Intro 0:00
 */
export function parseChapters(description: string): Chapter[] {
  const chapters: Chapter[] = [];
  const TS = String.raw`(\d{1,2}:\d{2}(?::\d{2})?)`;
  const leading = new RegExp(String.raw`^[\s\-•*]*[\[(]?${TS}[\])]?\s*[-–—:|]?\s*(.+)$`);
  const trailing = new RegExp(String.raw`^(.+?)\s*[-–—:|]?\s*[\[(]?${TS}[\])]?\s*$`);

  for (const rawLine of description.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    let ts: string | undefined;
    let label: string | undefined;
    const lead = line.match(leading);
    if (lead) {
      ts = lead[1];
      label = lead[2];
    } else {
      const trail = line.match(trailing);
      if (trail) {
        label = trail[1];
        ts = trail[2];
      }
    }
    if (!ts || !label) continue;

    const seconds = parseTimestamp(ts);
    const cleanLabel = label.trim().replace(/^[-–—:|]\s*/, "");
    if (seconds === undefined || !cleanLabel) continue;
    chapters.push({ seconds, label: cleanLabel });
  }

  if (chapters.length < 3) return [];
  if (chapters[0]!.seconds !== 0) return [];
  for (let i = 1; i < chapters.length; i++) {
    if (chapters[i]!.seconds <= chapters[i - 1]!.seconds) return [];
  }
  return chapters;
}
