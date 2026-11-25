import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import type { ConvexCredentialsConfig } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { revokeShareTokensOnReset } from "./lib/passwordReset";
import schema from "./schema";
import { modules } from "./test.setup";

describe("shareTokens.revokeAllForUser", () => {
  it("deletes every token for that user and no one else's", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) => ctx.db.insert("users", { email: "a@example.com" }));
    const otherId = await t.run((ctx) => ctx.db.insert("users", { email: "b@example.com" }));
    await t.run(async (ctx) => {
      await ctx.db.insert("shareTokens", { userId, tokenHash: "a1" });
      await ctx.db.insert("shareTokens", { userId, tokenHash: "a2" });
      await ctx.db.insert("shareTokens", { userId: otherId, tokenHash: "b1" });
    });
    await t.mutation(internal.shareTokens.revokeAllForUser, { userId });
    const rows = await t.run((ctx) => ctx.db.query("shareTokens").collect());
    expect(rows.map((r) => r.tokenHash)).toEqual(["b1"]);
  });
});

describe("revokeShareTokensOnReset", () => {
  const userId = "user1" as Id<"users">;

  function wrap(result: { userId: Id<"users"> } | null) {
    const provider = {
      type: "credentials",
      id: "password",
      authorize: vi.fn(async () => result),
    } as unknown as ConvexCredentialsConfig;
    const ctx = { runMutation: vi.fn(async () => null) };
    const wrapped = revokeShareTokensOnReset(provider);
    const authorize = (flow: string) => wrapped.authorize({ flow }, ctx as never);
    return { authorize, ctx };
  }

  it("revokes all share tokens after a completed reset", async () => {
    const { authorize, ctx } = wrap({ userId });
    expect(await authorize("reset-verification")).toEqual({ userId });
    expect(ctx.runMutation).toHaveBeenCalledWith(internal.shareTokens.revokeAllForUser, { userId });
  });

  it("does nothing on sign-in, sign-up, or a failed reset", async () => {
    for (const flow of ["signIn", "signUp", "reset"]) {
      const { authorize, ctx } = wrap({ userId });
      await authorize(flow);
      expect(ctx.runMutation).not.toHaveBeenCalled();
    }
    const failed = wrap(null);
    expect(await failed.authorize("reset-verification")).toBeNull();
    expect(failed.ctx.runMutation).not.toHaveBeenCalled();
  });
});
