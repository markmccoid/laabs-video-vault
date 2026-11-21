import { buildFolderTree, flattenFolderTree } from "@lvv/core";
import type { FolderDoc, Id } from "../lib/api";

/** A native folder picker, indented by depth, with Inbox first. */
export function FolderSelect({
  folders,
  value,
  onChange,
  id,
  maxDepth,
}: {
  folders: FolderDoc[];
  value: Id<"folders"> | undefined;
  onChange: (id: Id<"folders"> | undefined) => void;
  id?: string;
  /** Hide folders deeper than this (for picking a parent). */
  maxDepth?: number;
}) {
  const rows = flattenFolderTree(buildFolderTree(folders)).filter((f) => maxDepth === undefined || f.depth <= maxDepth);
  return (
    <select
      id={id}
      className="input select"
      value={value ?? ""}
      onChange={(e) => onChange((e.target.value || undefined) as Id<"folders"> | undefined)}
    >
      <option value="">Inbox</option>
      {rows.map((f) => (
        <option key={f._id} value={f._id}>
          {" ".repeat(f.depth + 1)}
          {f.name}
        </option>
      ))}
    </select>
  );
}
