"use node";

import { parseChapters, parseIsoDuration } from "@lvv/core";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction, type ActionCtx } from "./_generated/server";

/** YouTube Shorts can be up to 3 minutes. Only probe videos at or under this. */
const MAX_SHORT_SECONDS = 180;

type DataApiVideo = {
  snippet: {
    title: string;
    description: string;
    channelId: string;
    channelTitle: string;
    publishedAt: string;
    thumbnails: Record<string, { url: string; width?: number; height?: number } | undefined>;
  };
  contentDetails: { duration: string };
};

/**
 * Fetch metadata for a newly added video.
 * - Uses the YouTube Data API v3 when YOUTUBE_API_KEY is set (title,
 *   description, duration, channel, publish date, best thumbnail).
 * - Falls back to oEmbed (no key: title, channel, thumbnail only) so local
 *   development works before the key is configured.
 * - Caches the thumbnail in Convex storage so cards survive the video being
 *   deleted or made private on YouTube.
 */
export const fetchMetadata = internalAction({
  args: {
    videoId: v.id("videos"),
    youtubeId: v.string(),
    knownShort: v.boolean(),
  },
  handler: async (ctx, { videoId, youtubeId, knownShort }) => {
    try {
      const apiKey = process.env.YOUTUBE_API_KEY;
      const meta = apiKey
        ? await fromDataApi(youtubeId, apiKey)
        : await fromOEmbed(youtubeId);

      if (meta === "unavailable") {
        await ctx.runMutation(internal.videos.markMetadataFailed, {
          videoId,
          state: "unavailable",
          error: "Video is private, deleted, or unavailable.",
        });
        return;
      }

      const isShort =
        knownShort ||
        (meta.durationSec !== undefined && meta.durationSec <= MAX_SHORT_SECONDS
          ? await probeIsShort(youtubeId)
          : false);

      const thumbStorageId = meta.thumbUrl ? await cacheThumbnail(ctx, meta.thumbUrl) : undefined;

      await ctx.runMutation(internal.videos.applyMetadata, {
        videoId,
        ...meta,
        isShort,
        thumbStorageId,
        chapters: parseChapters(meta.description),
      });
    } catch (err) {
      await ctx.runMutation(internal.videos.markMetadataFailed, {
        videoId,
        state: "failed",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
});

type Meta = {
  title: string;
  channelId?: string;
  channelTitle: string;
  description: string;
  durationSec?: number;
  publishedAt?: number;
  thumbUrl?: string;
};

async function fromDataApi(youtubeId: string, apiKey: string): Promise<Meta | "unavailable"> {
  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("part", "snippet,contentDetails");
  url.searchParams.set("id", youtubeId);
  url.searchParams.set("key", apiKey);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube Data API ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { items?: DataApiVideo[] };
  const item = body.items?.[0];
  if (!item) return "unavailable";

  const t = item.snippet.thumbnails;
  const best = t.maxres ?? t.standard ?? t.high ?? t.medium ?? t.default;

  return {
    title: item.snippet.title,
    channelId: item.snippet.channelId,
    channelTitle: item.snippet.channelTitle,
    description: item.snippet.description,
    durationSec: parseIsoDuration(item.contentDetails.duration),
    publishedAt: Date.parse(item.snippet.publishedAt) || undefined,
    thumbUrl: best?.url,
  };
}

async function fromOEmbed(youtubeId: string): Promise<Meta | "unavailable"> {
  const url = new URL("https://www.youtube.com/oembed");
  url.searchParams.set("url", `https://www.youtube.com/watch?v=${youtubeId}`);
  url.searchParams.set("format", "json");

  const res = await fetch(url);
  // oEmbed answers 400 for IDs that don't exist, 401/403 for private or
  // embed-disabled videos, and 404 for deleted ones.
  if ([400, 401, 403, 404].includes(res.status)) return "unavailable";
  if (!res.ok) throw new Error(`oEmbed ${res.status}`);
  const body = (await res.json()) as { title: string; author_name: string; thumbnail_url?: string };

  return {
    title: body.title,
    channelTitle: body.author_name,
    description: "",
    thumbUrl: body.thumbnail_url,
  };
}

/**
 * Unofficial Shorts check: /shorts/{id} returns 200 for a Short and
 * redirects to /watch for a regular video. Any other response → not a Short.
 */
async function probeIsShort(youtubeId: string): Promise<boolean> {
  try {
    const res = await fetch(`https://www.youtube.com/shorts/${youtubeId}`, {
      method: "HEAD",
      redirect: "manual",
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

async function cacheThumbnail(ctx: ActionCtx, url: string): Promise<Id<"_storage"> | undefined> {
  try {
    const res = await fetch(url);
    if (!res.ok) return undefined;
    return await ctx.storage.store(await res.blob());
  } catch {
    return undefined; // the remote thumbUrl still works
  }
}
