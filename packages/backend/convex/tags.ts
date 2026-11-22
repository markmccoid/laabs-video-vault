import { checkTagName, tagKey } from "@lvv/core";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { requireOwnedTag, requireOwnedVideos, requireUserId } from "./lib/auth";
import { rebuildSearchText } from "./lib/search";
import { attachTag } from "./lib/tags";

const MAX_TAGS = 500;
/** Videos counted per tag in `list`; the UI shows "500+" past this. */
const COUNT_CAP = 500;

function validName(raw: string): string {
  const check = checkTagName(raw);
  if (!check.ok) throw new ConvexError(check.reason);
  return check.name;
}

async function findByName(ctx: MutationCtx, userId: Id<"users">, name: string) {
  return await ctx.db
    .query("tags")
    .withIndex("by_user_name", (q) => q.eq("userId", userId).eq("nameLower", tagKey(name)))
    .unique();
}

async function linksForTag(ctx: MutationCtx, userId: Id<"users">, tagId: Id<"tags">) {
  // Every link must be visited when renaming/deleting, so this is deliberately unbounded.
  return await ctx.db
    .query("videoTags")
    .withIndex("by_user_tag", (q) => q.eq("userId", userId).eq("tagId", tagId))
    .collect();
}

/** All tags, alphabetical, with how many (non-trashed) videos use each. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const tags = await ctx.db
      .query("tags")
      .withIndex("by_user_name", (q) => q.eq("userId", userId))
      .take(MAX_TAGS);
    return await Promise.all(
      tags.map(async (tag) => {
        const links = await ctx.db
          .query("videoTags")
          .withIndex("by_user_tag", (q) => q.eq("userId", userId).eq("tagId", tag._id))
          .take(COUNT_CAP);
        const videos = await Promise.all(links.map((l) => ctx.db.get(l.videoId)));
        const count = videos.filter((vid) => vid && vid.deletedAt === undefined).length;
        return { ...tag, count };
      }),
    );
  },
});

export const get = query({
  args: { tagId: v.id("tags") },
  handler: async (ctx, { tagId }) => {
    const userId = await requireUserId(ctx);
    const tag = await ctx.db.get(tagId);
    return tag && tag.userId === userId ? tag : null;
  },
});

/** Create a tag, or return the existing one with the same name (any case). */
export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const name = validName(args.name);
    const existing = await findByName(ctx, userId, name);
    if (existing) return existing._id;
    return await ctx.db.insert("tags", { userId, name, nameLower: tagKey(name) });
  },
});

export const rename = mutation({
  args: { tagId: v.id("tags"), name: v.string() },
  handler: async (ctx, args) => {
    const { userId, tag } = await requireOwnedTag(ctx, args.tagId);
    if (tag.system) throw new ConvexError("Built-in tags can't be renamed.");
    const name = validName(args.name);
    const clash = await findByName(ctx, userId, name);
    if (clash && clash._id !== tag._id) throw new ConvexError(`You already have a tag called #${clash.name}.`);
    await ctx.db.patch(tag._id, { name, nameLower: tagKey(name) });
    for (const link of await linksForTag(ctx, userId, tag._id)) await rebuildSearchText(ctx, link.videoId);
  },
});

export const remove = mutation({
  args: { tagId: v.id("tags") },
  handler: async (ctx, { tagId }) => {
    const { userId, tag } = await requireOwnedTag(ctx, tagId);
    if (tag.system) throw new ConvexError("Built-in tags can't be deleted.");
    const links = await linksForTag(ctx, userId, tagId);
    for (const link of links) await ctx.db.delete(link._id);
    await ctx.db.delete(tagId);
    for (const link of links) await rebuildSearchText(ctx, link.videoId);
  },
});

/**
 * One-off: lowercase tags saved before names were forced to lowercase.
 * `nameLower` was already unique per user, so no two tags collide.
 * Run with `npx convex run tags:lowercaseExistingNames` (in packages/backend).
 */
export const lowercaseExistingNames = internalMutation({
  args: {},
  handler: async (ctx) => {
    let changed = 0;
    for await (const tag of ctx.db.query("tags")) {
      if (tag.name === tag.nameLower) continue;
      await ctx.db.patch(tag._id, { name: tag.nameLower });
      for (const link of await linksForTag(ctx, tag.userId, tag._id)) await rebuildSearchText(ctx, link.videoId);
      changed++;
    }
    return { changed };
  },
});

/** Add and/or remove tags on one or many videos. */
export const applyToVideos = mutation({
  args: {
    videoIds: v.array(v.id("videos")),
    add: v.array(v.id("tags")),
    remove: v.array(v.id("tags")),
  },
  handler: async (ctx, args) => {
    const { userId, videos } = await requireOwnedVideos(ctx, args.videoIds);
    for (const tagId of [...args.add, ...args.remove]) await requireOwnedTag(ctx, tagId);
    const removing = new Set<string>(args.remove);

    for (const video of videos) {
      for (const tagId of args.add) await attachTag(ctx, userId, video._id, tagId);
      if (removing.size > 0) {
        const links = await ctx.db
          .query("videoTags")
          .withIndex("by_video", (q) => q.eq("videoId", video._id))
          .collect();
        for (const link of links) if (removing.has(link.tagId)) await ctx.db.delete(link._id);
      }
      await rebuildSearchText(ctx, video._id);
    }
  },
});
