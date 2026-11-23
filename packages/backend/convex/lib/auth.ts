import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { Auth } from "convex/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * Every public function resolves the user here. Functions never accept a
 * userId argument from the client. A deleted account (users.deleteAccount)
 * counts as signed out.
 */
export async function requireUserId(ctx: { auth: Auth; db?: QueryCtx["db"] }): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError("Not signed in");
  // An access token outlives a deleted account by up to an hour; the user row
  // doesn't. (Actions have no db; anything they write goes through a mutation.)
  if (ctx.db && !(await ctx.db.get(userId))) throw new ConvexError("Not signed in");
  return userId;
}

/** Load a video and confirm it belongs to the signed-in user. */
export async function requireOwnedVideo(ctx: QueryCtx | MutationCtx, videoId: Id<"videos">) {
  const userId = await requireUserId(ctx);
  const video = await ctx.db.get(videoId);
  if (!video || video.userId !== userId) throw new ConvexError("Video not found");
  return { userId, video };
}

/** Most videos a single bulk call may touch. */
export const MAX_BULK = 200;

/** Load several videos and confirm every one belongs to the signed-in user. */
export async function requireOwnedVideos(ctx: QueryCtx | MutationCtx, videoIds: Id<"videos">[]) {
  if (videoIds.length > MAX_BULK) throw new ConvexError(`Select at most ${MAX_BULK} videos at a time.`);
  const userId = await requireUserId(ctx);
  const unique = [...new Set(videoIds)];
  const videos = await Promise.all(unique.map((id) => ctx.db.get(id)));
  const owned = videos.filter((v) => v !== null && v.userId === userId);
  if (owned.length !== unique.length) throw new ConvexError("Video not found");
  return { userId, videos: owned as NonNullable<(typeof videos)[number]>[] };
}

/** Load a folder and confirm it belongs to the signed-in user. */
export async function requireOwnedFolder(ctx: QueryCtx | MutationCtx, folderId: Id<"folders">) {
  const userId = await requireUserId(ctx);
  const folder = await ctx.db.get(folderId);
  if (!folder || folder.userId !== userId) throw new ConvexError("Folder not found");
  return { userId, folder };
}

/** Load a tag and confirm it belongs to the signed-in user. */
export async function requireOwnedTag(ctx: QueryCtx | MutationCtx, tagId: Id<"tags">) {
  const userId = await requireUserId(ctx);
  const tag = await ctx.db.get(tagId);
  if (!tag || tag.userId !== userId) throw new ConvexError("Tag not found");
  return { userId, tag };
}
