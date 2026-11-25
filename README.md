# LAABS Video Vault

Save, organize, and quickly find YouTube videos, with folders, tags, notes, and (soon) timestamp bookmarks. iOS first, then Mac, then Windows.

## Repo layout

```text
packages/backend   Convex: schema, auth, queries/mutations, YouTube metadata action
packages/core      Shared TS: URL parsing, chapters, durations, folder-tree rules (with tests)
apps/mobile        Expo SDK 58 (iOS/iPad), Expo Router, routes in src/app/
apps/desktop       Phase 5: Tauri v2 + React + Vite, Organic Desktop design system
apps/extension     Phase 6: Chromium browser extension (Manifest V3, WXT + React)
packages/ui        Organic Desktop CSS tokens, component layer, and fonts (desktop + extension)
```

npm workspaces + Turborepo. Run everything from the repo root unless noted.

## First-time setup

### 1. Install

```bash
npm install
```

### 2. Create the Convex dev deployment

```bash
cd packages/backend && npx convex dev
```

Log in, create a project named `laabs-video-vault`. This writes `packages/backend/.env.local` with `CONVEX_URL`. Leave it running while you develop; it pushes functions and regenerates `convex/_generated` on save.

### 3. Set auth keys (once per deployment)

In a second terminal:

```bash
cd packages/backend && npm run auth:keys
```

### 4. YouTube Data API key (optional but recommended)

Without a key, the backend falls back to oEmbed (title, channel, thumbnail only: no description, duration, chapters, or Shorts detection beyond `/shorts/` URLs).

1. Google Cloud Console → new project → enable **YouTube Data API v3** → Credentials → **API key**. Restrict it to the YouTube Data API.
2. Then:

```bash
cd packages/backend && npx convex env set YOUTUBE_API_KEY <your-key>
```

### 5. Point the app at Convex

```bash
cp apps/mobile/.env.example apps/mobile/.env.local
```

Set `EXPO_PUBLIC_CONVEX_URL` to the `CONVEX_URL` value from `packages/backend/.env.local`.

### 6. Run on the iOS simulator

```bash
npm run ios
```

`npm run ios` builds a dev client (`expo run:ios`). Rebuild after adding any package with native code (for example `react-native-webview`).

## TestFlight

From `apps/mobile`:

```bash
npx eas-cli@latest init
```

1. Replace the `SET_ME_*` values in `apps/mobile/eas.json` with your Convex URLs (dev for `preview`, prod for `production`). Alternatively, move them to EAS environment variables.
2. Build and submit:

```bash
npx eas-cli@latest build --profile preview --platform ios
```

```bash
npx eas-cli@latest submit --profile preview --platform ios
```

EAS syncs the App Group capability (`group.com.markmccoid.laabs-video-vault`) to the Apple Developer portal on the first build.

**Production backend:**

```bash
cd packages/backend && npx convex deploy
```

```bash
cd packages/backend && npm run auth:keys -- --prod
```

Then set `YOUTUBE_API_KEY` on prod too (`npx convex env set --prod YOUTUBE_API_KEY <key>`).

## Everyday commands

| Command | What |
|---|---|
| `npm run dev:backend` | `convex dev` (push + codegen on save) |
| `npm run dev:mobile` | Expo dev server |
| `npm run dev:extension` | Browser extension in watch mode (load `apps/extension/.output/chrome-mv3-dev` unpacked; see `apps/extension/README.md`) |
| `npm run dev:desktop` | Desktop UI in the browser at localhost:1420 (see `apps/desktop/README.md` for the native app) |
| `npm test` | Unit tests (`@lvv/core`) |
| `npm run typecheck` | Typecheck all packages |

## Decisions so far

- **Identity:** bundle ID `com.markmccoid.laabs-video-vault`, URL scheme `laabsvideovault`.
- **Auth:** Convex Auth `~0.0.98` with email + password. Convex Auth 2.0 (released Nov 2026) is a rewrite; upgrade deliberately later. Sign in with Apple is optional: App Store rules only require it once a third-party social login is offered.
- **Folders:** nest 3 levels max (`MAX_FOLDER_DEPTH` in `@lvv/core`). A video lives in one folder; no folder = Inbox. Deleting a folder deletes its subfolders and moves all their videos up to its parent (or the Inbox); nothing is deleted with it.
- **Tags:** many per video via the `videoTags` join table, unique per user ignoring case. Shorts get the built-in `short` tag automatically; it can't be renamed or deleted.
- **Trash:** soft delete (`deletedAt`). Restoring returns a video to its folder, or the Inbox if that folder is gone. "Delete Forever" and "Empty Trash" also delete tag links, bookmarks, and the cached thumbnail.
- **Search:** text search uses the Convex search index; tag chips require every chosen tag; Shorts chips narrow to or hide Shorts. Tag chips or "Shorts only" work without any text.
- **Search:** one `searchText` field per video (title, channel, tags, notes, description), rebuilt by `convex/lib/search.ts`.
- **Sharing:** personal library only. Folders will be shared by exporting/importing a `.vfolder` JSON file (Phase 7).
- **Thumbnails:** cached in Convex storage, so cards survive deleted or private videos.
- **Chapters:** chapters parsed from the description are stored as `bookmarks` with `source: "chapter"`. Tapping one seeks the embedded player.
- **Player:** the YouTube IFrame API inside `react-native-webview`, loaded from base URL `https://com.markmccoid.laabs-video-vault`. YouTube rejects WebView embeds without an https Referer (errors 152/153), so don't remove the base URL. Videos whose owners block embedding (errors 101/150) show an "Open in YouTube" card. AirPlay is enabled on the player (test on a real device); Chromecast isn't possible in an iOS web embed, so "Open in YouTube" covers casting.
- **Share extension:** native Swift target added with `@bacons/apple-targets` (the `ios/` folder is generated, so no hand-edited Xcode targets). The card offers Cancel and Save, with a folder picker defaulting to Inbox and a note. It never opens the main app, because Apple doesn't support that from share extensions. It authenticates with a per-device share token (see `docs/adr/0001`). Saves that fail go to the Share Queue in the App Group, which the app sends on foreground. When signed out, it saves nothing. Glossary: `CONTEXT.md`.
- **Account deletion:** Settings (iOS) and the account menu (Mac, click your email) offer Delete Account (App Store guideline 5.1.1(v)). `users.deleteAccount` removes sign-in, sessions, and share tokens at once; 10 seconds later (so the deleting device can sign out first) the user row goes, which makes `requireUserId` reject any access token still in flight, and the library is purged in scheduled batches.
- **Just Added:** a view of videos captured in the last 12 hours (`addedAt`), across all folders. It's not a folder.
- **Clipboard:** use the native paste button (`ClipboardPasteButton`), never a silent clipboard read, so iOS never shows the "Allow Paste" prompt.
- **Browser Extension:** one Manifest V3 build for Chromium browsers (Chrome, Edge, Brave, Arc), shared with family through an unlisted Chrome Web Store listing (loaded unpacked while developing). It signs in with its own Convex Auth session and calls the normal public functions (see `docs/adr/0002`). Popup: folder picker (Inbox by default), note, and a timestamp filled from the player when it's past 5s (editable, clearable) with an optional description. No tags. Already-saved videos offer to update folder and note; the timestamp is added as a new one. The toolbar badge shows ✓ on watch and Shorts pages when the video is saved, checked only for the active tab, cached per video for the browser session, with one-shot HTTP queries (no WebSocket) to keep Convex usage low. Failed saves show the error and keep the popup open; there's no browser queue.
- **List/grid:** the view mode is a per-device preference in AsyncStorage (`src/lib/viewMode.ts`).

## Phase plan

0. **Foundation** ✅ monorepo, Convex schema, auth, Expo app, first TestFlight build.
1. **Capture & library (iOS)** ✅ paste, metadata, Shorts, Inbox, detail, embedded IFrame player with "Open in YouTube" fallback, list/grid toggle.
2. **Organization & finding** ✅ Library home, nested folders, tags, multi-select (move/tag/trash), search + filter chips, Trash view. *Remaining: paginate long lists (capped at 200 for now), reorder folders.*
3. **Capture everywhere**: Swift share extension (App Group queue + Convex HTTP action), Just Added view with Dismiss (select all to clear it), clipboard detection, Shortcuts. *Remaining: Shortcuts. (Share tokens are already revoked on a completed password reset, `lib/passwordReset.ts`, ready for when reset is added.)*
4. **Timestamp bookmarks** ✅ capture at the current time, seek, search, share `?t=` links (swipe a timestamp).
5. **Mac desktop**: Tauri v2, three-pane layout, ⌘K, drag & drop, global hotkeys. *Done: three-pane library, sign-in, add/move/trash with Undo, notes, timestamps, drag to folders, Light/Dark, runs natively with the embedded player. Remaining: one command list driving native menus, ⌘K and keyboard shortcuts; multi-select; tag editing; the window stays running when closed; two capture hotkeys with a Quick Add panel; a local `tauri build`. Scope and menu map: `apps/desktop/README.md`.*
6. **Browser extension**: Chromium MV3 extension (`apps/extension`). Toolbar popup, ⌥⇧V, and right-click **Save to Vault** on YouTube links all open the same popup; a paste field on pages without a video; timestamp at the player's current time; ✓ badge for saved videos. Scope and setup: `apps/extension/README.md`.
7. **Folder export/import**: `.vfolder` file, file-type registration, import summary.
8. **Password reset**: email code via Resend (`Password({ reset })` in `convex/auth.ts`), "Forgot password" on iOS and Mac sign-in, and an end-to-end check that a completed reset signs out other sessions and revokes every share token (the revoke hook is already in `lib/passwordReset.ts`).
9. **Extras**: smart folders, Firefox/Safari extension, Windows, widget, AI tagging, full backup, folder reordering (mobile and Mac together). Mac: a Settings window (choose what the hotkeys do, custom keys, launch at login), Quick Add over full-screen apps, video search in ⌘K, signing/notarizing and auto-update.
