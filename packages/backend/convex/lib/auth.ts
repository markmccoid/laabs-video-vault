import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * Every public function resolves the user here. Functions never accept a
 * userId argument from the client.
 */
export async function requireUserId(ctx: QueryCtx | MutationCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError("Not signed in");
  return userId;
}

/** Load a video and confirm it belongs to the signed-in user. */
export async function requireOwnedVideo(ctx: QueryCtx | MutationCtx, videoId: Id<"videos">) {
  const userId = await requireUserId(ctx);
  const video = await ctx.db.get(videoId);
  if (!video || video.userId !== userId) throw new ConvexError("Video not found");
  return { userId, video };
}
