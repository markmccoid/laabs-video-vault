import { isTauri } from "@tauri-apps/api/core";
import { CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu } from "@tauri-apps/api/menu";
import type { CommandState } from "../components/Commands";
import { COMMANDS, accelerator, commandDef, type CommandDef, type CommandId, type MenuName } from "./commands";

type Item = MenuItem | CheckMenuItem;
type Built = { sync: (state: (id: CommandId) => CommandState) => void };

/**
 * The Mac menu bar, built from the command list. Outside the Mac app (the
 * browser dev mode) there's no native menu, so this resolves to null.
 */
export async function installNativeMenu(onRun: (id: CommandId) => void): Promise<Built | null> {
  if (!isTauri()) return null;
  const items = new Map<CommandId, Item>();
  const applied = new Map<CommandId, CommandState>();

  const sep = () => PredefinedMenuItem.new({ item: "Separator" });

  const commandItem = async (def: CommandDef) => {
    const id = def.id as CommandId;
    const opts = {
      id,
      text: def.label,
      enabled: false,
      accelerator: def.shortcut && !def.keyOnly ? accelerator(def.shortcut) : undefined,
      action: () => onRun(id),
    };
    const item = def.submenu ? await CheckMenuItem.new({ ...opts, checked: false }) : await MenuItem.new(opts);
    items.set(id, item);
    return item;
  };

  /** One menu's command items, with separators and the Appearance submenu. */
  const commandsFor = async (menu: MenuName) => {
    const out: (Item | PredefinedMenuItem | Submenu)[] = [];
    const defs: readonly CommandDef[] = COMMANDS.filter((c) => c.menu === menu);
    const appearance = defs.filter((d) => d.submenu === "Appearance");
    for (const def of defs) {
      if (def.submenu) continue;
      if (def.sep && out.length) out.push(await sep());
      out.push(await commandItem(def));
    }
    if (appearance.length) {
      out.push(await sep());
      const sub = [];
      for (const def of appearance) sub.push(await commandItem(def));
      out.push(await Submenu.new({ text: "Appearance", items: sub }));
    }
    return out;
  };

  const file = await commandsFor("File");
  const edit = await commandsFor("Edit");
  const view = await commandsFor("View");
  const video = await commandsFor("Video");
  // Undo and Redo lead Edit, then the system's text items, then Select All
  // (ours, so ⌘A selects every video outside a text field).
  const [undo, redo, selectAll, ...editRest] = edit;

  const menu = await Menu.new({
    items: [
      await Submenu.new({
        text: "LAABS Video Vault",
        items: [
          await PredefinedMenuItem.new({ item: { About: null } }),
          await sep(),
          await PredefinedMenuItem.new({ item: "Services" }),
          await sep(),
          await PredefinedMenuItem.new({ item: "Hide" }),
          await PredefinedMenuItem.new({ item: "HideOthers" }),
          await PredefinedMenuItem.new({ item: "ShowAll" }),
          await sep(),
          await PredefinedMenuItem.new({ item: "Quit" }),
        ],
      }),
      await Submenu.new({
        text: "File",
        items: [...file, await sep(), await PredefinedMenuItem.new({ item: "CloseWindow" })],
      }),
      await Submenu.new({
        text: "Edit",
        items: [
          undo!,
          redo!,
          await sep(),
          await PredefinedMenuItem.new({ item: "Cut" }),
          await PredefinedMenuItem.new({ item: "Copy" }),
          await PredefinedMenuItem.new({ item: "Paste" }),
          selectAll!,
          ...editRest,
        ],
      }),
      await Submenu.new({ text: "View", items: view }),
      await Submenu.new({ text: "Video", items: video }),
      await Submenu.new({
        text: "Window",
        items: [
          await PredefinedMenuItem.new({ item: "Minimize" }),
          await PredefinedMenuItem.new({ item: "Maximize", text: "Zoom" }),
          await sep(),
          await PredefinedMenuItem.new({ item: "BringAllToFront" }),
        ],
      }),
    ],
  });
  await menu.setAsAppMenu();

  return {
    sync(state) {
      for (const [id, item] of items) {
        const next = state(id);
        const prev = applied.get(id);
        if (prev?.enabled !== next.enabled) void item.setEnabled(next.enabled);
        // Items start with their default label, so only an override (or its removal) needs a call.
        if (prev ? prev.label !== next.label : next.label) void item.setText(next.label ?? commandDef(id).label);
        if (item instanceof CheckMenuItem && prev?.checked !== next.checked) void item.setChecked(!!next.checked);
        applied.set(id, next);
      }
    },
  };
}
