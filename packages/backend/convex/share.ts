/**
 * HTTP endpoints for the iOS Share Extension. It authenticates with a share
 * token (docs/adr/0001), not a Convex Auth session, so these resolve the user
 * from the token's hash inside internal functions.
 */
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { httpAction, internalMutation, internalQuery, type QueryCtx } from "./_generated/server";
import { captureVideo, lookupCapture, type CaptureResult, type LookupResult } from "./lib/capture";
import { bearerToken, hashShareToken } from "./lib/shareToken";

type Unauthorized = { error: "unauthorized" };
type Failed = { error: "invalid"; message: string };

async function userForToken(ctx: QueryCtx, tokenHash: string) {
  const token = await ctx.db
    .query("shareTokens")
    .withIndex("by_hash", (q) => q.eq("tokenHash", tokenHash))
    .unique();
  return token ? { tokenId: token._id, userId: token.userId } : null;
}

function invalid(err: unknown): Failed {
  if (err instanceof ConvexError && typeof err.data === "string") return { error: "invalid", message: err.data };
  throw err;
}

export const lookupForToken = internalQuery({
  args: { tokenHash: v.string(), input: v.string() },
  handler: async (ctx, { tokenHash, input }): Promise<LookupResult | Unauthorized | Failed> => {
    const owner = await userForToken(ctx, tokenHash);
    if (!owner) return { error: "unauthorized" };
    try {
      return await lookupCapture(ctx, owner.userId, input);
    } catch (err) {
      return invalid(err);
    }
  },
});

export const saveForToken = internalMutation({
  args: {
    tokenHash: v.string(),
    input: v.string(),
    folderId: v.optional(v.string()),
    notes: v.optional(v.string()),
    update: v.optional(v.boolean()),
  },
  handler: async (ctx, { tokenHash, folderId, ...args }): Promise<CaptureResult | Unauthorized | Failed> => {
    const owner = await userForToken(ctx, tokenHash);
    if (!owner) return { error: "unauthorized" };
    await ctx.db.patch(owner.tokenId, { lastUsedAt: Date.now() });
    try {
      return await captureVideo(ctx, owner.userId, {
        ...args,
        // The extension's folder list can be stale or malformed; anything unknown means Inbox.
        folderId: (folderId && ctx.db.normalizeId("folders", folderId)) || undefined,
        missingFolderToInbox: true,
      });
    } catch (err) {
      return invalid(err);
    }
  },
});

// ─── HTTP ───────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function respond(result: { error?: string } & object) {
  if ("error" in result && result.error === "unauthorized") return json(result, 401);
  if ("error" in result && result.error === "invalid") return json(result, 400);
  return json(result);
}

/** Parse a JSON object body; null when it isn't one. */
async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await req.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const optionalString = (value: unknown) => (typeof value === "string" ? value : undefined);

/** POST /share/lookup { url } → whether the video is already saved, and where. */
export const lookup = httpAction(async (ctx, req) => {
  const token = bearerToken(req);
  if (!token) return json({ error: "unauthorized" }, 401);
  const body = await readBody(req);
  if (!body || typeof body.url !== "string") return json({ error: "invalid", message: "Missing url" }, 400);
  const result = await ctx.runQuery(internal.share.lookupForToken, {
    tokenHash: await hashShareToken(token),
    input: body.url,
  });
  return respond(result);
});

/** POST /share { url, folderId?, notes?, update? } → saves the video. */
export const save = httpAction(async (ctx, req) => {
  const token = bearerToken(req);
  if (!token) return json({ error: "unauthorized" }, 401);
  const body = await readBody(req);
  if (!body || typeof body.url !== "string") return json({ error: "invalid", message: "Missing url" }, 400);
  const result = await ctx.runMutation(internal.share.saveForToken, {
    tokenHash: await hashShareToken(token),
    input: body.url,
    folderId: optionalString(body.folderId),
    notes: optionalString(body.notes),
    update: body.update === true ? true : undefined,
  });
  return respond(result);
});

