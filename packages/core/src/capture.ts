/**
 * Capture: getting YouTube links into the library from outside the app
 * (share sheet, clipboard, Shortcuts). See CONTEXT.md.
 */

/** How long a captured video stays in the Just Added view. */
export const JUST_ADDED_WINDOW_MS = 12 * 60 * 60 * 1000;

/**
 * Convex queries can't re-run as time passes, so clients pass the cutoff in.
 * Rounding it down to a step keeps the query args (and its cache) stable
 * between steps; a video can linger up to one step past the window.
 */
export const JUST_ADDED_STEP_MS = 5 * 60 * 1000;

export function justAddedSince(now: number): number {
  const since = now - JUST_ADDED_WINDOW_MS;
  return since - (since % JUST_ADDED_STEP_MS);
}

/**
 * The Convex HTTP-actions origin for a client URL. Cloud deployments serve
 * HTTP actions from `.convex.site`; a local backend serves them on the next port.
 */
export function convexSiteUrl(convexUrl: string): string {
  const url = new URL(convexUrl);
  if (url.hostname.endsWith(".convex.cloud")) {
    url.hostname = url.hostname.replace(/\.convex\.cloud$/, ".convex.site");
  } else if (url.port) {
    url.port = String(Number(url.port) + 1);
  }
  return url.origin;
}
