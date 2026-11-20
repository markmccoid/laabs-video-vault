/** Share tokens: see docs/adr/0001-share-token-for-share-extension.md. */

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** 32 random bytes, hex. Call only from actions (real randomness). */
export function generateShareToken(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

export async function hashShareToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return toHex(new Uint8Array(digest));
}

/** The token from an `Authorization: Bearer <token>` header, or null. */
export function bearerToken(req: Request): string | null {
  const match = /^Bearer ([0-9a-f]{64})$/.exec(req.headers.get("Authorization") ?? "");
  return match ? match[1]! : null;
}
