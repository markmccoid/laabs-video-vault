import type { Id } from "./api";

/** Where a video was before a move, so Undo can put each one back. */
export type Origin = { videoId: Id<"videos">; folderId: Id<"folders"> | null };

export const originOf = (v: { _id: Id<"videos">; folderId?: Id<"folders"> }): Origin => ({
  videoId: v._id,
  folderId: v.folderId ?? null,
});

type Move = (args: { videoIds: Id<"videos">[]; folderId?: Id<"folders"> }) => Promise<unknown>;

/** Undo a move: one call per original folder, since a selection can come from several. */
export function moveBack(move: Move, origins: Origin[]): Promise<unknown> {
  const byFolder = new Map<Id<"folders"> | null, Id<"videos">[]>();
  for (const o of origins) byFolder.set(o.folderId, [...(byFolder.get(o.folderId) ?? []), o.videoId]);
  return Promise.all([...byFolder].map(([folderId, videoIds]) => move({ videoIds, folderId: folderId ?? undefined })));
}

/** The folder they all share, or undefined (Inbox) when they're spread out. */
export function commonFolder(origins: Origin[]): Id<"folders"> | undefined {
  const first = origins[0]?.folderId ?? null;
  return origins.every((o) => o.folderId === first) ? (first ?? undefined) : undefined;
}
