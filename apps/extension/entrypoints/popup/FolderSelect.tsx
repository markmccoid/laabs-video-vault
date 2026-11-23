import { buildFolderTree, flattenFolderTree } from "@lvv/core";
import type { FolderDoc, Id } from "@/lib/api";

/** A native folder picker, indented by depth, with the Inbox first. */
export function FolderSelect({
  folders,
  value,
  onChange,
  id,
}: {
  folders: FolderDoc[];
  value: Id<"folders"> | undefined;
  onChange: (id: Id<"folders"> | undefined) => void;
  id?: string;
}) {
  const rows = flattenFolderTree(buildFolderTree(folders));
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
          {"  ".repeat(f.depth)}
          {f.name}
        </option>
      ))}
    </select>
  );
}
