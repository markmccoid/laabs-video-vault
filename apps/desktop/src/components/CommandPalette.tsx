import { folderPath, fuzzyRank } from "@lvv/core";
import { useQuery } from "convex/react";
import { Clock, Folder, Inbox, Tag, Trash2, Zap, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { COMMANDS, shortcutLabel, type CommandId } from "../lib/commands";
import type { View } from "../lib/views";
import { useCommands } from "./Commands";
import { Icon } from "./Icon";

type Entry = {
  key: string;
  label: string;
  /** What kind of thing it is, shown on the right when there's no shortcut. */
  kind: string;
  icon: LucideIcon;
  shortcut?: string;
  act: () => void;
};

/** Commands the palette never lists: itself, and the field-only Redo. */
const HIDDEN = new Set<CommandId>(["commandPalette", "redo"]);
const GO_TO = new Set<CommandId>(["goJustAdded", "goInbox", "goTrash"]);
const THEME = new Set<CommandId>(["themeSystem", "themeLight", "themeDark"]);
const VIEW_ICONS: Partial<Record<CommandId, LucideIcon>> = { goJustAdded: Clock, goInbox: Inbox, goTrash: Trash2 };

/**
 * ⌘K: type a few letters to run any available command or jump to a folder,
 * tag or view. ↑/↓ choose, Return runs, Escape closes.
 */
export function CommandPalette({ onClose, onView }: { onClose: () => void; onView: (v: View) => void }) {
  const commands = useCommands();
  const folders = useQuery(api.folders.list);
  const tags = useQuery(api.tags.list);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);

  // Return focus where it was, so a command runs against what the user was doing.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    input.current?.focus();
    return () => previous?.focus();
  }, []);

  const entries = useMemo<Entry[]>(() => {
    // Close first: commands wait while a dialog is open.
    const thenRun = (id: CommandId) => () => {
      onClose();
      window.setTimeout(() => commands.run(id, "palette"));
    };
    const go = (v: View) => () => {
      onClose();
      onView(v);
    };

    const out: Entry[] = [];
    for (const def of COMMANDS) {
      const s = commands.state(def.id);
      if (HIDDEN.has(def.id) || !s.enabled) continue;
      const label = s.label ?? def.label;
      out.push({
        key: def.id,
        label: GO_TO.has(def.id) ? `Go to ${label}` : THEME.has(def.id) ? `Appearance: ${label}` : label.replace(/…$/, ""),
        kind: GO_TO.has(def.id) ? "View" : "Command",
        icon: VIEW_ICONS[def.id] ?? Zap,
        shortcut: "shortcut" in def ? shortcutLabel(def.shortcut) : undefined,
        act: thenRun(def.id),
      });
    }
    for (const f of folders ?? []) {
      out.push({ key: f._id, label: folderPath(folders!, f._id).join(" › "), kind: "Folder", icon: Folder, act: go({ kind: "folder", id: f._id }) });
    }
    for (const t of tags ?? []) {
      out.push({ key: t._id, label: t.name, kind: "Tag", icon: Tag, act: go({ kind: "tag", id: t._id }) });
    }
    return out;
    // commands.version tracks enabled states and labels.
  }, [commands.version, commands.state, commands.run, folders, tags, onClose, onView]);

  const shown = useMemo(() => fuzzyRank(query, entries, (e) => e.label), [query, entries]);
  const at = Math.min(active, Math.max(shown.length - 1, 0));

  useEffect(() => {
    list.current?.querySelector(`[data-index="${at}"]`)?.scrollIntoView({ block: "nearest" });
  }, [at]);

  return (
    <div className="dialog-backdrop palette-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            const step = e.key === "ArrowDown" ? 1 : -1;
            setActive((at + step + shown.length) % Math.max(shown.length, 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            shown[at]?.act();
          }
        }}
      >
        <input
          ref={input}
          className="palette-input"
          placeholder="Type a command, folder or tag"
          aria-label="Command"
          aria-controls="palette-list"
          aria-activedescendant={shown[at] ? `palette-${shown[at].key}` : undefined}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          autoComplete="off"
          spellCheck={false}
        />
        <ul className="palette-list" id="palette-list" role="listbox" ref={list}>
          {shown.map((e, i) => (
            <li
              key={e.key}
              id={`palette-${e.key}`}
              data-index={i}
              role="option"
              aria-selected={i === at}
              className="menu-item palette-item"
              onMouseMove={() => i !== at && setActive(i)}
              onMouseDown={(ev) => ev.preventDefault()}
              onClick={e.act}
            >
              <Icon as={e.icon} size={16} />
              <span className="palette-label">{e.label}</span>
              <span className="kbd">{e.shortcut ?? e.kind}</span>
            </li>
          ))}
          {shown.length === 0 && <li className="palette-empty">Nothing matches</li>}
        </ul>
      </div>
    </div>
  );
}
