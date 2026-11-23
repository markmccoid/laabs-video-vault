# @lvv/extension — Phase 6

The **Browser Extension** (see `CONTEXT.md`): one Manifest V3 build for Chromium browsers (Chrome, Edge, Brave, Arc), built with [WXT](https://wxt.dev) + React. Styles come from `@lvv/ui` (Organic Desktop), shared with the Mac app.

## Run

```bash
cp apps/extension/.env.example apps/extension/.env.local
```

Set `WXT_CONVEX_URL` to the `CONVEX_URL` from `packages/backend/.env.local` (the same value as the desktop app's `VITE_CONVEX_URL`).

Build in watch mode, from the repo root:

```bash
npm run dev:extension
```

Then in Chrome open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and pick `apps/extension/.output/chrome-mv3-dev`. After a rebuild, click the reload icon on the extension's card (and reopen the popup).

For a production build (`.output/chrome-mv3`), put the prod URL in `apps/extension/.env.production.local` (gitignored). Production builds read it ahead of `.env.local`, so watch mode keeps using dev:

```bash
echo "WXT_CONVEX_URL=https://<prod-name>.convex.cloud" > apps/extension/.env.production.local
```

```bash
npm run build:extension
```

Load `.output/chrome-mv3` unpacked. If the dev build is loaded too, only one of them can have ⌥⇧V; disable the dev one when you're not working on it.

The shortcut defaults to **⌥⇧V** (Alt+Shift+V). Change it at `chrome://extensions/shortcuts`.

## Chrome Web Store (unlisted)

Family computers install it from an unlisted store listing, so they need no Developer mode and get updates automatically. To ship a version:

1. Bump `version` in `apps/extension/package.json`.
2. From `apps/extension`, build the prod zip (uses `.env.production.local`):

   ```bash
   npx wxt zip
   ```

3. Upload `.output/lvvextension-<version>-chrome.zip` in the Developer Dashboard.

Listing screenshots live in `store/` (1280×800 and 640×400 JPEGs, no alpha). Keep them out of `public/`, or they ship inside the extension.

## What it does

- **Popup** (toolbar button or ⌥⇧V) for the open tab's video: folder (Inbox by default), note, and a timestamp. On a watch or Shorts page the timestamp is filled from the player when it's past 5 seconds. You can edit it (`12:34`, `1:02:03`, `90`) or clear it to save without one, and add an optional description. There's no tag picker.
- **Already saved**: the popup says where the video is, opens with its current folder and note, and **Update** replaces them. A timestamp is always added as a new one. A video in the Trash is restored.
- **Save to Vault**: right-click any YouTube link (thumbnails, search results, links on other sites) to open the same popup for that link. If Chrome won't open the popup, it opens in a small window instead.
- **No video on the page**: the popup shows a paste field.
- **✓ badge** on the toolbar icon when the current watch or Shorts page is already in your vault.
- **Signed out**: the popup shows sign-in (same accounts as iOS and Mac). A failed save shows the error and keeps the popup open; there's no offline queue.

## How it talks to Convex

- Its own Convex Auth session, not a share token (`docs/adr/0002`). Tokens live in `chrome.storage.local`, and refreshing is serialized with a Web Lock so the popup and the service worker never both spend the refresh token.
- Every call is a one-shot `ConvexHttpClient` request (no WebSocket). It uses `videos.lookup`, `videos.capture` (capture plus an optional timestamp in one transaction), and `folders.list`.
- Badge cost: one `videos.lookup` per video per browser session, for the active tab only. "Saved" is cached until the browser closes; "not saved" is re-checked after 10 minutes so videos saved on another device show up. Saving from the popup updates the cache at once.

## Permissions

`activeTab` and `scripting` (read the open tab's URL and the player's current time), `contextMenus` (Save to Vault), `storage` (session and badge cache), and host access to `youtube.com` only (badge, player time, oEmbed titles for right-clicked links). These are kept small so a Chrome Web Store listing later needs no changes.

## Layout

- `entrypoints/background.ts`: service worker (context menu, ✓ badge, handing a right-clicked link to the popup).
- `entrypoints/popup/`: the popup (`Capture.tsx`, `SignIn.tsx`).
- `lib/session.ts`: sign-in, token refresh, sign-out. `lib/badge.ts`: badge cache. `lib/youtube.ts`: page detection, player time, oEmbed.
