import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { modules } from "./test.setup";

const URL_A = "https://youtu.be/dQw4w9WgXcQ";
const URL_B = "https://www.youtube.com/watch?v=9bZkp7q19f0";

async function setup() {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) => ctx.db.insert("users", { email: "a@example.com" }));
  const otherId = await t.run((ctx) => ctx.db.insert("users", { email: "b@example.com" }));
  const asUser = t.withIdentity({ subject: `${userId}|session` });
  const asOther = t.withIdentity({ subject: `${otherId}|session` });
  const { token, tokenId } = await asUser.action(api.shareTokens.create, {});
  const folderId = await asUser.mutation(api.folders.create, { name: "Recipes" });
  return { t, userId, asUser, asOther, token, tokenId, folderId };
}

function getVideo(t: ReturnType<typeof convexTest>, id: string) {
  return t.run((ctx) => ctx.db.get(id as Id<"videos">));
}

function post(t: ReturnType<typeof convexTest>, path: string, token: string | null, body: unknown) {
  return t.fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
}

describe("share tokens", () => {
  it("stores only a hash", async () => {
    const { t, token } = await setup();
    const rows = await t.run((ctx) => ctx.db.query("shareTokens").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tokenHash).not.toBe(token);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects missing, malformed, unknown, and revoked tokens", async () => {
    const { t, asUser, token, tokenId } = await setup();
    expect((await post(t, "/share", null, { url: URL_A })).status).toBe(401);
    expect((await post(t, "/share", "nope", { url: URL_A })).status).toBe(401);
    expect((await post(t, "/share", "0".repeat(64), { url: URL_A })).status).toBe(401);
    await asUser.mutation(api.shareTokens.revoke, { tokenId });
    expect((await post(t, "/share", token, { url: URL_A })).status).toBe(401);
  });

  it("can't be revoked by another user", async () => {
    const { asOther, tokenId } = await setup();
    await expect(asOther.mutation(api.shareTokens.revoke, { tokenId })).rejects.toThrow();
  });
});

describe("POST /share", () => {
  it("saves into the chosen folder and shows in Just Added", async () => {
    const { t, asUser, token, folderId } = await setup();
    const res = await post(t, "/share", token, { url: URL_A, folderId, notes: "  try this  " });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ status: "added", folderId });

    const video = await getVideo(t, body.videoId);
    expect(video).toMatchObject({ folderId, notes: "try this" });
    expect(video!.addedAt).toBeTypeOf("number");

    const justAdded = await asUser.query(api.videos.listJustAdded, { since: Date.now() - 60_000 });
    expect(justAdded.map((v) => v._id)).toEqual([body.videoId]);
    expect(await asUser.query(api.videos.listJustAdded, { since: Date.now() + 60_000 })).toEqual([]);
  });

  it("saves to the Inbox when the folder is gone or malformed", async () => {
    const { t, asUser, token, folderId } = await setup();
    await asUser.mutation(api.folders.remove, { folderId });
    const gone = await (await post(t, "/share", token, { url: URL_A, folderId })).json();
    expect(gone).toMatchObject({ status: "added", folderId: null });
    const junk = await (await post(t, "/share", token, { url: URL_B, folderId: "not-an-id" })).json();
    expect(junk).toMatchObject({ status: "added", folderId: null });
  });

  it("won't save into another user's folder", async () => {
    const { t, asOther, token } = await setup();
    const theirs = await asOther.mutation(api.folders.create, { name: "Theirs" });
    const body = await (await post(t, "/share", token, { url: URL_A, folderId: theirs })).json();
    expect(body).toMatchObject({ status: "added", folderId: null });
  });

  it("leaves a duplicate alone unless asked to update it", async () => {
    const { t, token, folderId } = await setup();
    const first = await (await post(t, "/share", token, { url: URL_A, notes: "original" })).json();

    const dup = await (await post(t, "/share", token, { url: URL_A, folderId, notes: "other" })).json();
    expect(dup).toMatchObject({ status: "duplicate", videoId: first.videoId, folderId: null });
    expect(await getVideo(t, first.videoId)).toMatchObject({ notes: "original" });

    const upd = await (await post(t, "/share", token, { url: URL_A, folderId, notes: "edited", update: true })).json();
    expect(upd).toMatchObject({ status: "updated", folderId });
    expect(await getVideo(t, first.videoId)).toMatchObject({ folderId, notes: "edited" });
  });

  it("restores a trashed video and counts it as just added", async () => {
    const { t, asUser, token } = await setup();
    const first = await (await post(t, "/share", token, { url: URL_A })).json();
    await asUser.mutation(api.videos.trash, { videoId: first.videoId });
    await t.run((ctx) => ctx.db.patch(first.videoId, { addedAt: 0 }));

    const again = await (await post(t, "/share", token, { url: URL_A, notes: "back" })).json();
    expect(again).toMatchObject({ status: "restored", videoId: first.videoId });
    const video = await getVideo(t, first.videoId);
    expect(video!.deletedAt).toBeUndefined();
    expect(video!.notes).toBe("back");
    expect(video!.addedAt).toBeGreaterThan(0);
  });

  it("rejects text without a YouTube link", async () => {
    const { t, token } = await setup();
    const res = await post(t, "/share", token, { url: "https://example.com" });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid" });
    expect((await post(t, "/share", token, { nope: true })).status).toBe(400);
  });
});

describe("POST /share/lookup", () => {
  it("reports new, saved (with folder and note), and trashed", async () => {
    const { t, asUser, token, folderId } = await setup();
    expect(await (await post(t, "/share/lookup", token, { url: URL_A })).json()).toEqual({ status: "new" });

    const saved = await (await post(t, "/share", token, { url: URL_A, folderId, notes: "hi" })).json();
    expect(await (await post(t, "/share/lookup", token, { url: URL_A })).json()).toMatchObject({
      status: "saved",
      videoId: saved.videoId,
      folderId,
      folderName: "Recipes",
      notes: "hi",
    });

    await asUser.mutation(api.videos.trash, { videoId: saved.videoId });
    expect(await (await post(t, "/share/lookup", token, { url: URL_A })).json()).toMatchObject({ status: "trashed" });
  });

  it("only sees the token owner's library", async () => {
    const { t, asOther, token } = await setup();
    await asOther.mutation(api.videos.add, { input: URL_A });
    expect(await (await post(t, "/share/lookup", token, { url: URL_A })).json()).toEqual({ status: "new" });
  });
});

describe("videos.dismissJustAdded", () => {
  it("drops videos from Just Added and leaves them in the library", async () => {
    const { t, asUser, asOther, token, folderId } = await setup();
    const a = await (await post(t, "/share", token, { url: URL_A, folderId })).json();
    const b = await (await post(t, "/share", token, { url: URL_B })).json();
    const since = Date.now() - 60_000;

    await expect(asOther.mutation(api.videos.dismissJustAdded, { videoIds: [a.videoId] })).rejects.toThrow();
    await asUser.mutation(api.videos.dismissJustAdded, { videoIds: [a.videoId] });

    const justAdded = await asUser.query(api.videos.listJustAdded, { since });
    expect(justAdded.map((v) => v._id)).toEqual([b.videoId]);
    const video = await getVideo(t, a.videoId);
    expect(video!.folderId).toBe(folderId);
    expect(video!.deletedAt).toBeUndefined();
    expect(video!.addedAt).toBeUndefined();
  });
});

describe("videos.saveShared (Share Queue)", () => {
  it("matches /share and needs a signed-in user", async () => {
    const { t, asUser, folderId } = await setup();
    const result = await asUser.mutation(api.videos.saveShared, { input: URL_A, folderId, notes: "queued" });
    expect(result).toMatchObject({ status: "added", folderId });
    await expect(t.mutation(api.videos.saveShared, { input: URL_B })).rejects.toThrow("Not signed in");
  });
});
