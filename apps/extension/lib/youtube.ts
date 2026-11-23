import { parseYouTubeUrl, watchUrl, type ParsedYouTubeUrl } from "@lvv/core";

/**
 * The video a YouTube page is showing: watch and Shorts pages only (not the
 * home page, a channel, or search, even if the URL carries a stray `v=`).
 */
export function pageVideo(url: string | undefined): ParsedYouTubeUrl | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const youtube = u.hostname === "youtube.com" || u.hostname.endsWith(".youtube.com") || u.hostname === "youtu.be";
  if (!youtube) return null;
  const isVideoPage = u.hostname === "youtu.be" || u.pathname === "/watch" || u.pathname.startsWith("/shorts/");
  return isVideoPage ? parseYouTubeUrl(url) : null;
}

/** Link patterns for the right-click "Save to Vault" item. */
export const VIDEO_LINK_PATTERNS = [
  "*://*.youtube.com/watch*",
  "*://*.youtube.com/shorts/*",
  "*://youtu.be/*",
  "*://*.youtube-nocookie.com/embed/*",
];

/**
 * The main player's current time in a tab, or null when there's no player.
 * Runs in the page (isolated world), so it only reads the <video> element.
 */
export async function playerSeconds(tabId: number): Promise<number | null> {
  try {
    const [result] = await browser.scripting.executeScript({
      target: { tabId },
      func: () => {
        const visibleArea = (v: HTMLVideoElement) => {
          const r = v.getBoundingClientRect();
          const w = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0));
          const h = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
          return w * h;
        };
        // Watch page: the main player. Shorts: the one on screen.
        const main = document.querySelector<HTMLVideoElement>("#movie_player video.html5-main-video");
        const videos = Array.from(document.querySelectorAll("video"));
        const best =
          main && visibleArea(main) > 0 ? main : videos.sort((a, b) => visibleArea(b) - visibleArea(a))[0];
        return best ? best.currentTime : null;
      },
    });
    const seconds = result?.result;
    return typeof seconds === "number" ? seconds : null;
  } catch {
    return null; // Not injectable (e.g. the tab navigated away).
  }
}

/** Title and channel from oEmbed, for links that aren't the open tab. Null if YouTube doesn't know it. */
export async function oembed(videoId: string): Promise<{ title: string; channel: string } | null> {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watchUrl(videoId))}`);
    if (!res.ok) return null;
    const body = (await res.json()) as { title?: string; author_name?: string };
    return body.title ? { title: body.title, channel: body.author_name ?? "" } : null;
  } catch {
    return null;
  }
}

/** "Some video - YouTube" → "Some video"; "(3) Some video - YouTube" → "Some video". */
export function cleanTabTitle(title: string | undefined): string {
  return (title ?? "").replace(/^\(\d+\)\s*/, "").replace(/\s*-\s*YouTube$/, "").trim();
}
