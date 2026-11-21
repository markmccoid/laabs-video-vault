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

describe("timestamps", () => {
  it("adds, sorts by time, and makes descriptions searchable", async () => {
    const { t, asUser, videoId } = await setup();
    await asUser.mutation(api.timestamps.add, { videoId, seconds: 220.7, label: "  Shape   the loaf " });
    await asUser.mutation(api.timestamps.add, { videoId, seconds: 30, label: "" });

    const video = await asUser.query(api.videos.get, { videoId });
    const user = video.bookmarks.filter((b) => b.source === "user");
    expect(user.map((b) => [b.seconds, b.label])).toEqual([
      [30, "0:30"],
      [220, "Shape the loaf"],
    ]);
    const doc = await t.run((ctx) => ctx.db.get(videoId));
    expect(doc!.searchText).toContain("Shape the loaf");
  });

  it("edits and deletes, keeping search text in step", async () => {
    const { t, asUser, videoId } = await setup();
    const id = await asUser.mutation(api.timestamps.add, { videoId, seconds: 5, label: "Intro" });
    await asUser.mutation(api.timestamps.update, { timestampId: id, label: "Opening riff" });
    let doc = await t.run((ctx) => ctx.db.get(videoId));
    expect(doc!.searchText).toContain("Opening riff");
    expect(doc!.searchText).not.toContain("Intro");

    await asUser.mutation(api.timestamps.remove, { timestampId: id });
    doc = await t.run((ctx) => ctx.db.get(videoId));
    expect(doc!.searchText).not.toContain("Opening riff");
  });

  it("belongs to its owner only", async () => {
    const { asUser, asOther, videoId } = await setup();
    await expect(asOther.mutation(api.timestamps.add, { videoId, seconds: 1, label: "x" })).rejects.toThrow();
    const id = await asUser.mutation(api.timestamps.add, { videoId, seconds: 1, label: "x" });
    await expect(asOther.mutation(api.timestamps.update, { timestampId: id, label: "y" })).rejects.toThrow();
    await expect(asOther.mutation(api.timestamps.remove, { timestampId: id })).rejects.toThrow();
  });
});
