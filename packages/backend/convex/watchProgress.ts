import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { MAX_BULK, requireUserId } from "./lib/auth";

/**
 * Watch Progress sync (docs/adr/0003). Devices keep their own copy, push
 * here once per viewing, and read back with `changedSince` as one-shot
 * requests. Never subscribe to these with useQuery.
 */

const entry = v.object({
  videoId: v.id("videos"),
  seconds: v.number(),
  durationSec: v.optional(v.number()),
  savedAt: v.number(),
});

/**
 * Save one or more videos' progress. A copy older than the server's is
 * ignored. Videos that are gone (deleted on another device) or are Shorts
 * are skipped rather than failing, so a device's unsent queue always drains.
 */
export const save = mutation({
  args: { entries: v.array(entry) },
  handler: async (ctx, { entries }) => {
    if (entries.length > MAX_BULK) throw new ConvexError(`Send at most ${MAX_BULK} at a time.`);
    const userId = await requireUserId(ctx);
    const now = Date.now();
    for (const e of entries) {
      const video = await ctx.db.get(e.videoId);
      if (!video || video.userId !== userId || video.isShort) continue;
      if (!Number.isFinite(e.seconds) || e.seconds < 0) continue;
      const seconds = Math.floor(e.seconds);
      const durationSec = e.durationSec && e.durationSec > 0 ? Math.round(e.durationSec) : undefined;

      const existing = await ctx.db
        .query("watchProgress")
        .withIndex("by_video", (q) => q.eq("videoId", e.videoId))
        .unique();
      if (!existing) {
        await ctx.db.insert("watchProgress", { userId, videoId: e.videoId, seconds, durationSec, savedAt: e.savedAt, updatedAt: now });
      } else if (e.savedAt > existing.savedAt) {
        await ctx.db.patch(existing._id, { seconds, durationSec: durationSec ?? existing.durationSec, savedAt: e.savedAt, updatedAt: now });
      }

      // Fill in a duration the metadata fetch never got. Rare and one-time,
      // so the library reload it causes is acceptable (ADR 0003).
      if (durationSec && !video.durationSec) await ctx.db.patch(video._id, { durationSec });
    }
  },
});

/**
 * Progress records the server changed after `since` (a previous result's
 * `updatedAt`), oldest first, a page at a time.
 */
export const changedSince = query({
  args: { since: v.number(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { since, paginationOpts }) => {
    const userId = await requireUserId(ctx);
    const result = await ctx.db
      .query("watchProgress")
      .withIndex("by_user_updated", (q) => q.eq("userId", userId).gt("updatedAt", since))
      .paginate(paginationOpts);
    return {
      ...result,
      page: result.page.map((p) => ({
        videoId: p.videoId,
        seconds: p.seconds,
        durationSec: p.durationSec,
        savedAt: p.savedAt,
        updatedAt: p.updatedAt,
      })),
    };
  },
});
