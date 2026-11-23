import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

async function setup() {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) => ctx.db.insert("users", { email: "a@example.com" }));
  const otherId = await t.run((ctx) => ctx.db.insert("users", { email: "b@example.com" }));
  const asUser = t.withIdentity({ subject: `${userId}|session` });
  const asOther = t.withIdentity({ subject: `${otherId}|session` });
  const { videoId } = await asUser.mutation(api.videos.add, { input: "https://youtu.be/dQw4w9WgXcQ" });
  return { t, asUser, asOther, videoId };
}

const firstPage = { numItems: 100, cursor: null };

describe("watchProgress", () => {
  it("saves, and keeps the copy saved later", async () => {
    const { asUser, videoId } = await setup();
    await asUser.mutation(api.watchProgress.save, { entries: [{ videoId, seconds: 90.7, durationSec: 212, savedAt: 2000 }] });
    // An older copy from another device loses.
    await asUser.mutation(api.watchProgress.save, { entries: [{ videoId, seconds: 10, savedAt: 1000 }] });

    let { page } = await asUser.query(api.watchProgress.changedSince, { since: 0, paginationOpts: firstPage });
    expect(page.map((p) => [p.seconds, p.durationSec, p.savedAt])).toEqual([[90, 212, 2000]]);

    await asUser.mutation(api.watchProgress.save, { entries: [{ videoId, seconds: 150, savedAt: 3000 }] });
    ({ page } = await asUser.query(api.watchProgress.changedSince, { since: 0, paginationOpts: firstPage }));
    expect(page.map((p) => [p.seconds, p.durationSec])).toEqual([[150, 212]]);
  });

  it("returns only what changed since the cursor", async () => {
    const { asUser, videoId } = await setup();
    await asUser.mutation(api.watchProgress.save, { entries: [{ videoId, seconds: 30, savedAt: 1 }] });
    const { page } = await asUser.query(api.watchProgress.changedSince, { since: 0, paginationOpts: firstPage });
    const after = await asUser.query(api.watchProgress.changedSince, { since: page[0].updatedAt, paginationOpts: firstPage });
    expect(after.page).toEqual([]);
  });

  it("fills in a missing video duration", async () => {
    const { t, asUser, videoId } = await setup();
    await asUser.mutation(api.watchProgress.save, { entries: [{ videoId, seconds: 30, durationSec: 212.4, savedAt: 1 }] });
    expect((await t.run((ctx) => ctx.db.get(videoId)))!.durationSec).toBe(212);
  });

  it("skips Shorts, other users' videos, and deleted videos without failing", async () => {
    const { t, asUser, asOther, videoId } = await setup();
    await asOther.mutation(api.watchProgress.save, { entries: [{ videoId, seconds: 30, savedAt: 1 }] });
    expect((await asOther.query(api.watchProgress.changedSince, { since: 0, paginationOpts: firstPage })).page).toEqual([]);
    expect((await asUser.query(api.watchProgress.changedSince, { since: 0, paginationOpts: firstPage })).page).toEqual([]);

    await t.run((ctx) => ctx.db.patch(videoId, { isShort: true }));
    await asUser.mutation(api.watchProgress.save, { entries: [{ videoId, seconds: 30, savedAt: 1 }] });
    expect((await asUser.query(api.watchProgress.changedSince, { since: 0, paginationOpts: firstPage })).page).toEqual([]);

    await t.run((ctx) => ctx.db.delete(videoId));
    await asUser.mutation(api.watchProgress.save, { entries: [{ videoId, seconds: 30, savedAt: 1 }] });
  });

  it("survives Trash and is deleted with the video", async () => {
    const { t, asUser, videoId } = await setup();
    await asUser.mutation(api.watchProgress.save, { entries: [{ videoId, seconds: 30, savedAt: 1 }] });
    await asUser.mutation(api.videos.trash, { videoId });
    // Progress survives Trash…
    expect(await t.run((ctx) => ctx.db.query("watchProgress").collect())).toHaveLength(1);
    // …and goes when the video is deleted forever.
    await asUser.mutation(api.videos.deleteForever, { videoIds: [videoId] });
    expect(await t.run((ctx) => ctx.db.query("watchProgress").collect())).toEqual([]);
  });
});
