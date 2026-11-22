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
- A native menu bar (File, Edit, View, Video, Window) built from one command list (`src/lib/commands.ts`). Components supply what each command does with `useCommand` (`src/components/Commands.tsx`). The same list handles the shortcut keys, so they work in the browser dev mode too. The page sees keys before the menu, so a shortcut like ⌘⌫ still edits text while you type in a field.
- Right-click or "…" menus, ↑/↓ to move through the list, drag a video onto a folder or the Inbox to move it. Moves and trash show a toast with Undo; Edit › Undo (⌘Z) runs the latest one even after the toast is gone.
- Closing the window hides it; the app keeps running in the Dock (click the icon to bring it back, ⌘Q quits).
- Trash: restore, delete forever, empty. Just Added: dismiss one or all.

The embedded YouTube player works inside the Tauri webview.

## Phase 5 remaining (agreed scope)

1. ✅ **One command list** in React drives the native menu bar, the shortcut keys, and the ⌘K palette.
2. ✅ **Native menus**:

   | Menu | Items |
   |---|---|
   | LAABS Video Vault | About, Hide ⌘H, Quit ⌘Q |
   | File | Add Video… ⌘N (fills from a clipboard link), New Folder… ⇧⌘N, Close Window ⌘W |
   | Edit | Undo ⌘Z / Redo ⇧⌘Z (text, or the last move/trash), Cut/Copy/Paste/Select All (⌘A selects all videos in the list), Copy Video Link ⇧⌘C, Find ⌘F |
   | View | Just Added ⌘1, Inbox ⌘2, Trash ⌘3, Toggle List Size ⌘\, Appearance → Light/Dark/System |
   | Video | Play/Pause Space, Mark This Moment ⌘B, Move to Folder… ⇧⌘M, Edit Tags… ⌘T, Open in YouTube ⌘O (at the current time), Refresh Metadata, Move to Trash ⌘⌫ (Delete Forever in Trash, with confirm) |
   | Window | Minimize ⌘M, Zoom |

   ↑/↓ and Escape stay plain keys.
3. ✅ **⌘K Command Palette** (View › Command Palette…, `src/components/CommandPalette.tsx`): every command that's available right now plus jumping to folders, tags, and views, ranked by `fuzzyRank` from `@lvv/core`. No video search yet.
4. ✅ **Multi-select** (selection rules in `@lvv/core` `selection.ts`; bulk actions in `src/components/videoActions.tsx`): ⌘-click, ⇧-click, ⌘A, ⇧↑/↓. Move (menu or drag the group to a folder), tag, trash with Undo; restore and delete forever in Trash. The detail pane shows "N selected" with those actions.
5. ✅ **Tag editing** (`src/components/TagEditor.tsx`): an autocompleting tag field on the detail pane that creates tags inline; rename and delete from the sidebar; bulk tagging from multi-select.
6. **Window and hotkeys**: ✅ closing the window keeps the app running in the Dock (⌘Q quits). Two fixed global hotkeys (Tauri `global-shortcut`):
   - ⇧⌘Y saves the clipboard's YouTube link to the Inbox and shows a notification: added, restored from Trash, already saved, or "No YouTube link on the clipboard".
   - ⌥⇧⌘Y opens the **Quick Add** panel (link, folder, note), a small always-on-top window. No `tauri-nspanel`: from a full-screen app it opens on its own Space.
7. A local `tauri build` you open yourself.

Not in Phase 5: folder reordering (done later for mobile and Mac together), a Settings window, choosing hotkey actions or keys, launch at login, Quick Add over full-screen apps, video search in ⌘K, signing/notarizing, auto-update.
