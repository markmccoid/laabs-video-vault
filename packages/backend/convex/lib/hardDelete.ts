import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/** Permanently delete a video with its tag links, bookmarks, and cached thumbnail. */
export async function hardDelete(ctx: MutationCtx, video: Doc<"videos">) {
  const [links, bookmarks] = await Promise.all([
    ctx.db
      .query("videoTags")
      .withIndex("by_video", (q) => q.eq("videoId", video._id))
      .collect(),
    ctx.db
      .query("bookmarks")
      .withIndex("by_video_time", (q) => q.eq("videoId", video._id))
      .collect(),
  ]);
  for (const doc of [...links, ...bookmarks]) await ctx.db.delete(doc._id);
  if (video.thumbStorageId) await ctx.storage.delete(video.thumbStorageId);
  await ctx.db.delete(video._id);
}
