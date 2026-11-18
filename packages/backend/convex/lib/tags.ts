import { SHORT_TAG_NAME } from "@lvv/core";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/** Get (or create) the built-in "short" tag for a user. */
export async function ensureShortTag(ctx: MutationCtx, userId: Id<"users">): Promise<Id<"tags">> {
  const existing = await ctx.db
    .query("tags")
    .withIndex("by_user_name", (q) => q.eq("userId", userId).eq("nameLower", SHORT_TAG_NAME))
    .unique();
  if (existing) {
    if (existing.system !== "short") await ctx.db.patch(existing._id, { system: "short" });
    return existing._id;
  }
  return await ctx.db.insert("tags", {
    userId,
    name: SHORT_TAG_NAME,
    nameLower: SHORT_TAG_NAME,
    system: "short",
  });
}

/** Attach a tag to a video if it isn't already attached. */
export async function attachTag(
  ctx: MutationCtx,
  userId: Id<"users">,
  videoId: Id<"videos">,
  tagId: Id<"tags">,
): Promise<void> {
  const links = await ctx.db
    .query("videoTags")
    .withIndex("by_video", (q) => q.eq("videoId", videoId))
    .collect();
  if (links.some((l) => l.tagId === tagId)) return;
  await ctx.db.insert("videoTags", { userId, videoId, tagId });
}

export async function tagsForVideo(ctx: QueryCtx, videoId: Id<"videos">) {
  const links = await ctx.db
    .query("videoTags")
    .withIndex("by_video", (q) => q.eq("videoId", videoId))
    .collect();
  const tags = await Promise.all(links.map((l) => ctx.db.get(l.tagId)));
  return tags.filter((t) => t !== null);
}
