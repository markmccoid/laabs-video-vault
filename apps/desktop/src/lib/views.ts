import type { Id } from "./api";

/** What the middle pane shows. Search overrides it while there's text. */
export type View =
  | { kind: "justAdded" }
  | { kind: "inbox" }
  | { kind: "folder"; id: Id<"folders"> }
  | { kind: "tag"; id: Id<"tags"> }
  | { kind: "trash" };

export function sameView(a: View, b: View): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "folder" && b.kind === "folder") return a.id === b.id;
  if (a.kind === "tag" && b.kind === "tag") return a.id === b.id;
  return true;
}

/** ⌘ on Mac, Ctrl elsewhere. */
export const isMac = typeof navigator !== "undefined" && /Mac/.test(navigator.platform);
export const MOD = isMac ? "⌘" : "Ctrl+";
export function modKey(e: { metaKey: boolean; ctrlKey: boolean }): boolean {
  return isMac ? e.metaKey : e.ctrlKey;
}
