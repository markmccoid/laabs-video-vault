/** Messages between the popup and the service worker. */
export type Message = { type: "takePendingLink" };

/** How long a right-clicked link waits for the popup to pick it up. */
export const PENDING_LINK_TTL_MS = 60_000;

/** The link from "Save to Vault", if the popup was opened by it. */
export async function takePendingLink(): Promise<string | null> {
  try {
    return ((await browser.runtime.sendMessage({ type: "takePendingLink" } satisfies Message)) as string | null) ?? null;
  } catch {
    return null;
  }
}
