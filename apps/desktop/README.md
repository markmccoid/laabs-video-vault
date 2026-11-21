# @lvv/desktop — Phase 5

Tauri v2 + React + Vite app for macOS (and later Windows). It uses `@lvv/core` and the Convex API from `@lvv/backend` (`convex/react` and `@convex-dev/auth/react` work unchanged).

## Design

Styled with the **Organic Desktop** design system (https://claude.ai/artifact/RroiFySJ1jGdnv9x1vgXsB):

- `src/styles/tokens.css` is generated from the system's `tokens.json` (Light and Dark, `data-theme` override). Regenerate it rather than editing by hand when tokens change.
- `src/styles/organic.css` is the system's component layer (`components/bundle.css`), with fonts bundled through `@fontsource` instead of Google Fonts.
- `src/styles/app.css` is the app layout. It uses only tokens: no raw hex.

## Run

```bash
cp apps/desktop/.env.example apps/desktop/.env.local
```

Set `VITE_CONVEX_URL` to the `CONVEX_URL` from `packages/backend/.env.local`.

In the browser (fastest for UI work), from the repo root:

```bash
npm run dev:desktop
```

Then open http://localhost:1420.

As a native Mac app, you need Rust first (once):

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Generate the app icons from a 1024×1024 PNG (once):

```bash
npm run tauri -w @lvv/desktop -- icon path/to/icon.png
```

Then run the app:

```bash
npm run tauri -w @lvv/desktop -- dev
```

## What's here

- Sign in / create account (email + password, same accounts as iOS).
- Three panes: sidebar (Just Added, Inbox, Trash, nested folders with tones and counts, tags, appearance, account), video list, and detail.
- Detail: embedded player (YouTube IFrame API over postMessage), seekable chapters and your timestamps, "Mark this moment", notes that autosave.
- Add video (⌘N), search (⌘F), ↑/↓ to move through the list, ⌘⌫ to trash, right-click or "…" menus, drag a video onto a folder or the Inbox to move it. Moves and trash show a toast with Undo.
- Trash: restore, delete forever, empty. Just Added: dismiss one or all.

## Not yet

- Native menu bar commands and the global capture hotkey (Tauri `menu` and `global-shortcut` plugins).
- ⌘K command palette, multi-select, tag editing, folder drag-to-reorder.
- Check the YouTube embed inside the Tauri webview: the page origin there is `tauri://localhost`, and YouTube may reject embeds without an https Referer (as it does in the iOS WebView). If it does, serve the player page from an https origin.
