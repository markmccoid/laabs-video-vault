import { timestampLabel, timestampSeconds } from "@lvv/core";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, type MutationCtx } from "./_generated/server";
import { requireOwnedVideo, requireUserId } from "./lib/auth";
import { rebuildSearchText } from "./lib/search";

/**
 * The user's own timestamps on a video: a time plus a short description.
 * Stored as `bookmarks` with source "user" (chapters are source "chapter"),
 * and read through `videos.get`.
 */

async function requireOwnedTimestamp(ctx: MutationCtx, timestampId: Id<"bookmarks">) {
  const userId = await requireUserId(ctx);
  const bookmark = await ctx.db.get(timestampId);
  if (!bookmark || bookmark.userId !== userId || bookmark.source !== "user") {
    throw new ConvexError("Timestamp not found");
  }
  return bookmark;
}

export const add = mutation({
  args: { videoId: v.id("videos"), seconds: v.number(), label: v.string() },
  handler: async (ctx, { videoId, seconds, label }) => {
    const { userId } = await requireOwnedVideo(ctx, videoId);
    const at = timestampSeconds(seconds);
    const id = await ctx.db.insert("bookmarks", {
      userId,
      videoId,
      seconds: at,
      label: timestampLabel(label, at),
      source: "user",
    });
    await rebuildSearchText(ctx, videoId);
    return id;
  },
});

export const update = mutation({
  args: { timestampId: v.id("bookmarks"), label: v.string() },
  handler: async (ctx, { timestampId, label }) => {
    const bookmark = await requireOwnedTimestamp(ctx, timestampId);
    await ctx.db.patch(timestampId, { label: timestampLabel(label, bookmark.seconds) });
    await rebuildSearchText(ctx, bookmark.videoId);
  },
});

export const remove = mutation({
  args: { timestampId: v.id("bookmarks") },
  handler: async (ctx, { timestampId }) => {
    const bookmark = await requireOwnedTimestamp(ctx, timestampId);
    await ctx.db.delete(timestampId);
    await rebuildSearchText(ctx, bookmark.videoId);
  },
});
