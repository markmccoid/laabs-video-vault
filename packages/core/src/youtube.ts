/**
 * YouTube URL parsing and link helpers.
 * Pure functions — shared by the Convex backend, mobile app, and desktop app.
 */

/** YouTube video IDs are 11 chars of [A-Za-z0-9_-]. */
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

/** Path prefixes where the video ID is the next path segment. */
const ID_PATH_PREFIXES = ["shorts", "live", "embed", "v", "e"];

export type ParsedYouTubeUrl = {
  videoId: string;
  /** Start offset from a `t=` / `start=` param, in seconds. */
  startSeconds?: number;
  /** True when the URL itself was a /shorts/ link. */
  isShortUrl: boolean;
};

export function isValidVideoId(id: string): boolean {
  return VIDEO_ID_RE.test(id);
}

/**
 * Extract a video ID (and optional start time) from anything a user might
 * paste or share: full URLs, short links, URLs without a scheme, URLs
 * embedded in surrounding text ("Check this out https://youtu.be/…"),
 * or a bare 11-character ID.
 * Returns null if no YouTube video can be found.
 */
export function parseYouTubeUrl(input: string): ParsedYouTubeUrl | null {
  const text = input.trim();
  if (!text) return null;

  if (isValidVideoId(text)) {
    return { videoId: text, isShortUrl: false };
  }

  for (const candidate of extractUrlCandidates(text)) {
    const parsed = parseSingleUrl(candidate);
    if (parsed) return parsed;
  }
  return null;
}

function extractUrlCandidates(text: string): string[] {
  // The leading group stops "notyoutube.com" from matching as "youtube.com".
  const re = /(?:^|[^\w.-])((?:https?:\/\/)?(?:[\w-]+\.)*(?:youtube(?:-nocookie)?\.com|youtu\.be)\/\S+)/gi;
  return Array.from(text.matchAll(re), (m) => m[1]!);
}

function parseSingleUrl(raw: string): ParsedYouTubeUrl | null {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);
  let videoId: string | undefined;
  let isShortUrl = false;

  if (host === "youtu.be" || host === "www.youtu.be") {
    videoId = segments[0];
  } else if (YOUTUBE_HOSTS.has(host)) {
    const first = segments[0]?.toLowerCase();
    if (first === "watch") {
      videoId = url.searchParams.get("v") ?? undefined;
    } else if (first && ID_PATH_PREFIXES.includes(first)) {
      videoId = segments[1];
      isShortUrl = first === "shorts";
    } else if (first === "attribution_link") {
      // /attribution_link?u=/watch%3Fv%3DID...
      const inner = url.searchParams.get("u");
      if (inner) return parseSingleUrl(`https://www.youtube.com${inner}`);
    }
  } else {
    return null;
  }

  if (!videoId || !isValidVideoId(videoId)) return null;

  const t = url.searchParams.get("t") ?? url.searchParams.get("start") ?? hashTime(url.hash);
  const startSeconds = t ? parseTimestamp(t) : undefined;

  return {
    videoId,
    isShortUrl,
    ...(startSeconds !== undefined && startSeconds > 0 ? { startSeconds } : {}),
  };
}

function hashTime(hash: string): string | null {
  const m = hash.match(/t=([^&]+)/);
  return m?.[1] ?? null;
}

/**
 * Parse "90", "90s", "1m30s", "1h2m3s", "1:30", "1:02:03" → seconds.
 * Returns undefined for anything unparseable.
 */
export function parseTimestamp(value: string): number | undefined {
  const v = value.trim().toLowerCase();
  if (/^\d+$/.test(v)) return Number(v);
  if (/^\d+s$/.test(v)) return Number(v.slice(0, -1));

  const hms = v.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (hms && (hms[1] || hms[2] || hms[3])) {
    return Number(hms[1] ?? 0) * 3600 + Number(hms[2] ?? 0) * 60 + Number(hms[3] ?? 0);
  }

  const colon = v.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
  if (colon) {
    return Number(colon[1] ?? 0) * 3600 + Number(colon[2]) * 60 + Number(colon[3]);
  }
  return undefined;
}

/** Parse an ISO-8601 duration from the Data API ("PT1H2M3S") → seconds. */
export function parseIsoDuration(iso: string): number | undefined {
  const m = iso.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return undefined;
  return (
    Number(m[1] ?? 0) * 86400 +
    Number(m[2] ?? 0) * 3600 +
    Number(m[3] ?? 0) * 60 +
    Number(m[4] ?? 0)
  );
}

/** 3725 → "1:02:05", 65 → "1:05". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

export function watchUrl(videoId: string, startSeconds?: number): string {
  const t = startSeconds && startSeconds > 0 ? `?t=${Math.floor(startSeconds)}` : "";
  return `https://youtu.be/${videoId}${t}`;
}

/** Deep link that opens the YouTube app directly (falls back to watchUrl if not installed). */
export function youtubeAppUrl(videoId: string, startSeconds?: number): string {
  const t = startSeconds && startSeconds > 0 ? `&t=${Math.floor(startSeconds)}` : "";
  return `youtube://watch?v=${videoId}${t}`;
}

export type ThumbnailQuality = "default" | "mqdefault" | "hqdefault" | "sddefault" | "maxresdefault";

/** Thumbnail URL usable immediately, before the Data API responds. hqdefault always exists. */
export function thumbnailUrl(videoId: string, quality: ThumbnailQuality = "hqdefault"): string {
  return `https://i.ytimg.com/vi/${videoId}/${quality}.jpg`;
}
