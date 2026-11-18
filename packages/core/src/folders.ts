/**
 * Folder tree rules. Folders nest up to MAX_FOLDER_DEPTH levels
 * (depth 0 = top level, so valid depths are 0, 1, 2).
 */
export const MAX_FOLDER_DEPTH = 3;

export type FolderLike<Id extends string = string> = {
  _id: Id;
  parentId?: Id;
  depth: number;
  order: number;
  name: string;
};

export type FolderNode<F extends FolderLike> = F & { children: FolderNode<F>[] };

/** Build a sorted tree from the flat folder list returned by Convex. */
export function buildFolderTree<F extends FolderLike>(folders: F[]): FolderNode<F>[] {
  const nodes = new Map<string, FolderNode<F>>();
  for (const f of folders) nodes.set(f._id, { ...f, children: [] });

  const roots: FolderNode<F>[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    (parent ? parent.children : roots).push(node);
  }

  const sort = (list: FolderNode<F>[]) => {
    list.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    list.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

/** IDs of `folderId` and every folder beneath it. */
export function descendantIds<F extends FolderLike>(folders: F[], folderId: F["_id"]): F["_id"][] {
  const byParent = new Map<string, F[]>();
  for (const f of folders) {
    if (!f.parentId) continue;
    const list = byParent.get(f.parentId) ?? [];
    list.push(f);
    byParent.set(f.parentId, list);
  }
  const out: F["_id"][] = [];
  const stack: F["_id"][] = [folderId];
  while (stack.length) {
    const id = stack.pop()!;
    out.push(id);
    for (const child of byParent.get(id) ?? []) stack.push(child._id);
  }
  return out;
}

/** How many levels a folder's subtree spans (a leaf folder = 1). */
export function subtreeHeight<F extends FolderLike>(folders: F[], folderId: F["_id"]): number {
  const children = folders.filter((f) => f.parentId === folderId);
  if (children.length === 0) return 1;
  return 1 + Math.max(...children.map((c) => subtreeHeight(folders, c._id)));
}

export type MoveCheck = { ok: true; newDepth: number } | { ok: false; reason: string };

/**
 * Can `folderId` be moved under `newParentId` (undefined = top level)?
 * Rejects cycles and moves that would push any descendant past the depth limit.
 */
export function canMoveFolder<F extends FolderLike>(
  folders: F[],
  folderId: F["_id"],
  newParentId: F["_id"] | undefined,
): MoveCheck {
  if (newParentId === folderId) return { ok: false, reason: "A folder can't contain itself." };

  let newDepth = 0;
  if (newParentId) {
    if (descendantIds(folders, folderId).includes(newParentId)) {
      return { ok: false, reason: "A folder can't be moved into one of its own subfolders." };
    }
    const parent = folders.find((f) => f._id === newParentId);
    if (!parent) return { ok: false, reason: "Destination folder not found." };
    newDepth = parent.depth + 1;
  }

  if (newDepth + subtreeHeight(folders, folderId) > MAX_FOLDER_DEPTH) {
    return { ok: false, reason: `Folders can only be nested ${MAX_FOLDER_DEPTH} levels deep.` };
  }
  return { ok: true, newDepth };
}
