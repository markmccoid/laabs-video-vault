import { ConvexHttpClient } from "convex/browser";

const url = import.meta.env.WXT_CONVEX_URL as string | undefined;

/** The deployment this build talks to (sessions are stored per deployment). */
export const convexUrl = url ?? "";

/** Why the extension can't reach Convex, shown in place of the popup. Null when it's fine. */
export const convexConfigError: string | null = !url
  ? "WXT_CONVEX_URL is not set. Copy apps/extension/.env.example to apps/extension/.env.local, set it to the CONVEX_URL from packages/backend/.env.local, and rebuild."
  : !/^https?:\/\/[^\s]+$/.test(url)
    ? `WXT_CONVEX_URL is malformed: "${url}". Expected https://<name>.convex.cloud`
    : null;

/**
 * A one-shot HTTP client: no WebSocket, so every call is a single request
 * (keeps Convex usage low, and an MV3 service worker can't hold a socket).
 */
export function httpClient(token?: string | null): ConvexHttpClient {
  const client = new ConvexHttpClient(convexConfigError ? "https://invalid.convex.cloud" : url!);
  if (token) client.setAuth(token);
  return client;
}
