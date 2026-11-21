# Shelf redesign: phased plan

Source: `design_handoff_shelf/` (README, `ShelfApp.dc.html`, `Shelf Canvas.dc.html`, screenshots).
Branch: `shelf-redesign`. Goal: restyle the mobile app with the Organic tokens and the Shelf layouts, keeping the existing Convex data layer and Expo Router routes.

## Ground rules

- **Native first.** Use the native stack header (iOS 26 glass buttons come free), `Stack.Toolbar` menus, `formSheet` sheets, the native bottom search field (`Stack.Toolbar.SearchBarSlot`), and `@expo/ui/swift-ui` (`Host`, `Picker` segmented, `Form`/`Section`, `Toggle`, glass buttons) where a SwiftUI control exists. Hand-drawn RN views only for content the system has no control for (folder cards, video rows, tree rows, notes card).
- **Tokens in one place.** `src/lib/theme.ts` holds Organic colours, type, radii, spacing, plus a derived dark palette. Theme override (System/Light/Dark) is a persisted preference.
- **Fonts.** Caprasimo (headings) and Figtree 400/600/700 (body) via `@expo-google-fonts/*` + `expo-font` config plugin, so they are embedded at build time and usable by SwiftUI `font({ family })` too.
- **Icons.** SF Symbols via `expo-symbols` (already used). Mapping per the README.
- **No backend schema change.** Folder tone maps onto the existing `folders.color` field (`accent` | `sage` | `neutral`), default by top-level position. Notes, tags, Inbox, Trash, Just Added all exist already.

## Screen → route map

| Design screen | Route / component today | Plan |
|---|---|---|
| 1a Library Grid, 1c Tree | `(app)/index.tsx` `LibraryHome` (grouped NavRows) | Rewrite: large title + subtitle, `FolderGrid` / `FolderTree`, Inbox section with video rows. Layout from `useLibraryLayout()` (Settings). |
| 1b List, 1d Columns | — | Later phase (layout preference already allows them). |
| Top bar (gear, Select, +) | `Stack.Toolbar` ⋯ menu in index / `VideoListScreen` | Left gear → `/settings`; right Select + accent `+` menu (Add video, New folder/subfolder). |
| Bottom search field | `Stack.SearchBar` in header | `Stack.Toolbar.SearchBarSlot` (bottom, iOS 26). |
| 2a Folder detail | `(app)/folder/[id].tsx` + `VideoListScreen` | Breadcrumb pills, depth dots + "Level N of 3 · X videos", subfolder rows, dashed New subfolder / deepest-level pill, Videos header. |
| Video row (shared) | `VideoRow`, `VideoThumb`, `VideoCard` | Restyle: 128×72 thumb r16, duration pill, play disc, title 15/700, meta, ≤3 tag chips + "+N", "…" menu. Lists drop grid video cards (the design has rows only). |
| 2c Move sheet | `(app)/move.tsx` | Tree with guide lines + radios, Current badge, inline New folder field, Move pill (disabled until changed). Still supports folder moves. |
| 2f Search | `SearchResults` in index | Scope `Picker` (All · Title · Description · Tags), Recent (4, AsyncStorage), Browse by tag chips, "N results", highlighted matches, folder path, description snippet. |
| 2i Player + Notes | `(app)/video/[id].tsx` | Full-screen modal, floating close/… buttons, Caprasimo title, folder card, tag chips + "+ Tag", description, **My notes** card (600ms autosave, status, "Add m:ss" stamp, word count, tappable stamps seek), More in folder. |
| 2e Tags sheet | `(app)/tag-picker.tsx` | Current tags as sage pills with ✕, find-or-create field, Create pill, filtered suggestions. Multi-video = shared tags. |
| 2d New folder sheet | `useFolderActions().newFolder` (Alert.prompt) | New route `(app)/new-folder.tsx` (formSheet): big name field, parent pills, depth dots. |
| 2g Add video sheet | `AddVideoBar` (inline field) | New route `(app)/add.tsx` (formSheet): link field + native paste button, preview card, Save-to tree picker (shared with Move), tags. |
| 2h Share extension | `targets/share/ShareView.swift` | SwiftUI restyle with Organic colours + bundled fonts, title "Save to Shelf". |
| 2j Settings | — (sign out lives in index ⋯ menu) | New route `(app)/settings.tsx`: Appearance (Theme, Library layout — `@expo/ui` segmented Pickers), Export/Import (disabled, Phase 6), Adding videos explainer, Library (Trash, Just Added), Account (Sign out), footer counts. |
| Context menu, drag-to-folder, multi-select toolbar | `VideoListScreen` toolbar; no drag | Multi-select kept (restyled). Context menu + drag are a later phase. |
| Toast with Undo | `components/Toast.tsx` | Later phase (needs undo snapshots for move/delete). |

## Phases

Status (2026-11-19): Phases 1–6 built on `shelf-redesign` and checked on the iPhone 17 simulator. The share extension restyle compiles but wasn't exercised from the YouTube app.

### Phase 1 — Foundation
- `npx expo install @expo/ui expo-font @expo-google-fonts/caprasimo @expo-google-fonts/figtree`; add the `expo-font` config plugin with the TTFs; dev-client rebuild.
- Rewrite `theme.ts`: Organic scales (`accent`, `sage`, `neutral`), semantic tokens (`bg`, `surface`, `text`, `muted`, `divider`, `accentText`…), `fonts`, `radius`, `space`; dark palette; `ThemePreferenceProvider` (System/Light/Dark, AsyncStorage) feeding `useTheme()` and the stack's `contentStyle`/header fonts.
- `lib/preferences.ts`: `libraryLayout` (grid | list | tree | columns, default grid) and theme, persisted.
- `lib/folderTone.ts`: tone of a folder = its top-level ancestor's `color`, or by index (accent, sage, neutral).
- Shared primitives in `components/ui/`: `Txt` (font variants), `Chip`, `DepthDots`, `PillButton`, `SectionTitle`.

### Phase 2 — Library (Grid + Tree) and the shared video row
- Library header: large title "Library" (Caprasimo via `headerLargeTitleStyle`), subtitle "N videos · M folders".
- Toolbar: gear (left) → Settings; Select + accent `+` menu (right). Bottom native search slot.
- `FolderGrid` (2 cols, tone fills, decorative circle, dashed New folder card) and `FolderTree` (surface container, expandable rows, 22pt indent, counts, New folder row).
- Inbox section ("Not filed yet") with restyled `VideoRow`s; Just Added row when non-empty.
- Multi-select in Library acts on Inbox videos.

### Phase 3 — Folder detail + Move sheet
- Folder detail header per 2a, folder ⋯ actions kept (rename, move, delete).
- Shared `FolderPicker` (tree, guide lines, radios, Current badge, inline new folder with depth rule from `@lvv/core`).
- Move sheet built on `FolderPicker`, custom sheet header (✕ · title · Move pill).

### Phase 4 — Search
- Search mode in Library: scope `Picker` (segmented, `@expo/ui`), Recent searches (keep 4), Browse by tag.
- Results: server search (`api.videos.search`) then client-side scope filter; highlight + description snippet + folder path in `VideoRow`.

### Phase 5 — Player + Notes
- `video/[id]` as `fullScreenModal`, floating glass close / … buttons.
- `YouTubePlayer` handle gains `getCurrentTime()`.
- Notes card: debounce 600ms autosave with status, "Add m:ss" pill, word count, stamps parsed to tappable seek chips.
- Folder card with Move, tag chips + "+ Tag", description, chapters, More in folder.

### Phase 6 — Tags, New folder, Add video, Share extension, Settings
- Tags sheet rewrite. New folder sheet route (replaces `Alert.prompt` for create). Add video sheet route (replaces inline `AddVideoBar`). Share extension restyle. Settings route.

### Later (not in this pass)
- Library List and Columns layouts; drag-to-folder (RNGH long-press + drop targets); context menu with preview; Toast with Undo for every move/delete; Export/Import (README Phase 6).

## Verification per phase
`npm run typecheck` and `npm test` from the root; build the dev client on the iPhone 17 simulator and check each screen against its screenshot.
