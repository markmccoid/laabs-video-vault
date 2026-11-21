/**
 * Loose matching for type-to-find lists (the Mac Command Palette): every
 * character of the query must appear in the text, in order. Matches at the
 * start of words and runs of consecutive characters score higher, so "mtt"
 * finds "Move to Trash" and "inb" ranks "Inbox" above "Find in Bookmarks".
 */
export function fuzzyScore(query: string, text: string): number | null {
  const q = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (!q) return 0;
  const t = text.toLowerCase();
  if (t.startsWith(q)) return 1000 - t.length;

  let score = 0;
  let from = 0;
  let prev = -2;
  for (const ch of q) {
    if (ch === " ") continue;
    // Prefer this character at the start of a word, if one is ahead.
    let at = -1;
    for (let i = from; i < t.length; i++) {
      if (t[i] === ch && (i === 0 || /[^a-z0-9]/.test(t[i - 1]!))) {
        at = i;
        break;
      }
    }
    // A run (the very next character) beats jumping ahead to a word start.
    if (t[from] === ch && from === prev + 1) at = from;
    if (at === -1) at = t.indexOf(ch, from);
    if (at === -1) return null;

    if (at === prev + 1) score += 5;
    if (at === 0 || /[^a-z0-9]/.test(t[at - 1]!)) score += 10;
    prev = at;
    from = at + 1;
  }
  return score - t.length / 100;
}

/** The items that match, best first; an empty query keeps every item in its order. */
export function fuzzyRank<T>(query: string, items: readonly T[], text: (item: T) => string): T[] {
  if (!query.trim()) return [...items];
  return items
    .map((item, i) => ({ item, i, score: fuzzyScore(query, text(item)) }))
    .filter((m): m is { item: T; i: number; score: number } => m.score !== null)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((m) => m.item);
}
