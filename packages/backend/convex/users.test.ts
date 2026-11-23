import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { modules } from "./test.setup";

afterEach(() => {
  vi.useRealTimers();
});

/** A user with a password account, a session + refresh token, a share token, and a small library. */
async function setup(videoCount = 3) {
  vi.useFakeTimers();
  const t = convexTest(schema, modules);
  const make = (email: string) =>
    t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { email });
      await ctx.db.insert("authAccounts", { userId, provider: "password", providerAccountId: email, secret: "hash" });
      const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 1e9 });
      await ctx.db.insert("authRefreshTokens", { sessionId, expirationTime: Date.now() + 1e9 });
      await ctx.db.insert("shareTokens", { userId, tokenHash: `hash-${email}` });
      const folderId = await ctx.db.insert("folders", { userId, name: "Recipes", depth: 0, order: 0 });
      const tagId = await ctx.db.insert("tags", { userId, name: "bread", nameLower: "bread" });
      for (let i = 0; i < videoCount; i++) {
        const videoId = await ctx.db.insert("videos", {
          userId,
          youtubeId: `vid${String(i).padStart(8, "0")}`,
          title: `Video ${i}`,
          channelTitle: "",
          description: "",
          thumbUrl: "",
          isShort: false,
          folderId,
          notes: "",
          favorite: false,
          metadataState: "ready",
          searchText: "",
        });
        await ctx.db.insert("videoTags", { userId, videoId, tagId });
        await ctx.db.insert("bookmarks", { userId, videoId, seconds: 10, label: "x", source: "user" });
      }
      return userId;
    });
  const userId = await make("a@example.com");
  const otherId = await make("b@example.com");
  return { t, userId, otherId, asUser: t.withIdentity({ subject: `${userId}|session` }) };
}

const TABLES = [
  "authAccounts",
  "authSessions",
  "authRefreshTokens",
  "shareTokens",
  "folders",
  "tags",
  "videos",
  "videoTags",
  "bookmarks",
] as const;

/** How many rows in each table belong to `userId` (refresh tokens via their session). */
async function rowsFor(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return await t.run(async (ctx) => {
    const counts: Record<string, number> = {};
    const sessions = new Set((await ctx.db.query("authSessions").collect()).filter((s) => s.userId === userId).map((s) => s._id));
    for (const table of TABLES) {
      const rows = await ctx.db.query(table).collect();
      counts[table] = rows.filter((r) =>
        "userId" in r ? r.userId === userId : "sessionId" in r ? sessions.has(r.sessionId) : false,
      ).length;
    }
    counts.users = (await ctx.db.get(userId)) ? 1 : 0;
    return counts;
  });
}

describe("users.deleteAccount", () => {
  it("removes sign-in at once, then the user row and library", async () => {
    const { t, userId, asUser } = await setup();
    await asUser.mutation(api.users.deleteAccount, {});

    // Immediately: no way to sign in again, and the Share Extension is cut off.
    const right = await rowsFor(t, userId);
    expect(right).toMatchObject({ authAccounts: 0, authSessions: 0, authRefreshTokens: 0, shareTokens: 0 });

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const after = await rowsFor(t, userId);
    expect(Object.values(after).every((n) => n === 0)).toBe(true);
    // An access token that's still in flight is now rejected.
    await expect(asUser.query(api.folders.list, {})).rejects.toThrow(/Not signed in/);
    await expect(asUser.mutation(api.videos.add, { input: "https://youtu.be/dQw4w9WgXcQ" })).rejects.toThrow(/Not signed in/);
  });

  it("purges large libraries across several batches", async () => {
    const { t, userId, asUser } = await setup(120);
    await asUser.mutation(api.users.deleteAccount, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await rowsFor(t, userId)).videos).toBe(0);
    expect((await rowsFor(t, userId)).bookmarks).toBe(0);
  });

  it("leaves other users untouched", async () => {
    const { t, otherId, asUser } = await setup();
    const before = await rowsFor(t, otherId);
    await asUser.mutation(api.users.deleteAccount, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await rowsFor(t, otherId)).toEqual(before);
  });

  it("needs a session", async () => {
    const { t } = await setup();
    await expect(t.mutation(api.users.deleteAccount, {})).rejects.toThrow(/Not signed in/);
  });
});
