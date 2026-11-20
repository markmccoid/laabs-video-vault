import { buildSearchText, parseYouTubeUrl, thumbnailUrl } from "@lvv/core";
import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { rebuildSearchText } from "./search";
import { attachTag, ensureShortTag } from "./tags";

export type CaptureResult =
  | { status: "added"; videoId: Id<"videos">; folderId: Id<"folders"> | null }
  | { status: "restored"; videoId: Id<"videos">; folderId: Id<"folders"> | null }
  | { status: "duplicate"; videoId: Id<"videos">; folderId: Id<"folders"> | null }
  | { status: "updated"; videoId: Id<"videos">; folderId: Id<"folders"> | null };

export type CaptureInput = {
  /** A YouTube link, or any text containing one. */
  input: string;
  folderId?: Id<"folders">;
  notes?: string;
  /**
   * The caller showed the user this video's current folder and note and they
   * chose new ones (Share Extension "Update"), so overwrite both. Without it,
   * an already-saved video is left alone and reported as a duplicate.
   */
  update?: boolean;
  /**
   * A folder that's gone (or not the user's) falls back to the Inbox instead
   * of failing. Captures from outside the app use a device-side folder list
   * that can be out of date.
   */
  missingFolderToInbox?: boolean;
};

function parseOrThrow(input: string) {
  const parsed = parseYouTubeUrl(input);
  if (!parsed) throw new ConvexError("That doesn't look like a YouTube link.");
  return parsed;
}

async function resolveFolder(
  ctx: QueryCtx,
  userId: Id<"users">,
  folderId: Id<"folders"> | undefined,
  missingToInbox: boolean,
): Promise<Id<"folders"> | undefined> {
  if (!folderId) return undefined;
  const folder = await ctx.db.get(folderId);
  if (folder && folder.userId === userId) return folderId;
  if (missingToInbox) return undefined;
  throw new ConvexError("Folder not found");
}

async function findByYoutubeId(ctx: QueryCtx, userId: Id<"users">, youtubeId: string) {
  return await ctx.db
    .query("videos")
    .withIndex("by_user_youtubeId", (q) => q.eq("userId", userId).eq("youtubeId", youtubeId))
    .unique();
}

/**
 * Every capture route (paste, share sheet, Share Queue, later clipboard and
 * Shortcuts) ends here. Inserts immediately with placeholder metadata so the
 * card appears instantly, then schedules the YouTube metadata fetch.
 */
export async function captureVideo(
  ctx: MutationCtx,
  userId: Id<"users">,
  args: CaptureInput,
): Promise<CaptureResult> {
  const parsed = parseOrThrow(args.input);
  const folderId = await resolveFolder(ctx, userId, args.folderId, args.missingFolderToInbox ?? false);
  const notes = args.notes?.trim();
  const now = Date.now();
  const existing = await findByYoutubeId(ctx, userId, parsed.videoId);

  if (existing) {
    const trashed = existing.deletedAt !== undefined;
    if (!trashed && !args.update) {
      return { status: "duplicate", videoId: existing._id, folderId: existing.folderId ?? null };
    }
    const patch: Partial<Doc<"videos">> = { folderId };
    if (trashed) {
      patch.deletedAt = undefined;
      patch.addedAt = now;
    }
    // An update replaces the note (the user edited the existing one). A restore
    // only fills in a note when the video had none.
    const newNotes = args.update ? (notes ?? "") : !existing.notes && notes ? notes : undefined;
    if (newNotes !== undefined && newNotes !== existing.notes) patch.notes = newNotes;
    await ctx.db.patch(existing._id, patch);
    if (patch.notes !== undefined) await rebuildSearchText(ctx, existing._id);
    return { status: trashed ? "restored" : "updated", videoId: existing._id, folderId: folderId ?? null };
  }

  const base = { title: "", channelTitle: "", description: "", notes: notes ?? "" };
  const videoId = await ctx.db.insert("videos", {
    userId,
    youtubeId: parsed.videoId,
    ...base,
    thumbUrl: thumbnailUrl(parsed.videoId),
    isShort: parsed.isShortUrl,
    folderId,
    favorite: false,
    addedAt: now,
    metadataState: "pending",
    searchText: buildSearchText({ ...base, tagNames: [] }),
  });

  if (parsed.isShortUrl) {
    await attachTag(ctx, userId, videoId, await ensureShortTag(ctx, userId));
    await rebuildSearchText(ctx, videoId);
  }

  await ctx.scheduler.runAfter(0, internal.youtube.fetchMetadata, {
    videoId,
    youtubeId: parsed.videoId,
    knownShort: parsed.isShortUrl,
  });

  return { status: "added", videoId, folderId: folderId ?? null };
}

export type LookupResult =
  | { status: "new" }
  | {
      status: "saved" | "trashed";
      videoId: Id<"videos">;
      folderId: Id<"folders"> | null;
      folderName: string | null;
      notes: string;
    };

/** Whether a link is already in the user's library, and where (for the Share Extension card). */
export async function lookupCapture(ctx: QueryCtx, userId: Id<"users">, input: string): Promise<LookupResult> {
  const parsed = parseOrThrow(input);
  const existing = await findByYoutubeId(ctx, userId, parsed.videoId);
  if (!existing) return { status: "new" };
  const folder = existing.folderId ? await ctx.db.get(existing.folderId) : null;
  return {
    status: existing.deletedAt !== undefined ? "trashed" : "saved",
    videoId: existing._id,
    folderId: folder?._id ?? null,
    folderName: folder?.name ?? null,
    notes: existing.notes,
  };
}
