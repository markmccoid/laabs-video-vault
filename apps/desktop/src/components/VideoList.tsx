import {
  folderPath,
  formatDuration,
  highlight,
  progressFraction,
  pruneSelection,
  selectAll,
  selectClick,
  selectOnly,
  selectStep,
  watchUrl,
  type ListSelection,
} from "@lvv/core";
import { useMutation, useQuery } from "convex/react";
import { MoreHorizontal } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, type Id, type ListVideo } from "../lib/api";
import { originOf } from "../lib/moves";
import { MOD, modKey, type View } from "../lib/views";
import { useCommand } from "./Commands";
import { ConfirmDialog } from "./Dialogs";
import { Icon } from "./Icon";
import { ContextMenu, type MenuItem } from "./Menu";
import { DRAG_TYPE, type DragPayload } from "./Sidebar";
import { useToast } from "./Toast";
import { useTagActions } from "./tagActions";
import { useVideoActions } from "./videoActions";
import { useWatchProgress } from "../lib/watchProgress";

/** Trash is showing (search results never include trashed videos). */
export const isTrashView = (view: View, search: string) => !search.trim() && view.kind === "trash";

/** The videos for the current view, or search results while there's text. */
export function useVideos(view: View, search: string, since: number): ListVideo[] | undefined {
  const q = search.trim();
  const s = (on: boolean) => (on && !q ? {} : "skip");
  const results = {
    search: useQuery(api.videos.search, q ? { text: q, tagIds: [] } : "skip"),
    justAdded: useQuery(api.videos.listJustAdded, !q && view.kind === "justAdded" ? { since } : "skip"),
    inbox: useQuery(api.videos.listByFolder, s(view.kind === "inbox")),
    folder: useQuery(api.videos.listByFolder, !q && view.kind === "folder" ? { folderId: view.id } : "skip"),
    tag: useQuery(api.videos.listByTag, !q && view.kind === "tag" ? { tagId: view.id } : "skip"),
    trash: useQuery(api.videos.listTrash, s(view.kind === "trash")),
  };
  return q ? results.search : results[view.kind];
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export type Selection = ListSelection<Id<"videos">>;

export function VideoList({
  view,
  search,
  videos,
  selection,
  onSelection,
  onView,
  toolbar,
  inert = false,
}: {
  view: View;
  onView: (v: View) => void;
  search: string;
  videos: ListVideo[] | undefined;
  selection: Selection;
  onSelection: (next: Selection) => void;
  toolbar: ReactNode;
  /** True while the list is collapsed away, so focus and keys skip it. */
  inert?: boolean;
}) {
  const folders = useQuery(api.folders.list);
  const tags = useQuery(api.tags.list);
  const emptyTrash = useMutation(api.videos.emptyTrash);
  const dismiss = useMutation(api.videos.dismissJustAdded);
  const toast = useToast();
  const actions = useVideoActions();
  const tagActions = useTagActions(() => onView({ kind: "inbox" }));
  const [menu, setMenu] = useState<{ x: number; y: number; videos: ListVideo[] } | null>(null);
  const [dialog, setDialog] = useState<ReactNode>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const close = () => setDialog(null);
  const inTrash = isTrashView(view, search);
  const order = useMemo(() => videos?.map((v) => v._id) ?? [], [videos]);
  const chosen = new Set(selection.ids);
  const selected = videos?.filter((v) => chosen.has(v._id)) ?? [];

  // Title and meta line for the header.
  const q = search.trim();
  let title = "";
  let context = "";
  if (q) {
    title = `“${q}”`;
    context = "Search";
  } else if (view.kind === "justAdded") {
    title = "Just Added";
    context = "Captured in the last 12 hours";
  } else if (view.kind === "inbox") {
    title = "Inbox";
    context = "Not filed yet";
  } else if (view.kind === "trash") {
    title = "Trash";
    context = "Restore puts a video back in its folder";
  } else if (view.kind === "folder") {
    const path = folders ? folderPath(folders, view.id) : [];
    title = path.at(-1) ?? "Folder";
    context = path.length > 1 ? path.slice(0, -1).join(" › ") : `Level ${path.length} of 3`;
  } else {
    title = tags?.find((t) => t._id === view.id)?.name ?? "Tag";
    context = "Tag";
  }

  // Keep the selection to videos still in the list.
  useEffect(() => {
    if (!videos) return;
    const next = pruneSelection(selection, order);
    if (next !== selection) onSelection(next);
  }, [videos, order, selection, onSelection]);

  const reveal = (id: Id<"videos"> | null) =>
    id && listRef.current?.querySelector(`[data-id="${id}"]`)?.scrollIntoView({ block: "nearest" });

  // Selection commands (menu bar and shortcuts). In Trash, ⌘⌫ deletes forever.
  const some = selected.length > 0;
  useCommand("trash", some && (() => (inTrash ? actions.deleteForever(selected) : actions.trash(selected))), {
    label: inTrash ? "Delete Forever…" : undefined,
  });
  useCommand("moveToFolder", some && !inTrash && (() => actions.move(selected)));
  useCommand("editTags", some && !inTrash && (() => actions.editTags(selected)));
  useCommand("copyLink", some && (() => actions.copyLinks(selected)), {
    label: selected.length > 1 ? "Copy Video Links" : undefined,
  });
  useCommand("selectAll", ({ typing }) => (typing ? document.execCommand("selectAll") : onSelection(selectAll(selection, order))));

  // ↑/↓ move the selection; ⇧↑/⇧↓ extend it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      if (e.metaKey || e.ctrlKey || e.altKey || !order.length) return;
      if ((e.target as HTMLElement).closest("input, textarea, select, [role=dialog], [role=menu]")) return;
      e.preventDefault();
      const next = selectStep(selection, e.key === "ArrowDown" ? 1 : -1, e.shiftKey, order);
      onSelection(next);
      reveal(next.cursor);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /** The right-click menu: for the whole selection when the row is part of it. */
  const rowMenu = (vs: ListVideo[]): MenuItem[] => {
    const n = vs.length;
    const one = n === 1 ? vs[0]! : null;
    const several = n > 1 ? ` ${n} videos` : "";
    if (inTrash) {
      return [
        { label: `Restore${several}`, onSelect: () => actions.restore(vs) },
        { kind: "sep" },
        { label: `Delete${several} forever…`, kbd: `${MOD}⌫`, danger: true, onSelect: () => actions.deleteForever(vs) },
      ];
    }
    return [
      ...(one ? ([{ label: "Open in YouTube", onSelect: () => window.open(watchUrl(one.youtubeId), "_blank") }] satisfies MenuItem[]) : []),
      { label: one ? "Copy link" : `Copy ${n} links`, kbd: "⇧⌘C", onSelect: () => actions.copyLinks(vs) },
      { kind: "sep" },
      { label: `Move${several} to folder…`, kbd: "⇧⌘M", onSelect: () => actions.move(vs) },
      { label: "Tags…", kbd: "⌘T", onSelect: () => actions.editTags(vs) },
      ...(view.kind === "justAdded" && !q
        ? [{ label: `Dismiss${several} from Just Added`, onSelect: () => actions.dismiss(vs) }]
        : []),
      { kind: "sep" },
      { label: `Move${several} to Trash`, kbd: `${MOD}⌫`, danger: true, onSelect: () => actions.trash(vs) },
    ];
  };

  /**
   * What a right-click or "…" on a row acts on: the whole selection if the row
   * is part of it. With no video open, the menu is just for this row and
   * nothing opens; with a video open, the row becomes the selection.
   */
  const menuFor = (v: ListVideo): ListVideo[] => {
    if (chosen.has(v._id) && selected.length > 1) return selected;
    if (selected.length > 0) onSelection(selectOnly(v._id));
    return [v];
  };

  const viewedTag = view.kind === "tag" ? tags?.find((t) => t._id === view.id) : undefined;
  const headerActions =
    inTrash && videos && videos.length > 0 ? (
      <button
        className="btn btn-secondary btn-sm"
        onClick={() =>
          setDialog(
            <ConfirmDialog
              title="Empty Trash?"
              body={`${plural(videos.length, "video")} and their notes and timestamps will be gone. This can't be undone.`}
              confirm="Empty Trash"
              onClose={close}
              onConfirm={() => emptyTrash({})}
            />,
          )
        }
      >
        Empty Trash
      </button>
    ) : view.kind === "tag" && !q && viewedTag && !viewedTag.system ? (
      <div className="list-head-actions">
        <button className="btn btn-secondary btn-sm" onClick={() => tagActions.rename(viewedTag)}>
          Rename
        </button>
        <button className="btn btn-secondary btn-sm" data-danger onClick={() => tagActions.remove(viewedTag)}>
          Delete
        </button>
      </div>
    ) : view.kind === "justAdded" && !q && videos && videos.length > 0 ? (
      <button
        className="btn btn-secondary btn-sm"
        onClick={() => {
          const ids = videos.map((v) => v._id);
          void dismiss({ videoIds: ids }).then(() => toast(`Dismissed ${plural(ids.length, "video")}`));
        }}
      >
        Dismiss all
      </button>
    ) : null;

  return (
    <section className="list-pane" aria-label={title} inert={inert}>
      {toolbar}
      <header className="list-head">
        <div>
          <h3>{title}</h3>
          <p className="meta">
            {videos ? plural(videos.length >= 200 ? 200 : videos.length, "video") + (videos.length >= 200 ? "+" : "") : "Loading…"}
            {" · "}
            {context}
          </p>
        </div>
        {headerActions}
      </header>

      <div className="list" ref={listRef} role="listbox" aria-label="Videos">
        {videos?.length === 0 && <EmptyState view={view} searching={!!q} />}
        {videos?.map((v) => (
          <div
            key={v._id}
            data-id={v._id}
            role="option"
            aria-selected={chosen.has(v._id)}
            className="video-row"
            data-menu-open={menu?.videos.some((m) => m._id === v._id) || undefined}
            tabIndex={-1}
            draggable={!inTrash}
            onDragStart={(e) => {
              // Dragging a selected row drags the whole selection.
              const group = chosen.has(v._id) ? selected : [v];
              const payload: DragPayload = { from: group.map(originOf) };
              e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(payload));
              e.dataTransfer.setData("text/uri-list", group.map((g) => watchUrl(g.youtubeId)).join("\r\n"));
              e.dataTransfer.effectAllowed = "move";
            }}
            onMouseDown={(e) => e.shiftKey && e.preventDefault()}
            onClick={(e) => onSelection(selectClick(selection, v._id, { toggle: modKey(e), range: e.shiftKey }, order))}
            onDoubleClick={() => window.open(watchUrl(v.youtubeId), "_blank")}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenu({ x: e.clientX, y: e.clientY, videos: menuFor(v) });
            }}
          >
            <div className="thumb">
              <img className="washed" src={v.thumbnail} alt="" loading="lazy" draggable={false} />
              {v.durationSec ? <span className="duration">{formatDuration(v.durationSec)}</span> : null}
              {v.isShort && <span className="duration">Short</span>}
              {!v.isShort && <ProgressBar videoId={v._id} durationSec={v.durationSec} />}
            </div>
            <div className="video-text">
              <div className="video-title">
                {highlight(v.title, q).map((seg, i) => (seg.match ? <mark key={i}>{seg.text}</mark> : seg.text))}
              </div>
              <div className="meta">
                {v.channelTitle}
                {v.metadataState === "pending" && " · Fetching details…"}
                {v.metadataState === "failed" && " · Couldn't fetch details"}
              </div>
              {v.tagNames.length > 0 && (
                <div className="tag-row">
                  {v.tagNames.slice(0, 3).map((t) => (
                    <span key={t} className="tag tag-neutral">
                      {t}
                    </span>
                  ))}
                  {v.tagNames.length > 3 && <span className="tag tag-neutral">+{v.tagNames.length - 3}</span>}
                </div>
              )}
            </div>
            <button
              className="btn btn-icon btn-row-more"
              aria-label="More"
              onClick={(e) => {
                e.stopPropagation();
                const r = e.currentTarget.getBoundingClientRect();
                setMenu({ x: r.left, y: r.bottom + 4, videos: menuFor(v) });
              }}
            >
              <Icon as={MoreHorizontal} />
            </button>
          </div>
        ))}
      </div>

      {menu && <ContextMenu x={menu.x} y={menu.y} items={rowMenu(menu.videos)} onClose={() => setMenu(null)} />}
      {dialog}
      {actions.dialog}
      {tagActions.dialog}
    </section>
  );
}

/** The thumbnail's Watch Progress bar, from this Mac's copy. */
function ProgressBar({ videoId, durationSec }: { videoId: string; durationSec?: number }) {
  const watched = progressFraction(useWatchProgress(videoId), durationSec);
  if (watched === undefined) return null;
  return (
    <span className="progress-track" role="img" aria-label={`${Math.round(watched * 100)}% watched`}>
      <span className="progress-fill" style={{ width: `${watched * 100}%` }} />
    </span>
  );
}

function EmptyState({ view, searching }: { view: View; searching: boolean }) {
  const [title, body] = searching
    ? ["Nothing matches", "Try fewer words, or search a channel or tag name."]
    : view.kind === "justAdded"
      ? ["Nothing new", "Videos you capture show here for 12 hours."]
      : view.kind === "trash"
        ? ["Trash is empty", "Videos you delete wait here until you empty it."]
        : view.kind === "inbox"
          ? ["Inbox is clear", `Press ${MOD}N to add a video.`]
          : view.kind === "tag"
            ? ["No videos with this tag", `Select videos anywhere, then press ${MOD}T to tag them.`]
            : ["No videos here yet", "Drag videos onto this folder in the sidebar to file them."];
  return (
    <div className="empty">
      <div className="empty-blob" aria-hidden="true" />
      <h4>{title}</h4>
      <p className="text-muted">{body}</p>
    </div>
  );
}
