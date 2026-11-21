# Handoff: Shelf — YouTube video organizer (iOS)

## Overview
Shelf is an iOS app for saving YouTube videos into folders (nested up to **3 levels**), tagging them, searching them (title, description, tags), writing notes on each video and playing them inside the app. The design focuses on making it fast to create folders and tags and to move videos into folders. Videos can be moved by dragging, from a Move sheet or several at once.

Target stack: **Expo (React Native) + SwiftUI components** (e.g. `@expo/ui/swift-ui`), following **iOS 26/27 conventions**: floating glass controls, search field at the bottom, large titles, bottom sheets and context menus.

## About the design files
The files in this bundle are **design references built in HTML**. They are working prototypes that show the intended look and behaviour, **not production code to copy**. Rebuild them in the existing codebase using its own patterns (Expo Router, native SwiftUI views via Expo UI, the app's data layer). Where a real native control exists (sheet, context menu, search field, segmented picker, drag and drop), **use the native control** and give it the Organic tokens below. Don't hand-draw a copy of it.

Open `ShelfApp.dc.html` in a browser for the clickable prototype. `Shelf Canvas.dc.html` lays every key screen side by side. The two `.dc.html` files need `support.js` and `_ds/` next to them.

## Fidelity
**High fidelity** for layout, hierarchy, copy, colour, type and interaction. Exact pixel values come from a 402×874pt iPhone frame (iPhone 16/17 Pro). Native iOS controls should keep their system behaviour and metrics; apply the colours, radii and fonts listed here.

---

## Information architecture
- **No tab bar.** One navigation stack rooted at **Library**.
- **Top bar (floating glass):** left — Settings (gear) on the root, or Back on pushed screens. Right — **Select** and a filled **+** (accent) that opens a menu with *Add video* and *New folder* (*New subfolder* inside a folder).
- **Bottom:** a floating glass **search field** (“Search titles, descriptions, tags”). Tapping it opens Search, with the field staying at the bottom and the keyboard up.
- **Player** is a full-screen modal sheet that slides up.
- **Sheets:** Add video, Move to folder, Tags, New folder (all bottom sheets with large corner radius, ✕ on the left, title in the centre, primary action pill on the right).

## Screens

### 1. Library (root)
Large title “Library” (Caprasimo 36pt) with the subtitle “14 videos · 3 folders” (Figtree 14, neutral-700). Then the folder area, which comes in **four layouts** (the user picks one in Settings → Library layout; ship **Grid** as the default unless told otherwise):
- **Grid (1a):** 2-column grid, 12pt gap. Folder card min height 124, padding 16, radius 28. Fill comes from the top-level folder’s tone (accent-200 / accent-2-200 / neutral-200) with a decorative 110pt circle (tone-300, 50% opacity) bleeding off the top-right. Filled folder icon 26pt, name in Caprasimo 19, meta “5 videos · 2 inside” Figtree 12.5/600. The last cell is a dashed (2pt neutral-400) “New folder” card.
- **List (1b):** rows with min height 64, radius 22, surface fill; 44pt circular icon badge, name 16/700, meta 12.5, chevron.
- **Tree (1c):** one surface container (radius 28) with expandable rows (48pt, 22pt indent per level, rotating chevron, video count on the right) and a “New folder” row at the end.
- **Columns (1d, Finder-style):** a breadcrumb of pills above horizontally scrolling 172×292 columns (radius 26, surface fill). The selected folder is filled with accent and bg-coloured text. Each column ends with “+ New” while below level 3. The videos of the selected folder list underneath.

Under the folders sits an **Inbox** section (“Not filed yet”) holding videos with no folder.

### 2. Folder detail (2a)
- Breadcrumb above the title (sage 13/700 pills; each one is also a drop target).
- Large title = folder name. Subtitle = **depth dots** (three 7pt dots, filled with accent-2-600 up to the current level) + “Level 2 of 3 · 2 videos”.
- Subfolder rows, then a dashed “New subfolder” row. At level 3 that row is replaced by a sage info pill: “Deepest level — this folder holds videos only.”
- “Videos” header, then the video rows.

### Video row (shared)
- 128×72 thumbnail, radius 16. Duration pill bottom-right (neutral-900 at 80%, 11/700). Small play disc top-left.
- Title 15/700, max 2 lines. Meta 12.5 neutral-700: channel, plus the folder path in search and tag views.
- Up to 3 tag chips (11/700, pill, surface fill), then “+N”.
- “…” button on the right (34pt) opens the context menu.
- In search results the matched text is highlighted with accent-200. If the match is only in the description, a snippet of the description shows instead.

### 3. Drag to folder (2b)
- **Long-press** a row (450ms) → the row lifts (scale 1.03, shadow-lg) and a haptic fires.
  - **Release without moving** → context menu.
  - **Move** → a ghost card (rotated -3°) follows the finger. Every drop target gets a 2pt accent-300 ring. The one under the finger gets a 3pt accent ring, an accent-100 fill and scale 1.04, and a pill under the ghost reads “Move to {Folder}”. The top bar title reads “Drop on a folder”, and Select and + hide.
- **Drop targets:** folder cards/rows/tree nodes/columns, breadcrumb items, the Back button (parent folder) and the Inbox header (removes the video from its folder).
- After a drop: toast “Moved to Pasta” with **Undo**, kept for 4s.
- Native: use the RN gesture handler or the SwiftUI `.draggable` / `.dropDestination` APIs.

### 4. Context menu
Blurred backdrop, a large preview card (16:9 thumb, title, “channel · duration · path”), and a menu: Play · Move to folder… · Edit tags… · Select · Delete (accent-700). Footer hint: “Tip: keep holding and drag to drop it into a folder”. Native: `.contextMenu` with a preview.

### 5. Move to folder sheet (2c)
Subtitle: “‘{title}’ · now in {path}”. The full folder tree comes first, with Inbox as the first row: 48pt rows, indented 22pt per level with a 2pt guide line, and a radio on the right. The current folder carries a “Current” badge. A dashed “New folder in {selected}” button turns into an **inline text field** with an “Add” button. Creating a folder selects it straight away. If the selected folder is at level 3, a note replaces the button. The **Move** pill is disabled (40% opacity) until the user picks a folder other than the current one.

### 6. New folder sheet (2d)
A large name field (58pt pill, 2pt accent-300 border, Caprasimo 20, autofocused). Below it, “Inside” with the depth dots and “Level N of 3”, then the possible parent folders as pills (Library + every folder below level 3). The selected pill is filled with accent. Footnote: “Folders nest up to three levels deep.” Default parent = the folder you’re in.

### 7. Tags sheet (2e)
The video’s current tags show as solid sage pills with ✕ (tap to remove). Below them: a “Find or create a tag” field, a “Create ‘{text}’” pill when the text matches no existing tag, and suggestions from existing tags filtered as you type. Return adds the tag. Tags are free-form and stored lowercase. With several videos selected, the sheet shows the tags all of them share.

### 8. Search (2f)
The search field stays at the bottom with a 2pt accent-300 border and an ✕ circle beside it to close. A scope segmented control (All · Title · Description · Tags) sits at the top. With no query: **Recent** searches and **Browse by tag** (sage chips with counts). Results: “N results” header plus video rows with highlighted matches and the folder path.

### 9. Add video (2g) and share extension (2h)
- **Add video sheet:** a link field with a **Paste** pill. A YouTube URL triggers a fetch (placeholder “Fetching video details…”), then a preview card. Below: “Save to” (the same tree picker as Move, with inline new folder), then “Tags” chips. **Save** stays disabled until the video details have loaded.
- **Share extension:** the same sheet titled “Save to Shelf”, opened over the YouTube app. The link field is hidden because the shared URL is used.

### 10. Player (2i)
- Full-screen sheet. Floating chevron-down (close) and “…” buttons. A 16:9 player (radius 26) with the **YouTube embed** (use `react-native-youtube-iframe` or a WKWebView), plus a play/pause disc and a progress bar (accent).
- Elapsed / duration labels, title (Caprasimo 24), channel.
- **Folder card:** icon, “Folder” label, full path and a “Move” link.
- Tag chips plus a dashed “+ Tag” chip.
- Description.
- **My notes (new):** sage-100 container (radius 28, padding 14). Header with a notes icon, “My notes” and a status (“Private to you” / “Saving…” / “Saved”). Then a multiline field (min 120pt, bg fill, radius 20, 2pt accent-2-400 border on focus, placeholder “Jot down ingredients, measurements, ideas…”). Then a footer with an **“Add {current time}”** pill that inserts `[m:ss] ` on a new line, and a word count. Autosave with a debounce of about 600ms. Suggested next step: make `[m:ss]` stamps tappable so they seek the player.
- “More in {folder}”: up to 3 other videos from the same folder.

### 11. Settings (2j)
Grouped inset lists (surface fill, radius 26, small uppercase section headers):
- **Appearance:** Theme (System / Light / Dark segmented) and Library layout (Grid / List / Tree / Columns segmented).
- **Export & import:** Export library (JSON) and Import library (From Files). Note: exports hold folders, tags, links and notes, not the video files.
- **Adding videos:** a share-extension explainer row.
- Footer: “Shelf 1.0 · 14 videos in 10 folders”.

### Multi-select
**Select** in the top bar → circular checkboxes on the rows, “Select all / Deselect all” top-left, “Done” (accent) top-right, compact title “N selected”. The search pill is replaced by a glass toolbar with **Move · Tag · Delete**. Each action stays disabled until at least one video is selected.

## Interactions & motion
- Push between screens: content slides in 28pt with a fade, 300ms `cubic-bezier(.2,.8,.2,1)`. Use the native stack transitions.
- Sheets slide up 360ms `cubic-bezier(.2,.9,.25,1)` with a 32% neutral-900 scrim.
- Menus pop in with scale .9→1 over 200–250ms.
- Toasts: a dark pill 100pt above the bottom with a check icon and an optional Undo, auto-hiding after 4s. **Every move and delete can be undone.**
- Large title → compact centred title once scrolled past 40pt. A bg-coloured fade sits under the floating top bar.
- The minimum touch target is 44pt everywhere.

## State / data model
```ts
Folder { id; name; parentId: string | null; tone?: 'accent' | 'sage' | 'neutral' } // tone only on top-level folders; children inherit it
Video  { id; youtubeId; title; channel; duration; description; tags: string[]; folderId: string | null; notes: string; addedAt }
```
- Depth = the length of the parent chain. **Block creating a folder when the parent is already at depth 3.**
- A folder’s count = the videos in it **and in all its subfolders**.
- Search does a case-insensitive substring match on title, description and tags, filtered by scope.
- UI state: nav path, the selected layout (persisted), selection set, drag state `{videoId, overTargetId}`, the open sheet, the toast with an undo snapshot, and recent searches (keep 4).
- Fetching metadata: YouTube oEmbed or the Data API, from the URL.

## Design tokens (Organic)
**Colours**
- bg `#f5ead8` · surface `#ebddc5` · text `#201e1d` · divider = text at 16%
- accent `#c67139`: 100 `#fff2eb` · 200 `#ffe1d0` · 300 `#ffc6a5` · 400 `#f6a06b` · 500 `#d67f48` · 600 `#b2622d` · 700 `#8c491a` · 800 `#643312` · 900 `#402310`
- accent-2 (sage) `#7a8a5e`: 100 `#f0fae1` · 200 `#e1eecc` · 300 `#ccdbb2` · 400 `#aebf92` · 500 `#8fa073` · 600 `#728157` · 700 `#56633f` · 800 `#3d472b` · 900 `#272e1b`
- neutral: 100 `#f9f4ed` · 200 `#eee7db` · 300 `#dcd3c4` · 400 `#c0b6a5` · 500 `#a19786` · 600 `#82796a` · 700 `#645c50` · 800 `#474238` · 900 `#2e2b25`
- Use accent-700 or darker for small accent-coloured text (contrast).

**Type:** headings **Caprasimo** 400 (large title 36, sheet title 19, player title 24, card folder name 19). Body **Figtree** 400/600/700 (body 15, row title 15–16/700, meta 12.5, chips 11–13.5/600–700). Both are on Google Fonts; bundle them with `expo-font`.

**Radius:** 8 / 16 / 28 (sm/md/lg), pills 999. Phone sheets use 48 and cards 22–28.

**Spacing:** 4.4 / 8.8 / 13.2 / 17.6 / 26.4 / 35.2. Screen gutter 20, gap between floating controls 8–10.

**Shadows:** sm `0 1 2 rgba(46,43,37,.14)` · md `0 3 10 rgba(46,43,37,.16)` · lg `0 12 32 rgba(46,43,37,.22)`

**Glass (floating controls):** bg at 58% opacity, blur 20, saturate 1.7, 1pt accent-100 hairline, shadow-md. On iOS 26+ prefer the native `glassEffect` with an Organic tint.

## Icons
Lucide, stroke width 2.75 (`lucide-react-native`). Or map them to SF Symbols if you go fully native: folder.fill, folder.badge.plus, magnifyingglass, tag, gearshape, ellipsis, play.fill, trash, link, clock, tray, square.and.pencil (notes), checkmark.circle.

## Assets
Thumbnails in the prototype are coloured placeholders. Use the real YouTube thumbnails (`https://i.ytimg.com/vi/{id}/hqdefault.jpg`), shown with the Organic “washed” treatment (slightly desaturated, rounded corners).

## Files
- `ShelfApp.dc.html` — the full interactive prototype. The props `homeLayout` and `startScreen` jump to any state.
- `Shelf Canvas.dc.html` — every key screen side by side (ids 1a–1d, 2a–2j).
- `support.js`, `_ds/…/styles.css` — needed to open the HTML locally.
- `screenshots/` — one PNG per screen, named by canvas id (`1a-library-grid.png` … `2j-settings.png`). Sheets and the player are captured above the fold; open the prototype to see the full scroll.

## Suggested prompt for Claude Code
> Read `design_handoff_shelf/README.md` and open the HTML prototypes. Map each screen to the existing routes/components in this repo, then rebuild them with Expo Router + @expo/ui SwiftUI components, using the Organic tokens. Start with Library (Grid), Folder detail and the Move sheet, then drag-to-folder, Search, Player + Notes, Tags, New folder, Add/Share and Settings.
