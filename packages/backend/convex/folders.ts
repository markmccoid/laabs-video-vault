import { canCreateFolderUnder, canMoveFolder, checkFolderName, descendantIds } from "@lvv/core";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { requireOwnedFolder, requireUserId } from "./lib/auth";

/** Generous cap: a personal library with this many folders is already unusual. */
const MAX_FOLDERS = 1000;

async function allFolders(ctx: QueryCtx, userId: Id<"users">) {
  return await ctx.db
    .query("folders")
    .withIndex("by_user_parent", (q) => q.eq("userId", userId))
    .take(MAX_FOLDERS);
}

async function nextOrder(ctx: MutationCtx, userId: Id<"users">, parentId: Id<"folders"> | undefined) {
  const siblings = await ctx.db
    .query("folders")
    .withIndex("by_user_parent", (q) => q.eq("userId", userId).eq("parentId", parentId))
    .take(MAX_FOLDERS);
  return siblings.reduce((max, f) => Math.max(max, f.order), -1) + 1;
}

function validName(raw: string): string {
  const check = checkFolderName(raw);
  if (!check.ok) throw new ConvexError(check.reason);
  return check.name;
}

/** Every folder, flat. Build the tree with buildFolderTree from @lvv/core. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return await allFolders(ctx, userId);
  },
});

export const get = query({
  args: { folderId: v.id("folders") },
  handler: async (ctx, { folderId }) => {
    const userId = await requireUserId(ctx);
    const folder = await ctx.db.get(folderId);
    // Null (not an error) so a screen showing a just-deleted folder can go back gracefully.
    return folder && folder.userId === userId ? folder : null;
  },
});

export const create = mutation({
  args: { name: v.string(), parentId: v.optional(v.id("folders")) },
  handler: async (ctx, { name, parentId }) => {
    const userId = await requireUserId(ctx);
    const parent = parentId ? (await requireOwnedFolder(ctx, parentId)).folder : undefined;
    const check = canCreateFolderUnder(parent);
    if (!check.ok) throw new ConvexError(check.reason);
    return await ctx.db.insert("folders", {
      userId,
      name: validName(name),
      parentId,
      depth: check.newDepth,
      order: await nextOrder(ctx, userId, parentId),
    });
  },
});

export const rename = mutation({
  args: { folderId: v.id("folders"), name: v.string() },
  handler: async (ctx, { folderId, name }) => {
    await requireOwnedFolder(ctx, folderId);
    await ctx.db.patch(folderId, { name: validName(name) });
  },
});

/** Move a folder (and its subfolders) under another folder, or to the top level. */
export const move = mutation({
  args: { folderId: v.id("folders"), parentId: v.optional(v.id("folders")) },
  handler: async (ctx, { folderId, parentId }) => {
    const { userId, folder } = await requireOwnedFolder(ctx, folderId);
    if (folder.parentId === parentId) return;
    const folders = await allFolders(ctx, userId);
    const check = canMoveFolder(folders, folderId, parentId);
    if (!check.ok) throw new ConvexError(check.reason);

    const shift = check.newDepth - folder.depth;
    await ctx.db.patch(folderId, { parentId, order: await nextOrder(ctx, userId, parentId) });
    if (shift !== 0) {
      for (const id of descendantIds(folders, folderId)) {
        const f = folders.find((x) => x._id === id)!;
        await ctx.db.patch(id, { depth: f.depth + shift });
      }
    }
  },
});

/**
 * Delete a folder and its subfolders. Their videos (including any in Trash)
 * move up to the deleted folder's parent, or the Inbox at the top level, so
 * nothing is lost.
 */
export const remove = mutation({
  args: { folderId: v.id("folders") },
  handler: async (ctx, { folderId }) => {
    const { userId, folder } = await requireOwnedFolder(ctx, folderId);
    const folders = await allFolders(ctx, userId);
    for (const id of descendantIds(folders, folderId)) {
      // Every video must be moved, so this is deliberately unbounded.
      const videos = await ctx.db
        .query("videos")
        .withIndex("by_user_folder", (q) => q.eq("userId", userId).eq("folderId", id))
        .collect();
      for (const video of videos) await ctx.db.patch(video._id, { folderId: folder.parentId });
      await ctx.db.delete(id);
    }
    return { movedTo: folder.parentId ?? null };
  },
});
