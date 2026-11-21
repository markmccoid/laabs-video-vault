/** Name of the built-in tag automatically applied to YouTube Shorts. */
export const SHORT_TAG_NAME = "short";

export type SearchTextParts = {
  title: string;
  channelTitle: string;
  description: string;
  notes: string;
  tagNames: string[];
  /** Descriptions of the user's own timestamps. */
  timestampLabels?: string[];
};

/**
 * Builds the single field that Convex's search index scans.
 * Convex search indexes take one searchField, so everything searchable is
 * concatenated here. Every mutation that changes any of these parts must
 * rebuild it.
 */
export function buildSearchText(p: SearchTextParts): string {
  return [p.title, p.channelTitle, p.tagNames.join(" "), p.notes, p.timestampLabels?.join("\n"), p.description]
    .filter(Boolean)
    .join("\n");
}
