import { ConvexReactClient } from "convex/react";

const url = import.meta.env.VITE_CONVEX_URL as string | undefined;

/** Why the client couldn't be made, shown in place of the app. Null when it's fine. */
export const convexConfigError: string | null = !url
  ? "VITE_CONVEX_URL is not set. Copy apps/desktop/.env.example to apps/desktop/.env.local and set it to the CONVEX_URL from packages/backend/.env.local."
  : !/^https?:\/\/[^\s]+$/.test(url)
    ? `VITE_CONVEX_URL is malformed: "${url}". Expected https://<name>.convex.cloud`
    : null;

export const convex = new ConvexReactClient(convexConfigError ? "https://invalid.convex.cloud" : url!, {
  unsavedChangesWarning: false,
});
