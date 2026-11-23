import { timestampLabel, timestampSeconds } from "@lvv/core";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { rebuildSearchText } from "./search";

/**
 * Add one of the user's own timestamps (a `bookmarks` row with source "user")
 * and refresh the video's search text. The caller has checked ownership.
 */
export async function insertUserTimestamp(
  ctx: MutationCtx,
  userId: Id<"users">,
  videoId: Id<"videos">,
  seconds: number,
  label: string,
): Promise<Id<"bookmarks">> {
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
}
