import { buildSearchText } from "@lvv/core";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { tagsForVideo } from "./tags";

/**
 * Recompute videos.searchText. Call after ANY change to title, channel,
 * description, notes, the video's tags, or its user timestamps.
 */
export async function rebuildSearchText(ctx: MutationCtx, videoId: Id<"videos">): Promise<void> {
  const video = await ctx.db.get(videoId);
  if (!video) return;
  const [tags, bookmarks] = await Promise.all([
    tagsForVideo(ctx, videoId),
    ctx.db
      .query("bookmarks")
      .withIndex("by_video_time", (q) => q.eq("videoId", videoId))
      .collect(),
  ]);
  const searchText = buildSearchText({
    title: video.title,
    channelTitle: video.channelTitle,
    description: video.description,
    notes: video.notes,
    tagNames: tags.map((t) => t.name),
    timestampLabels: bookmarks.filter((b) => b.source === "user").map((b) => b.label),
  });
  if (searchText !== video.searchText) await ctx.db.patch(videoId, { searchText });
}
