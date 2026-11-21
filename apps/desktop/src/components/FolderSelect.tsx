import { buildFolderTree, flattenFolderTree } from "@lvv/core";
import type { FolderDoc, Id } from "../lib/api";

/**
 * A native folder picker, indented by depth. Root folders sit flush left.
 * The empty choice (no folder) comes first: "Inbox" when placing a video,
 * "Top level" when picking a new folder's parent. It is a sibling of the
 * root folders, never their parent.
 */
export function FolderSelect({
  folders,
  value,
  onChange,
  id,
  maxDepth,
  emptyLabel = "Inbox",
}: {
  folders: FolderDoc[];
  value: Id<"folders"> | undefined;
  onChange: (id: Id<"folders"> | undefined) => void;
  id?: string;
  /** Hide folders deeper than this (for picking a parent). */
  maxDepth?: number;
  /** Label for the no-folder choice. */
  emptyLabel?: string;
}) {
  const rows = flattenFolderTree(buildFolderTree(folders)).filter((f) => maxDepth === undefined || f.depth <= maxDepth);
  return (
    <select
      id={id}
      className="input select"
      value={value ?? ""}
      onChange={(e) => onChange((e.target.value || undefined) as Id<"folders"> | undefined)}
    >
      <option value="">{emptyLabel}</option>
      {rows.map((f) => (
        <option key={f._id} value={f._id}>
          {" ".repeat(f.depth)}
          {f.name}
        </option>
      ))}
    </select>
  );
}
