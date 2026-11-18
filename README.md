# LAABS Video Vault

Save, organize, and quickly find YouTube videos, with folders, tags, notes, and (soon) timestamp bookmarks. iOS first, then Mac, then Windows.

## Repo layout

```text
packages/backend   Convex: schema, auth, queries/mutations, YouTube metadata action
packages/core      Shared TS: URL parsing, chapters, durations, folder-tree rules (with tests)
apps/mobile        Expo SDK 58 (iOS/iPad), Expo Router, routes in src/app/
apps/desktop       Phase 5: Tauri v2 + React (placeholder)
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
| `npm test` | Unit tests (`@lvv/core`) |
| `npm run typecheck` | Typecheck all packages |

## Decisions so far

- **Identity:** bundle ID `com.markmccoid.laabs-video-vault`, URL scheme `laabsvideovault`.
- **Auth:** Convex Auth `~0.0.98` with email + password. Convex Auth 2.0 (released Nov 2026) is a rewrite; upgrade deliberately later. Sign in with Apple is optional: App Store rules only require it once a third-party social login is offered.
- **Folders:** nest 3 levels max (`MAX_FOLDER_DEPTH` in `@lvv/core`). A video lives in one folder; no folder = Inbox.
- **Tags:** many per video via the `videoTags` join table. Shorts get the built-in `short` tag automatically.
- **Search:** one `searchText` field per video (title, channel, tags, notes, description), rebuilt by `convex/lib/search.ts`.
- **Sharing:** personal library only. Folders will be shared by exporting/importing a `.vfolder` JSON file (Phase 6).
- **Thumbnails:** cached in Convex storage, so cards survive deleted or private videos.
- **Chapters:** chapters parsed from the description are stored as `bookmarks` with `source: "chapter"`. Tapping one seeks the embedded player.
- **Player:** the YouTube IFrame API inside `react-native-webview`, loaded from base URL `https://com.markmccoid.laabs-video-vault`. YouTube rejects WebView embeds without an https Referer (errors 152/153), so don't remove the base URL. Videos whose owners block embedding (errors 101/150) show an "Open in YouTube" card. AirPlay is enabled on the player (test on a real device); Chromecast isn't possible in an iOS web embed, so "Open in YouTube" covers casting.
- **List/grid:** the view mode is a per-device preference in AsyncStorage (`src/lib/viewMode.ts`).

## Phase plan

0. **Foundation** ✅ monorepo, Convex schema, auth, Expo app. *Remaining: first TestFlight build.*
1. **Capture & library (iOS)** ✅ paste, metadata, Shorts, Inbox, detail, embedded IFrame player with "Open in YouTube" fallback, list/grid toggle.
2. **Organization & finding**: nested folders, tags, multi-select, search + filter chips, Trash view.
3. **Capture everywhere**: Swift share extension (App Group queue + Convex HTTP action), clipboard detection, Shortcuts.
4. **Timestamp bookmarks**: capture at the current time, seek, search, share `?t=` links.
5. **Mac desktop**: Tauri v2, three-pane layout, ⌘K, drag & drop, global hotkey.
6. **Folder export/import**: `.vfolder` file, file-type registration, import summary.
7. **Extras**: smart folders, browser extension, Windows, widget, AI tagging, full backup.
