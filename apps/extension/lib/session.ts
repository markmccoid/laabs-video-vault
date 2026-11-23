/**
 * The extension's own Convex Auth session (docs/adr/0002). The popup and the
 * service worker share it through chrome.storage.local, and refreshing is
 * serialized with the Web Locks API so only one context spends the
 * single-use refresh token.
 */
import { api } from "./api";
import { convexUrl, httpClient } from "./convex";

type Tokens = { token: string; refreshToken: string };

// Per deployment: a dev session must never be sent to prod (or the reverse).
const KEY = `session:${convexUrl}`;
const LOCK = "lvv-session-refresh";
/** Refresh this long before the access token expires. */
const EARLY_MS = 60_000;

export class NotSignedInError extends Error {
  constructor() {
    super("Not signed in");
  }
}

async function read(): Promise<Tokens | null> {
  const stored = await browser.storage.local.get(KEY);
  return (stored[KEY] as Tokens | undefined) ?? null;
}

async function write(tokens: Tokens | null): Promise<void> {
  if (tokens) await browser.storage.local.set({ [KEY]: tokens });
  else await browser.storage.local.remove(KEY);
}

/** The JWT's expiry in ms, or 0 if it can't be read (treat as expired). */
function expiresAt(jwt: string): number {
  try {
    const part = jwt.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const exp = (JSON.parse(atob(part)) as { exp?: number }).exp;
    return typeof exp === "number" ? exp * 1000 : 0;
  } catch {
    return 0;
  }
}

const fresh = (jwt: string) => expiresAt(jwt) - Date.now() > EARLY_MS;

export async function isSignedIn(): Promise<boolean> {
  return (await read()) !== null;
}

/** Call `listener` whenever the session is set or cleared (in any extension context). */
export function onSessionChange(listener: () => void): () => void {
  const handler = (changes: Record<string, unknown>, area: string) => {
    if (area === "local" && KEY in changes) listener();
  };
  browser.storage.onChanged.addListener(handler);
  return () => browser.storage.onChanged.removeListener(handler);
}

export async function signIn(email: string, password: string, flow: "signIn" | "signUp"): Promise<void> {
  const result = await httpClient().action(api.auth.signIn, { provider: "password", params: { email, password, flow } });
  if (!result.tokens) throw new Error("Couldn't sign in.");
  await write(result.tokens);
}

export async function signOut(): Promise<void> {
  try {
    const token = await accessToken();
    if (token) await httpClient(token).action(api.auth.signOut, {});
  } catch {
    // Already signed out on the server; clearing locally is what matters.
  }
  await write(null);
}

/**
 * A valid access token, refreshing it if it's about to expire. Null when
 * signed out (or the server rejected the refresh token). Network errors are
 * thrown and keep the session, so going offline never signs you out.
 */
export async function accessToken(): Promise<string | null> {
  const before = await read();
  if (!before) return null;
  if (fresh(before.token)) return before.token;
  return await navigator.locks.request(LOCK, async () => {
    const current = await read();
    if (!current) return null;
    // Another context refreshed while we waited for the lock.
    if (current.token !== before.token && fresh(current.token)) return current.token;
    const result = await httpClient().action(api.auth.signIn, { refreshToken: current.refreshToken });
    await write(result.tokens ?? null);
    return result.tokens?.token ?? null;
  });
}

/** A client authenticated as the signed-in user. Throws NotSignedInError when signed out. */
export async function authedClient() {
  const token = await accessToken();
  if (!token) throw new NotSignedInError();
  return httpClient(token);
}
