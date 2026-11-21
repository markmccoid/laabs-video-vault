import { buildFolderTree, folderPath, folderTone, type FolderNode } from "@lvv/core";
import { useQuery } from "convex/react";
import { useMemo } from "react";
import { api, type Doc, type Id } from "@/lib/api";
import { useTheme } from "@/lib/theme";

export type Folder = Doc<"folders">;
export type FolderTreeNode = FolderNode<Folder>;

/** The folder list, nested counts, and helpers shared by Library, Folder, Search and pickers. */
export function useFolders() {
  const folders = useQuery(api.folders.list);
  const counts = useQuery(api.folders.counts);
  const theme = useTheme();

  return useMemo(() => {
    const list = folders ?? [];
    const byId = new Map(list.map((f) => [f._id, f]));
    return {
      /** Undefined while loading. */
      folders,
      tree: buildFolderTree(list),
      byId,
      count: (id: Id<"folders">) => counts?.[id] ?? 0,
      childCount: (id: Id<"folders">) => list.filter((f) => f.parentId === id).length,
      /** "Cooking › Pasta", or "Inbox" for no folder. */
      pathFor: (id: Id<"folders"> | undefined) =>
        id && byId.has(id) ? folderPath(list, id).join(" › ") : "Inbox",
      tone: (id: Id<"folders">) => theme.tones[folderTone(list, id)],
    };
  }, [folders, counts, theme]);
}
