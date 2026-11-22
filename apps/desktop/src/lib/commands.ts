import { isMac } from "./views";

/**
 * Every app command, in menu order. This one list drives the native menu bar,
 * the keyboard shortcuts, and the ⌘K Command Palette. Components
 * supply what a command does with `useCommand` (see components/Commands.tsx).
 */
export type MenuName = "File" | "Edit" | "View" | "Video";

/** A key as `KeyboardEvent.key` reports it (lowercase letters), plus modifiers. */
export type Shortcut = { key: string; mod?: boolean; shift?: boolean };

export type CommandDef = {
  id: string;
  label: string;
  menu: MenuName;
  shortcut?: Shortcut;
  /** Draw a separator above this item. */
  sep?: boolean;
  /** Appearance items are check items in a submenu. */
  submenu?: "Appearance";
  /**
   * While the user types in a field: "run" still runs the command, "native"
   * leaves the key to the field (⌘Z undoes typing, Space types a space).
   */
  inText?: "run" | "native";
  /** Runs while a dialog or context menu is open (undo and redo in its fields). */
  inDialog?: boolean;
  /** Shown in the menu without an accelerator, so the menu never takes the key (Space). */
  keyOnly?: boolean;
};

export const COMMANDS = [
  // File
  { id: "addVideo", label: "Add Video…", menu: "File", shortcut: { key: "n", mod: true } },
  { id: "newFolder", label: "New Folder…", menu: "File", shortcut: { key: "n", mod: true, shift: true } },
  // Edit
  { id: "undo", label: "Undo", menu: "Edit", shortcut: { key: "z", mod: true }, inText: "native", inDialog: true },
  { id: "redo", label: "Redo", menu: "Edit", shortcut: { key: "z", mod: true, shift: true }, inText: "native", inDialog: true },
  { id: "selectAll", label: "Select All", menu: "Edit", shortcut: { key: "a", mod: true }, inText: "native" },
  { id: "copyLink", label: "Copy Video Link", menu: "Edit", shortcut: { key: "c", mod: true, shift: true }, sep: true },
  { id: "find", label: "Find", menu: "Edit", shortcut: { key: "f", mod: true } },
  // View
  { id: "commandPalette", label: "Command Palette…", menu: "View", shortcut: { key: "k", mod: true } },
  { id: "goJustAdded", label: "Just Added", menu: "View", shortcut: { key: "1", mod: true }, sep: true },
  { id: "goInbox", label: "Inbox", menu: "View", shortcut: { key: "2", mod: true } },
  { id: "goTrash", label: "Trash", menu: "View", shortcut: { key: "3", mod: true } },
  { id: "toggleListSize", label: "Toggle List Size", menu: "View", shortcut: { key: "\\", mod: true }, sep: true },
  { id: "themeSystem", label: "System", menu: "View", submenu: "Appearance" },
  { id: "themeLight", label: "Light", menu: "View", submenu: "Appearance" },
  { id: "themeDark", label: "Dark", menu: "View", submenu: "Appearance" },
  // Video
  { id: "playPause", label: "Play/Pause", menu: "Video", shortcut: { key: " " }, inText: "native", keyOnly: true },
  { id: "markMoment", label: "Mark This Moment", menu: "Video", shortcut: { key: "b", mod: true } },
  { id: "moveToFolder", label: "Move to Folder…", menu: "Video", shortcut: { key: "m", mod: true, shift: true }, sep: true },
  { id: "editTags", label: "Edit Tags…", menu: "Video", shortcut: { key: "t", mod: true } },
  { id: "openInYouTube", label: "Open in YouTube", menu: "Video", shortcut: { key: "o", mod: true }, sep: true },
  { id: "refreshMetadata", label: "Refresh Metadata", menu: "Video" },
  { id: "trash", label: "Move to Trash", menu: "Video", shortcut: { key: "backspace", mod: true }, sep: true, inText: "native" },
] as const satisfies readonly CommandDef[];

export type CommandId = (typeof COMMANDS)[number]["id"];

export const commandDef = (id: CommandId): CommandDef => COMMANDS.find((c) => c.id === id)!;

/** Whether a keydown is this shortcut. */
export function matches(s: Shortcut, e: KeyboardEvent): boolean {
  const mod = isMac ? e.metaKey : e.ctrlKey;
  const other = isMac ? e.ctrlKey : e.metaKey;
  return e.key.toLowerCase() === s.key && mod === !!s.mod && e.shiftKey === !!s.shift && !e.altKey && !other;
}

const ACCEL_KEYS: Record<string, string> = { "\\": "Backslash", backspace: "Backspace", " ": "Space" };

/** The Tauri accelerator string, e.g. "CmdOrCtrl+Shift+N". */
export function accelerator(s: Shortcut): string {
  const key = ACCEL_KEYS[s.key] ?? s.key.toUpperCase();
  return [s.mod && "CmdOrCtrl", s.shift && "Shift", key].filter(Boolean).join("+");
}

const SHOWN_KEYS: Record<string, string> = { backspace: "⌫", " ": "Space" };

/** How the shortcut reads in tooltips and the palette, e.g. "⇧⌘N". */
export function shortcutLabel(s: Shortcut): string {
  const key = SHOWN_KEYS[s.key] ?? s.key.toUpperCase();
  if (!isMac) return [s.mod && "Ctrl", s.shift && "Shift", key].filter(Boolean).join("+");
  return `${s.shift ? "⇧" : ""}${s.mod ? "⌘" : ""}${key}`;
}

/** True while focus is in a text field, where keys belong to the field. */
export function isTyping(el: Element | null = document.activeElement): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable || el instanceof HTMLTextAreaElement) return true;
  return el instanceof HTMLInputElement && !["checkbox", "radio", "button", "submit", "range"].includes(el.type);
}

/** A dialog or context menu is open, so app commands wait. */
export const overlayOpen = () => !!document.querySelector("[role=dialog], [role=menu]");
