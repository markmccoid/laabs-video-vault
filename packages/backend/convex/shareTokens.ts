import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation, mutation } from "./_generated/server";
import { requireUserId } from "./lib/auth";
import { generateShareToken, hashShareToken } from "./lib/shareToken";

/** Most share tokens one user may hold (one per device). */
const MAX_TOKENS_PER_USER = 20;

/**
 * Create this device's share token. The app stores the token in the shared
 * Keychain item the Share Extension reads; the server keeps only its hash.
 */
export const create = action({
  args: {},
  handler: async (ctx): Promise<{ tokenId: Id<"shareTokens">; token: string }> => {
    const userId = await requireUserId(ctx);
    const token = generateShareToken();
    const tokenId: Id<"shareTokens"> = await ctx.runMutation(internal.shareTokens.insert, {
      userId,
      tokenHash: await hashShareToken(token),
    });
    return { tokenId, token };
  },
});

/** Internal, so taking a userId here is safe (it comes from `create`). */
export const insert = internalMutation({
  args: { userId: v.id("users"), tokenHash: v.string() },
  handler: async (ctx, { userId, tokenHash }) => {
    // The account was deleted while `create` was running.
    if (!(await ctx.db.get(userId))) throw new ConvexError("Not signed in");
    const existing = await ctx.db
      .query("shareTokens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(MAX_TOKENS_PER_USER + 1);
    if (existing.length >= MAX_TOKENS_PER_USER) {
      // Devices that reinstalled lose their token without revoking it. Drop the oldest.
      await ctx.db.delete(existing[0]!._id);
    }
    return await ctx.db.insert("shareTokens", { userId, tokenHash });
  },
});

/** Revoke this device's token (on sign-out). */
export const revoke = mutation({
  args: { tokenId: v.id("shareTokens") },
  handler: async (ctx, { tokenId }) => {
    const userId = await requireUserId(ctx);
    const token = await ctx.db.get(tokenId);
    if (!token) return;
    if (token.userId !== userId) throw new ConvexError("Token not found");
    await ctx.db.delete(tokenId);
  },
});
