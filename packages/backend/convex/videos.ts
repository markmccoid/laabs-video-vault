import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { requireOwnedFolder, requireOwnedTag, requireOwnedVideo, requireOwnedVideos, requireUserId } from "./lib/auth";
import { captureVideo, lookupCapture, type CaptureResult, type LookupResult } from "./lib/capture";
import { rebuildSearchText } from "./lib/search";
import { attachTag, ensureShortTag, tagsForVideo } from "./lib/tags";
import { insertUserTimestamp } from "./lib/timestamps";
import { hardDelete } from "./lib/hardDelete";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** A video as list screens show it: the best thumbnail URL plus its tag names (alphabetical). */
async function withThumb(ctx: QueryCtx, video: Doc<"videos">) {
  const [cachedThumb, tags] = await Promise.all([
    video.thumbStorageId ? ctx.storage.getUrl(video.thumbStorageId) : null,
    tagsForVideo(ctx, video._id),
  ]);
  const tagNames = tags.map((t) => t.name).sort((a, b) => a.localeCompare(b));
  return { ...video, thumbnail: cachedThumb ?? video.thumbUrl, tagNames };
}

/** Most videos a list or search returns. TODO: paginate when libraries get large. */
const LIST_LIMIT = 200;

async function tagIdsForVideo(ctx: QueryCtx, videoId: Id<"videos">): Promise<Set<string>> {
  const links = await ctx.db
    .query("videoTags")
    .withIndex("by_video", (q) => q.eq("videoId", videoId))
    .collect();
  return new Set(links.map((l) => l.tagId));
}

const TRASH_BATCH = 50;

/** Delete up to one batch of the user's trashed videos. Returns true if more remain. */
async function purgeTrashBatch(ctx: MutationCtx, userId: Id<"users">): Promise<boolean> {
  const batch = await ctx.db
    .query("videos")
    .withIndex("by_user_deleted", (q) => q.eq("userId", userId).gte("deletedAt", 0))
    .take(TRASH_BATCH + 1);
  for (const video of batch.slice(0, TRASH_BATCH)) await hardDelete(ctx, video);
  return batch.length > TRASH_BATCH;
}

// ─── Public API ─────────────────────────────────────────────────────────────

export type AddVideoResult = CaptureResult;

/** Add a video from any pasted/shared text. See lib/capture.ts. */
export const add = mutation({
  args: {
    input: v.string(),
    folderId: v.optional(v.id("folders")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<AddVideoResult> => {
    const userId = await requireUserId(ctx);
    return await captureVideo(ctx, userId, args);
  },
});

/**
 * Save an item from the Share Queue: a share-sheet save that couldn't reach
 * the server, sent later by the main app. Same behavior as POST /share.
 */
export const saveShared = mutation({
  args: {
    input: v.string(),
    folderId: v.optional(v.id("folders")),
    notes: v.optional(v.string()),
    update: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<CaptureResult> => {
    const userId = await requireUserId(ctx);
    return await captureVideo(ctx, userId, { ...args, missingFolderToInbox: true });
  },
});

/**
 * Whether a link is already in the library, and where. The Browser Extension
 * uses it for its popup and its ✓ badge (docs/adr/0002).
 */
export const lookup = query({
  args: { input: v.string() },
  handler: async (ctx, { input }): Promise<LookupResult> => {
    const userId = await requireUserId(ctx);
    return await lookupCapture(ctx, userId, input);
  },
});

/**
 * Capture with an optional timestamp, in one transaction (Browser Extension
 * popup). `update` overwrites folder and note on an already-saved video, like
 * the Share Extension. The timestamp is always added as a new one.
 */
export const capture = mutation({
  args: {
    input: v.string(),
    folderId: v.optional(v.id("folders")),
    notes: v.optional(v.string()),
    update: v.optional(v.boolean()),
    timestamp: v.optional(v.object({ seconds: v.number(), label: v.string() })),
  },
  handler: async (ctx, { timestamp, ...args }): Promise<CaptureResult> => {
    const userId = await requireUserId(ctx);
    const result = await captureVideo(ctx, userId, { ...args, missingFolderToInbox: true });
    if (timestamp) await insertUserTimestamp(ctx, userId, result.videoId, timestamp.seconds, timestamp.label);
    return result;
  },
});

/**
 * Just Added: videos captured since `since`, in any folder, newest first.
 * The client passes `since` (justAddedSince from @lvv/core) because queries
 * can't read the clock.
 */
export const listJustAdded = query({
  args: { since: v.number() },
  handler: async (ctx, { since }) => {
    const userId = await requireUserId(ctx);
    const videos = await ctx.db
      .query("videos")
      .withIndex("by_user_addedAt", (q) => q.eq("userId", userId).gte("addedAt", since))
      .order("desc")
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .take(LIST_LIMIT);
    return await Promise.all(videos.map((vid) => withThumb(ctx, vid)));
  },
});

/**
 * Remove videos from Just Added without touching them otherwise: clearing
 * addedAt drops them out of the by_user_addedAt range. A video that goes to
 * the Trash and is captured again gets a new addedAt and shows up again.
 */
export const dismissJustAdded = mutation({
  args: { videoIds: v.array(v.id("videos")) },
  handler: async (ctx, { videoIds }) => {
    const { videos } = await requireOwnedVideos(ctx, videoIds);
    for (const video of videos) if (video.addedAt !== undefined) await ctx.db.patch(video._id, { addedAt: undefined });
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

/** Videos with a tag, newest first. */
export const listByTag = query({
  args: { tagId: v.id("tags") },
  handler: async (ctx, { tagId }) => {
    const { userId } = await requireOwnedTag(ctx, tagId);
    const links = await ctx.db
      .query("videoTags")
      .withIndex("by_user_tag", (q) => q.eq("userId", userId).eq("tagId", tagId))
      .order("desc")
      .take(LIST_LIMIT);
    const videos = await Promise.all(links.map((l) => ctx.db.get(l.videoId)));
    const live = videos.filter((vid): vid is Doc<"videos"> => vid !== null && vid.deletedAt === undefined);
    live.sort((a, b) => b._creationTime - a._creationTime);
    return await Promise.all(live.map((vid) => withThumb(ctx, vid)));
  },
});

/** Tag IDs on each of the given videos, in the same order (for the tag picker). */
export const tagsForVideos = query({
  args: { videoIds: v.array(v.id("videos")) },
  handler: async (ctx, { videoIds }) => {
    const { videos } = await requireOwnedVideos(ctx, videoIds);
    const byId = new Map(
      await Promise.all(videos.map(async (vid) => [vid._id, [...(await tagIdsForVideo(ctx, vid._id))]] as const)),
    );
    return videoIds.map((id) => (byId.get(id) ?? []) as Id<"tags">[]);
  },
});

/** Trashed videos, most recently trashed first. */
export const listTrash = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const videos = await ctx.db
      .query("videos")
      .withIndex("by_user_deleted", (q) => q.eq("userId", userId).gte("deletedAt", 0))
      .order("desc")
      .take(LIST_LIMIT);
    return await Promise.all(videos.map((vid) => withThumb(ctx, vid)));
  },
});

/**
 * Search the library. Text matches title, channel, tags, notes, and
 * description; tag chips require every chosen tag; `shorts` narrows to or
 * hides Shorts. With no text, the tag/Shorts filters alone pick the videos.
 */
export const search = query({
  args: {
    text: v.string(),
    tagIds: v.array(v.id("tags")),
    shorts: v.optional(v.union(v.literal("only"), v.literal("hide"))),
  },
  handler: async (ctx, { text, tagIds, shorts }) => {
    const userId = await requireUserId(ctx);
    const query = text.trim();
    let candidates: Doc<"videos">[];

    if (query) {
      candidates = await ctx.db
        .query("videos")
        .withSearchIndex("search", (q) => {
          const base = q.search("searchText", query).eq("userId", userId);
          return shorts ? base.eq("isShort", shorts === "only") : base;
        })
        .take(LIST_LIMIT);
    } else if (tagIds.length > 0) {
      const links = await ctx.db
        .query("videoTags")
        .withIndex("by_user_tag", (q) => q.eq("userId", userId).eq("tagId", tagIds[0]!))
        .take(1000);
      const docs = await Promise.all(links.map((l) => ctx.db.get(l.videoId)));
      candidates = docs.filter((d) => d !== null);
      candidates.sort((a, b) => b._creationTime - a._creationTime);
    } else if (shorts === "only") {
      candidates = await ctx.db
        .query("videos")
        .withIndex("by_user_youtubeId", (q) => q.eq("userId", userId))
        .take(1000);
      candidates.sort((a, b) => b._creationTime - a._creationTime);
    } else {
      return [];
    }

    const results: Doc<"videos">[] = [];
    for (const video of candidates) {
      if (video.deletedAt !== undefined) continue;
      if (shorts && video.isShort !== (shorts === "only")) continue;
      if (tagIds.length > 0) {
        const has = await tagIdsForVideo(ctx, video._id);
        if (!tagIds.every((id) => has.has(id))) continue;
      }
      results.push(video);
      if (results.length >= LIST_LIMIT) break;
    }
    return await Promise.all(results.map((vid) => withThumb(ctx, vid)));
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

/**
 * Deprecated: does nothing. App builds from before Watch Progress still call
 * this on every open; it used to patch videos.lastOpenedAt, which reloaded
 * every library list (docs/adr/0003). Remove once those builds are gone.
 */
export const markOpened = mutation({
  args: { videoId: v.id("videos") },
  handler: async () => {},
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
    const { video } = await requireOwnedVideo(ctx, videoId);
    await ctx.db.patch(videoId, { deletedAt: undefined, folderId: await liveFolderId(ctx, video) });
  },
});

/** The video's folder if it still exists, otherwise undefined (Inbox). */
async function liveFolderId(ctx: MutationCtx, video: Doc<"videos">) {
  return video.folderId && (await ctx.db.get(video.folderId)) ? video.folderId : undefined;
}

/** Move videos into a folder, or to the Inbox when folderId is omitted. */
export const move = mutation({
  args: { videoIds: v.array(v.id("videos")), folderId: v.optional(v.id("folders")) },
  handler: async (ctx, { videoIds, folderId }) => {
    const { videos } = await requireOwnedVideos(ctx, videoIds);
    if (folderId) await requireOwnedFolder(ctx, folderId);
    for (const video of videos) await ctx.db.patch(video._id, { folderId });
  },
});

export const trashMany = mutation({
  args: { videoIds: v.array(v.id("videos")) },
  handler: async (ctx, { videoIds }) => {
    const { videos } = await requireOwnedVideos(ctx, videoIds);
    const now = Date.now();
    for (const video of videos) if (video.deletedAt === undefined) await ctx.db.patch(video._id, { deletedAt: now });
  },
});

export const restoreMany = mutation({
  args: { videoIds: v.array(v.id("videos")) },
  handler: async (ctx, { videoIds }) => {
    const { videos } = await requireOwnedVideos(ctx, videoIds);
    for (const video of videos) {
      await ctx.db.patch(video._id, { deletedAt: undefined, folderId: await liveFolderId(ctx, video) });
    }
  },
});

/** Permanently delete videos. Only videos already in the Trash can be deleted. */
export const deleteForever = mutation({
  args: { videoIds: v.array(v.id("videos")) },
  handler: async (ctx, { videoIds }) => {
    const { videos } = await requireOwnedVideos(ctx, videoIds);
    if (videos.some((vid) => vid.deletedAt === undefined)) {
      throw new ConvexError("Move videos to the Trash before deleting them.");
    }
    for (const video of videos) await hardDelete(ctx, video);
  },
});

/** Permanently delete everything in the Trash (large Trashes finish in the background). */
export const emptyTrash = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    if (await purgeTrashBatch(ctx, userId)) {
      await ctx.scheduler.runAfter(0, internal.videos.continueEmptyTrash, { userId });
    }
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

// ─── Internal ───────────────────────────────────────────────────────────────

/** Continuation for emptyTrash. Internal, so taking a userId here is safe. */
export const continueEmptyTrash = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    if (await purgeTrashBatch(ctx, userId)) {
      await ctx.scheduler.runAfter(0, internal.videos.continueEmptyTrash, { userId });
    }
  },
});

// Called by youtube.fetchMetadata:

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
