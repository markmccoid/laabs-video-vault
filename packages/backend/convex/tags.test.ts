import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

async function setup() {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) => ctx.db.insert("users", { email: "a@example.com" }));
  const asUser = t.withIdentity({ subject: `${userId}|session` });
  return { t, userId, asUser };
}

describe("tag names", () => {
  it("stores new tags lowercase and finds them in any case", async () => {
    const { t, asUser } = await setup();
    const id = await asUser.mutation(api.tags.create, { name: "#React Native" });
    expect((await t.run((ctx) => ctx.db.get(id)))!.name).toBe("react native");
    expect(await asUser.mutation(api.tags.create, { name: "REACT native" })).toBe(id);
  });

  it("lowercases renames", async () => {
    const { t, asUser } = await setup();
    const id = await asUser.mutation(api.tags.create, { name: "vue" });
    await asUser.mutation(api.tags.rename, { tagId: id, name: "Svelte Kit" });
    expect((await t.run((ctx) => ctx.db.get(id)))!.name).toBe("svelte kit");
  });

  it("lowercases tags saved before the rule, keeping links and search text", async () => {
    const { t, userId, asUser } = await setup();
    const { videoId } = await asUser.mutation(api.videos.add, { input: "https://youtu.be/dQw4w9WgXcQ" });
    const tagId = await t.run((ctx) => ctx.db.insert("tags", { userId, name: "Machine Learning", nameLower: "machine learning" }));
    await asUser.mutation(api.tags.applyToVideos, { videoIds: [videoId], add: [tagId], remove: [] });

    expect(await t.mutation(internal.tags.lowercaseExistingNames, {})).toEqual({ changed: 1 });
    expect((await t.run((ctx) => ctx.db.get(tagId)))!.name).toBe("machine learning");
    expect((await t.run((ctx) => ctx.db.get(videoId)))!.searchText).toContain("machine learning");
    expect(await t.mutation(internal.tags.lowercaseExistingNames, {})).toEqual({ changed: 0 });
  });
});
