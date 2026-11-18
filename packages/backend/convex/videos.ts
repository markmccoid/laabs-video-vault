import { buildSearchText, parseYouTubeUrl, thumbnailUrl } from "@lvv/core";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query, type QueryCtx } from "./_generated/server";
import { requireOwnedVideo, requireUserId } from "./lib/auth";
import { rebuildSearchText } from "./lib/search";
import { attachTag, ensureShortTag, tagsForVideo } from "./lib/tags";

// ─── Helpers ────────────────────────────────────────────────────────────────

async function withThumb(ctx: QueryCtx, video: Doc<"videos">) {
  const cachedThumb = video.thumbStorageId ? await ctx.storage.getUrl(video.thumbStorageId) : null;
  return { ...video, thumbnail: cachedThumb ?? video.thumbUrl };
}

// ─── Public API ─────────────────────────────────────────────────────────────

export type AddVideoResult =
  | { status: "added"; videoId: Id<"videos"> }
  | { status: "restored"; videoId: Id<"videos"> }
  | { status: "duplicate"; videoId: Id<"videos">; folderId: Id<"folders"> | null };

/**
 * Add a video from any pasted/shared text. Inserts immediately with
 * placeholder metadata so the card appears instantly, then schedules the
 * YouTube metadata fetch.
 */
export const add = mutation({
  args: {
    input: v.string(),
    folderId: v.optional(v.id("folders")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<AddVideoResult> => {
    const userId = await requireUserId(ctx);
    const parsed = parseYouTubeUrl(args.input);
    if (!parsed) throw new ConvexError("That doesn't look like a YouTube link.");

    if (args.folderId) {
      const folder = await ctx.db.get(args.folderId);
      if (!folder || folder.userId !== userId) throw new ConvexError("Folder not found");
    }

    const existing = await ctx.db
      .query("videos")
      .withIndex("by_user_youtubeId", (q) => q.eq("userId", userId).eq("youtubeId", parsed.videoId))
      .unique();

    if (existing) {
      if (existing.deletedAt !== undefined) {
        await ctx.db.patch(existing._id, { deletedAt: undefined, folderId: args.folderId });
        return { status: "restored", videoId: existing._id };
      }
      return { status: "duplicate", videoId: existing._id, folderId: existing.folderId ?? null };
    }

    const notes = args.notes?.trim() ?? "";
    const base = {
      title: "",
      channelTitle: "",
      description: "",
      notes,
    };
    const videoId = await ctx.db.insert("videos", {
      userId,
      youtubeId: parsed.videoId,
      ...base,
      thumbUrl: thumbnailUrl(parsed.videoId),
      isShort: parsed.isShortUrl,
      folderId: args.folderId,
      favorite: false,
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

    return { status: "added", videoId };
  },
});

/** Videos in one folder (or the Inbox when folderId is omitted), newest first. */
export const listByFolder = query({
  args: { folderId: v.optional(v.id("folders")) },
  handler: async (ctx, { folderId }) => {
    const userId = await requireUserId(ctx);
    // TODO(Phase 2): switch to paginate() + usePaginatedQuery for large folders.
    const videos = await ctx.db
      .query("videos")
      .withIndex("by_user_folder", (q) => q.eq("userId", userId).eq("folderId", folderId))
      .order("desc")
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .take(200);
    return await Promise.all(videos.map((vid) => withThumb(ctx, vid)));
  },
});

/** Full detail for one video: tags + bookmarks (chapters included). */
export const get = query({
  args: { videoId: v.id("videos") },
  handler: async (ctx, { videoId }) => {
    const { video } = await requireOwnedVideo(ctx, videoId);
    const [tags, bookmarks] = await Promise.all([
      tagsForVideo(ctx, videoId),
      ctx.db
        .query("bookmarks")
        .withIndex("by_video_time", (q) => q.eq("videoId", videoId))
        .collect(),
    ]);
    return { ...(await withThumb(ctx, video)), tags, bookmarks };
  },
});

export const updateNotes = mutation({
  args: { videoId: v.id("videos"), notes: v.string() },
  handler: async (ctx, { videoId, notes }) => {
    await requireOwnedVideo(ctx, videoId);
    await ctx.db.patch(videoId, { notes });
    await rebuildSearchText(ctx, videoId);
  },
});

export const markOpened = mutation({
  args: { videoId: v.id("videos") },
  handler: async (ctx, { videoId }) => {
    await requireOwnedVideo(ctx, videoId);
    await ctx.db.patch(videoId, { lastOpenedAt: Date.now() });
  },
});

/** Move to Trash (soft delete). */
export const trash = mutation({
  args: { videoId: v.id("videos") },
  handler: async (ctx, { videoId }) => {
    await requireOwnedVideo(ctx, videoId);
    await ctx.db.patch(videoId, { deletedAt: Date.now() });
  },
});

export const restore = mutation({
  args: { videoId: v.id("videos") },
  handler: async (ctx, { videoId }) => {
    await requireOwnedVideo(ctx, videoId);
    await ctx.db.patch(videoId, { deletedAt: undefined });
  },
});

/** Re-fetch title/thumbnail/description from YouTube. */
export const refreshMetadata = mutation({
  args: { videoId: v.id("videos") },
  handler: async (ctx, { videoId }) => {
    const { video } = await requireOwnedVideo(ctx, videoId);
    await ctx.db.patch(videoId, { metadataState: "pending", metadataError: undefined });
    await ctx.scheduler.runAfter(0, internal.youtube.fetchMetadata, {
      videoId,
      youtubeId: video.youtubeId,
      knownShort: video.isShort,
    });
  },
});

// ─── Internal (called by youtube.fetchMetadata) ─────────────────────────────

export const applyMetadata = internalMutation({
  args: {
    videoId: v.id("videos"),
    title: v.string(),
    channelId: v.optional(v.string()),
    channelTitle: v.string(),
    description: v.string(),
    durationSec: v.optional(v.number()),
    publishedAt: v.optional(v.number()),
    thumbUrl: v.optional(v.string()),
    thumbStorageId: v.optional(v.id("_storage")),
    isShort: v.boolean(),
    chapters: v.array(v.object({ seconds: v.number(), label: v.string() })),
  },
  handler: async (ctx, { videoId, chapters, thumbStorageId, thumbUrl, ...meta }) => {
    const video = await ctx.db.get(videoId);
    if (!video) {
      // Video was hard-deleted while the fetch ran; don't leak the stored file.
      if (thumbStorageId) await ctx.storage.delete(thumbStorageId);
      return;
    }

    // Replace a previously cached thumbnail.
    if (thumbStorageId && video.thumbStorageId && video.thumbStorageId !== thumbStorageId) {
      await ctx.storage.delete(video.thumbStorageId);
    }

    await ctx.db.patch(videoId, {
      ...meta,
      isShort: video.isShort || meta.isShort,
      ...(thumbUrl ? { thumbUrl } : {}),
      ...(thumbStorageId ? { thumbStorageId } : {}),
      metadataState: "ready",
      metadataError: undefined,
    });

    if (meta.isShort) {
      await attachTag(ctx, video.userId, videoId, await ensureShortTag(ctx, video.userId));
    }

    // Replace auto-imported chapters (user bookmarks are never touched).
    const existingChapters = await ctx.db
      .query("bookmarks")
      .withIndex("by_video_time", (q) => q.eq("videoId", videoId))
      .filter((q) => q.eq(q.field("source"), "chapter"))
      .collect();
    await Promise.all(existingChapters.map((b) => ctx.db.delete(b._id)));
    for (const ch of chapters) {
      await ctx.db.insert("bookmarks", {
        userId: video.userId,
        videoId,
        seconds: ch.seconds,
        label: ch.label,
        source: "chapter",
      });
    }

    await rebuildSearchText(ctx, videoId);
  },
});

export const markMetadataFailed = internalMutation({
  args: {
    videoId: v.id("videos"),
    state: v.union(v.literal("failed"), v.literal("unavailable")),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { videoId, state, error }) => {
    const video = await ctx.db.get(videoId);
    if (!video) return;
    await ctx.db.patch(videoId, { metadataState: state, metadataError: error });
  },
});
