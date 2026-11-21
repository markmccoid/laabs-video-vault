import { MAX_FOLDER_DEPTH, justAddedSince } from "@lvv/core";
import { useConvexAuth, useQuery } from "convex/react";
import { Plus, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { CommandPalette } from "./components/CommandPalette";
import { useCommand } from "./components/Commands";
import { AddVideoDialog, NewFolderDialog } from "./components/Dialogs";
import { Icon } from "./components/Icon";
import { Sidebar } from "./components/Sidebar";
import { SignIn } from "./components/SignIn";
import { VideoDetail } from "./components/VideoDetail";
import { VideoList } from "./components/VideoList";
import { api, type Id } from "./lib/api";
import { nextListMode, useListMode } from "./lib/listMode";
import { useThemeChoice } from "./lib/theme";
import { MOD, type View } from "./lib/views";

export function App() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const [theme, setTheme] = useThemeChoice();
  if (isLoading) return <div className="splash" data-tauri-drag-region />;
  if (!isAuthenticated) return <SignIn />;
  return <Library theme={theme} onTheme={setTheme} />;
}

/** Just Added's cutoff, refreshed every minute (queries can't read the clock). */
function useJustAddedSince() {
  const [since, setSince] = useState(() => justAddedSince(Date.now()));
  useEffect(() => {
    const id = window.setInterval(() => setSince(justAddedSince(Date.now())), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return since;
}

function Library({ theme, onTheme }: { theme: ReturnType<typeof useThemeChoice>[0]; onTheme: (t: typeof theme) => void }) {
  const [view, setView] = useState<View>({ kind: "inbox" });
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<Id<"videos"> | null>(null);
  const listMode = useListMode();
  const [dialog, setDialog] = useState<ReactNode>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const since = useJustAddedSince();
  const folders = useQuery(api.folders.list);

  // Opening a video from nothing shrinks the list; closing it restores the list.
  // Moving between videos keeps whatever mode the user picked.
  const select = useCallback(
    (id: Id<"videos"> | null) => {
      if (id && !selectedId) listMode.focus();
      if (!id) listMode.reset();
      setSelectedId(id);
    },
    [selectedId, listMode.focus, listMode.reset],
  );
  const mode = selectedId ? listMode.mode : "browse";

  const openAdd = useCallback(() => {
    setDialog(
      <AddVideoDialog
        defaultFolderId={view.kind === "folder" ? view.id : undefined}
        onClose={() => setDialog(null)}
        onAdded={select}
      />,
    );
  }, [view, select]);

  const changeView = (v: View) => {
    setView(v);
    setSearch("");
    select(null);
  };

  const focusSearch = () => {
    // The search field lives in the list, so bring the list back first.
    if (mode === "hidden") listMode.setMode("compact");
    window.setTimeout(() => {
      searchRef.current?.focus();
      searchRef.current?.select();
    });
  };

  // Library commands (menu bar and shortcuts; see lib/commands.ts).
  useCommand("addVideo", openAdd);
  useCommand("newFolder", () => {
    const here = view.kind === "folder" ? folders?.find((f) => f._id === view.id) : undefined;
    setDialog(
      <NewFolderDialog
        parent={here && here.depth < MAX_FOLDER_DEPTH - 1 ? here : undefined}
        onClose={() => setDialog(null)}
        onCreated={(id) => changeView({ kind: "folder", id })}
      />,
    );
  });
  useCommand("find", focusSearch);
  useCommand("commandPalette", () =>
    setDialog(<CommandPalette onClose={() => setDialog(null)} onView={changeView} />),
  );
  useCommand("goJustAdded", () => changeView({ kind: "justAdded" }));
  useCommand("goInbox", () => changeView({ kind: "inbox" }));
  useCommand("goTrash", () => changeView({ kind: "trash" }));
  useCommand("toggleListSize", selectedId && (() => listMode.setMode(nextListMode(mode))));
  useCommand("themeSystem", () => onTheme("system"), { checked: theme === "system" });
  useCommand("themeLight", () => onTheme("light"), { checked: theme === "light" });
  useCommand("themeDark", () => onTheme("dark"), { checked: theme === "dark" });

  const toolbar = (
    <div className="toolbar app-toolbar" data-tauri-drag-region>
      <button className="btn btn-primary btn-sm" onClick={openAdd} title={`Add video (${MOD}N)`} aria-label="Add video">
        <Icon as={Plus} size={16} /> <span className="btn-label">Add video</span>
      </button>
      <span className="toolbar-spacer" data-tauri-drag-region />
      <label className="search">
        <Icon as={Search} size={16} />
        <input
          ref={searchRef}
          className="input"
          type="search"
          placeholder={`Search  ${MOD}F`}
          aria-label="Search your library"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setSearch("");
              e.currentTarget.blur();
            }
          }}
        />
      </label>
    </div>
  );

  return (
    <div className="app" data-list-mode={mode}>
      <Sidebar view={view} onView={changeView} theme={theme} onTheme={onTheme} justAddedSinceMs={since} />
      <VideoList
        view={view}
        search={search}
        since={since}
        selectedId={selectedId}
        onSelect={select}
        toolbar={toolbar}
        inert={mode === "hidden"}
      />
      {selectedId && (
        <VideoDetail
          videoId={selectedId}
          onClose={() => select(null)}
          listMode={mode}
          onListMode={listMode.setMode}
        />
      )}
      {dialog}
    </div>
  );
}
