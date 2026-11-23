import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

const URL_A = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

async function setup() {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) => ctx.db.insert("users", { email: "a@example.com" }));
  const otherId = await t.run((ctx) => ctx.db.insert("users", { email: "b@example.com" }));
  const asUser = t.withIdentity({ subject: `${userId}|session` });
  const asOther = t.withIdentity({ subject: `${otherId}|session` });
  const folderId = await asUser.mutation(api.folders.create, { name: "Recipes" });
  return { t, asUser, asOther, folderId };
}

describe("videos.lookup + videos.capture (Browser Extension)", () => {
  it("captures into a folder with a note and a timestamp", async () => {
    const { asUser, folderId } = await setup();
    expect(await asUser.query(api.videos.lookup, { input: URL_A })).toEqual({ status: "new" });

    const result = await asUser.mutation(api.videos.capture, {
      input: URL_A,
      folderId,
      notes: "Try this",
      timestamp: { seconds: 75.9, label: "  The good part " },
    });
    expect(result).toMatchObject({ status: "added", folderId });

    const looked = await asUser.query(api.videos.lookup, { input: URL_A });
    expect(looked).toMatchObject({ status: "saved", folderName: "Recipes", notes: "Try this" });

    const video = await asUser.query(api.videos.get, { videoId: result.videoId });
    expect(video.bookmarks.map((b) => [b.seconds, b.label, b.source])).toEqual([[75, "The good part", "user"]]);
    expect(video.searchText).toContain("The good part");
  });

  it("captures without a timestamp when it was cleared", async () => {
    const { asUser } = await setup();
    const { videoId } = await asUser.mutation(api.videos.capture, { input: URL_A });
    const video = await asUser.query(api.videos.get, { videoId });
    expect(video.bookmarks).toEqual([]);
    expect(video.folderId).toBeUndefined();
  });

  it("updates folder and note on a saved video and adds a new timestamp", async () => {
    const { asUser, folderId } = await setup();
    const first = await asUser.mutation(api.videos.capture, {
      input: URL_A,
      notes: "old",
      timestamp: { seconds: 10, label: "" },
    });
    const second = await asUser.mutation(api.videos.capture, {
      input: URL_A,
      folderId,
      notes: "new",
      update: true,
      timestamp: { seconds: 20, label: "Second" },
    });
    expect(second).toEqual({ status: "updated", videoId: first.videoId, folderId });
    const video = await asUser.query(api.videos.get, { videoId: first.videoId });
    expect(video.notes).toBe("new");
    expect(video.bookmarks.map((b) => b.seconds)).toEqual([10, 20]);
  });

  it("files into the Inbox when the folder is gone", async () => {
    const { asUser, folderId } = await setup();
    await asUser.mutation(api.folders.remove, { folderId });
    const result = await asUser.mutation(api.videos.capture, { input: URL_A, folderId });
    expect(result).toMatchObject({ status: "added", folderId: null });
  });

  it("keeps each user's library separate and needs a session", async () => {
    const { t, asUser, asOther } = await setup();
    await asUser.mutation(api.videos.capture, { input: URL_A });
    expect(await asOther.query(api.videos.lookup, { input: URL_A })).toEqual({ status: "new" });
    await expect(t.query(api.videos.lookup, { input: URL_A })).rejects.toThrow(/Not signed in/);
    await expect(t.mutation(api.videos.capture, { input: URL_A })).rejects.toThrow(/Not signed in/);
  });
});
