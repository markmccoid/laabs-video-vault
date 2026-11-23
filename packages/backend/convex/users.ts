import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { requireUserId } from "./lib/auth";
import { hardDelete } from "./lib/hardDelete";

export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    return user ? { _id: user._id, email: user.email ?? null } : null;
  },
});

/**
 * How long the deleting device gets to sign itself out before the user row
 * goes. Removing the row makes every open query on that device throw, so it
 * waits until the app has dropped its session.
 */
export const ACCOUNT_DELETE_GRACE_MS = 10_000;

/**
 * Permanently delete the signed-in user's account and everything in it
 * (App Store guideline 5.1.1(v)). Sign-in methods, sessions, and share tokens
 * go at once, so the account can't be signed into again and the Share
 * Extension stops. After a short grace period, purgeAccountData removes the
 * user row (from then on requireUserId rejects any access token still in
 * flight) and then the library, in batches.
 */
export const deleteAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    await deleteSignIn(ctx, userId);
    await ctx.scheduler.runAfter(ACCOUNT_DELETE_GRACE_MS, internal.users.purgeAccountData, { userId });
  },
});

/** Sessions, refresh tokens, password accounts (and their codes), and share tokens. */
async function deleteSignIn(ctx: MutationCtx, userId: Id<"users">) {
  const sessions = await ctx.db
    .query("authSessions")
    .withIndex("userId", (q) => q.eq("userId", userId))
    .collect();
  for (const session of sessions) {
    const refreshTokens = await ctx.db
      .query("authRefreshTokens")
      .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
      .collect();
    for (const token of refreshTokens) await ctx.db.delete(token._id);
    await ctx.db.delete(session._id);
  }
  const accounts = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
    .collect();
  for (const account of accounts) {
    const codes = await ctx.db
      .query("authVerificationCodes")
      .withIndex("accountId", (q) => q.eq("accountId", account._id))
      .collect();
    for (const code of codes) await ctx.db.delete(code._id);
    await ctx.db.delete(account._id);
  }
  const shareTokens = await ctx.db
    .query("shareTokens")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  for (const token of shareTokens) await ctx.db.delete(token._id);
}

/** Videos per batch; each takes its tag links, timestamps, chapters, and thumbnail with it. */
const PURGE_BATCH = 50;
/** Folders, tags, or stray tag links per batch. */
const PURGE_ROWS = 200;

/** Delete one batch of a deleted account's data. Returns true if more remain. */
async function purgeBatch(ctx: MutationCtx, userId: Id<"users">): Promise<boolean> {
  const videos = await ctx.db
    .query("videos")
    .withIndex("by_user_youtubeId", (q) => q.eq("userId", userId))
    .take(PURGE_BATCH);
  if (videos.length > 0) {
    for (const video of videos) await hardDelete(ctx, video);
    return true;
  }
  const links = await ctx.db
    .query("videoTags")
    .withIndex("by_user_tag", (q) => q.eq("userId", userId))
    .take(PURGE_ROWS);
  const tags = await ctx.db
    .query("tags")
    .withIndex("by_user_name", (q) => q.eq("userId", userId))
    .take(PURGE_ROWS);
  const folders = await ctx.db
    .query("folders")
    .withIndex("by_user_parent", (q) => q.eq("userId", userId))
    .take(PURGE_ROWS);
  for (const doc of [...links, ...tags, ...folders]) await ctx.db.delete(doc._id);
  return links.length + tags.length + folders.length > 0;
}

export const purgeAccountData = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    // First run: the user row goes before any data, so nothing new can be written.
    if (await ctx.db.get(userId)) await ctx.db.delete(userId);
    if (await purgeBatch(ctx, userId)) {
      await ctx.scheduler.runAfter(0, internal.users.purgeAccountData, { userId });
    }
  },
});
