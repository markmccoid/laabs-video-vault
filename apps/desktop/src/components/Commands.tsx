import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { COMMANDS, commandDef, isTyping, matches, overlayOpen, type CommandId } from "../lib/commands";
import { installNativeMenu } from "../lib/nativeMenu";

export type RunContext = {
  /** Focus was in a text field when the command ran. */
  typing: boolean;
};
type Run = (ctx: RunContext) => void;

/** What a command does right now, as the component that owns it says. */
export type CommandState = { enabled: boolean; label?: string; checked?: boolean };
type Entry = CommandState & { run: Run };

export type CommandRegistry = {
  state: (id: CommandId) => CommandState;
  run: (id: CommandId, source: "key" | "menu" | "palette") => void;
  register: (id: CommandId, entry: Entry) => () => void;
  /** Bumped whenever any command's state changes. */
  version: number;
};

const Ctx = createContext<CommandRegistry | null>(null);

export function useCommands(): CommandRegistry {
  const reg = useContext(Ctx);
  if (!reg) throw new Error("useCommands needs a CommandsProvider");
  return reg;
}

/**
 * Supply what a command does while this component is mounted. Pass `null` or
 * `false` to show it disabled. The newest registration of an id wins.
 */
export function useCommand(id: CommandId, run: Run | null | false | undefined, opts: { label?: string; checked?: boolean } = {}) {
  const reg = useCommands();
  const runRef = useRef(run);
  useLayoutEffect(() => {
    runRef.current = run;
  });
  const enabled = !!run;
  const { label, checked } = opts;
  useEffect(
    () => reg.register(id, { enabled, label, checked, run: (ctx) => runRef.current && runRef.current(ctx) }),
    [reg.register, id, enabled, label, checked],
  );
}

/** Holds the command handlers, listens for shortcut keys, and keeps the native menu in step. */
export function CommandsProvider({ children }: { children: ReactNode }) {
  const entries = useRef(new Map<CommandId, Entry[]>());
  const [version, setVersion] = useState(0);
  const lastRun = useRef<{ id: CommandId; at: number } | null>(null);

  const register = useCallback((id: CommandId, entry: Entry) => {
    const list = entries.current.get(id) ?? [];
    entries.current.set(id, [...list, entry]);
    setVersion((v) => v + 1);
    return () => {
      entries.current.set(id, (entries.current.get(id) ?? []).filter((e) => e !== entry));
      setVersion((v) => v + 1);
    };
  }, []);

  const current = useCallback((id: CommandId) => entries.current.get(id)?.at(-1), []);

  const state = useCallback(
    (id: CommandId): CommandState => {
      const e = current(id);
      return e ? { enabled: e.enabled, label: e.label, checked: e.checked } : { enabled: false };
    },
    [current],
  );

  const run = useCallback(
    (id: CommandId, source: "key" | "menu" | "palette") => {
      const now = Date.now();
      // A key can reach both the page and the native menu; run it once.
      if (source === "menu" && lastRun.current?.id === id && now - lastRun.current.at < 300) return;
      const entry = current(id);
      if (!entry?.enabled) return;
      if (overlayOpen() && !commandDef(id).inDialog) return;
      lastRun.current = { id, at: now };
      entry.run({ typing: isTyping() });
    },
    [current],
  );

  // Shortcut keys, in the browser and in the Mac app alike.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat && e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      for (const def of COMMANDS) {
        if (!("shortcut" in def) || !matches(def.shortcut, e)) continue;
        const inText = "inText" in def ? def.inText : "run";
        if (inText === "native" && isTyping(e.target as Element)) return;
        if (!state(def.id).enabled) return;
        if (overlayOpen() && !("inDialog" in def && def.inDialog)) return;
        e.preventDefault();
        run(def.id, "key");
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run, state]);

  const registry = useMemo<CommandRegistry>(() => ({ state, run, register, version }), [state, run, register, version]);

  return (
    <Ctx.Provider value={registry}>
      <NativeMenu registry={registry} />
      {children}
    </Ctx.Provider>
  );
}

/** Builds the Mac menu bar once, then mirrors each command's enabled, label and check state. */
function NativeMenu({ registry }: { registry: CommandRegistry }) {
  const menu = useRef<ReturnType<typeof installNativeMenu> | null>(null);
  const runRef = useRef(registry.run);
  useLayoutEffect(() => {
    runRef.current = registry.run;
  });

  useEffect(() => {
    menu.current ??= installNativeMenu((id) => runRef.current(id, "menu"));
  }, []);

  useEffect(() => {
    void menu.current?.then((m) => m?.sync(registry.state));
  }, [registry]);

  return null;
}
