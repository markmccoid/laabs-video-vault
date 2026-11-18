import { buildSearchText } from "@lvv/core";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { tagsForVideo } from "./tags";

/**
 * Recompute videos.searchText. Call after ANY change to title, channel,
 * description, notes, or the video's tags.
 */
export async function rebuildSearchText(ctx: MutationCtx, videoId: Id<"videos">): Promise<void> {
  const video = await ctx.db.get(videoId);
  if (!video) return;
  const tags = await tagsForVideo(ctx, videoId);
  const searchText = buildSearchText({
    title: video.title,
    channelTitle: video.channelTitle,
    description: video.description,
    notes: video.notes,
    tagNames: tags.map((t) => t.name),
  });
  if (searchText !== video.searchText) await ctx.db.patch(videoId, { searchText });
}
