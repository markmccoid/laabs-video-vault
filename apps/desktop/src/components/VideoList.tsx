import { folderPath, formatDuration, highlight, watchUrl } from "@lvv/core";
import { useMutation, useQuery } from "convex/react";
import { MoreHorizontal } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { api, type Id, type ListVideo } from "../lib/api";
import { MOD, type View } from "../lib/views";
import { ConfirmDialog, MoveDialog } from "./Dialogs";
import { Icon } from "./Icon";
import { ContextMenu, type MenuItem } from "./Menu";
import { DRAG_TYPE, type DragPayload } from "./Sidebar";
import { useToast } from "./Toast";

/** The videos for the current view, or search results while there's text. */
function useVideos(view: View, search: string, since: number): ListVideo[] | undefined {
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

export function VideoList({
  view,
  search,
  since,
  selectedId,
  onSelect,
  toolbar,
  inert = false,
}: {
  view: View;
  search: string;
  since: number;
  selectedId: Id<"videos"> | null;
  onSelect: (id: Id<"videos"> | null) => void;
  toolbar: ReactNode;
  /** True while the list is collapsed away, so focus and keys skip it. */
  inert?: boolean;
}) {
  const videos = useVideos(view, search, since);
  const folders = useQuery(api.folders.list);
  const tags = useQuery(api.tags.list);
  const trash = useMutation(api.videos.trashMany);
  const restore = useMutation(api.videos.restoreMany);
  const deleteForever = useMutation(api.videos.deleteForever);
  const emptyTrash = useMutation(api.videos.emptyTrash);
  const dismiss = useMutation(api.videos.dismissJustAdded);
  const toast = useToast();
  const [menu, setMenu] = useState<{ x: number; y: number; video: ListVideo } | null>(null);
  const [dialog, setDialog] = useState<ReactNode>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const close = () => setDialog(null);
  const inTrash = !search.trim() && view.kind === "trash";

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

  // Keep the selection on a video that's still in the list.
  useEffect(() => {
    if (videos && selectedId && !videos.some((v) => v._id === selectedId)) onSelect(null);
  }, [videos, selectedId, onSelect]);

  const trashVideo = (v: ListVideo) => {
    void trash({ videoIds: [v._id] }).then(() => toast("Moved to Trash", () => restore({ videoIds: [v._id] })));
  };

  // ⌘⌫ trashes the selected video; ↑/↓ move the selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!videos?.length || (e.target as HTMLElement).closest("input, textarea, select, [role=dialog], [role=menu]")) return;
      const at = videos.findIndex((v) => v._id === selectedId);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const next = e.key === "ArrowDown" ? Math.min(at + 1, videos.length - 1) : Math.max(at - 1, 0);
        const id = videos[next]!._id;
        onSelect(id);
        listRef.current?.querySelector(`[data-id="${id}"]`)?.scrollIntoView({ block: "nearest" });
      } else if (e.key === "Backspace" && (e.metaKey || e.ctrlKey) && at >= 0 && !inTrash) {
        e.preventDefault();
        trashVideo(videos[at]!);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const rowMenu = (v: ListVideo): MenuItem[] =>
    inTrash
      ? [
          {
            label: "Restore",
            onSelect: () => void restore({ videoIds: [v._id] }).then(() => toast("Restored")),
          },
          { kind: "sep" },
          {
            label: "Delete forever…",
            danger: true,
            onSelect: () =>
              setDialog(
                <ConfirmDialog
                  title="Delete forever?"
                  body={`“${v.title}” and its notes and timestamps will be gone. This can't be undone.`}
                  confirm="Delete forever"
                  onClose={close}
                  onConfirm={() => deleteForever({ videoIds: [v._id] })}
                />,
              ),
          },
        ]
      : [
          { label: "Open in YouTube", onSelect: () => window.open(watchUrl(v.youtubeId), "_blank") },
          { label: "Copy link", onSelect: () => void navigator.clipboard.writeText(watchUrl(v.youtubeId)) },
          { kind: "sep" },
          {
            label: "Move to folder…",
            onSelect: () =>
              setDialog(<MoveDialog videoIds={[v._id]} currentFolderId={v.folderId} onClose={close} />),
          },
          ...(view.kind === "justAdded" && !q
            ? [{ label: "Dismiss from Just Added", onSelect: () => void dismiss({ videoIds: [v._id] }) }]
            : []),
          { kind: "sep" },
          { label: "Move to Trash", kbd: `${MOD}⌫`, danger: true, onSelect: () => trashVideo(v) },
        ];

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
            aria-selected={v._id === selectedId}
            className="video-row"
            tabIndex={-1}
            draggable={!inTrash}
            onDragStart={(e) => {
              const payload: DragPayload = { videoIds: [v._id], fromFolderId: v.folderId ?? null };
              e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(payload));
              e.dataTransfer.setData("text/uri-list", watchUrl(v.youtubeId));
              e.dataTransfer.effectAllowed = "move";
            }}
            onClick={() => onSelect(v._id)}
            onDoubleClick={() => window.open(watchUrl(v.youtubeId), "_blank")}
            onContextMenu={(e) => {
              e.preventDefault();
              onSelect(v._id);
              setMenu({ x: e.clientX, y: e.clientY, video: v });
            }}
          >
            <div className="thumb">
              <img className="washed" src={v.thumbnail} alt="" loading="lazy" draggable={false} />
              {v.durationSec ? <span className="duration">{formatDuration(v.durationSec)}</span> : null}
              {v.isShort && <span className="duration">Short</span>}
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
                onSelect(v._id);
                const r = e.currentTarget.getBoundingClientRect();
                setMenu({ x: r.left, y: r.bottom + 4, video: v });
              }}
            >
              <Icon as={MoreHorizontal} />
            </button>
          </div>
        ))}
      </div>

      {menu && <ContextMenu x={menu.x} y={menu.y} items={rowMenu(menu.video)} onClose={() => setMenu(null)} />}
      {dialog}
    </section>
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
          : ["No videos here yet", "Drag videos onto this folder in the sidebar to file them."];
  return (
    <div className="empty">
      <div className="empty-blob" aria-hidden="true" />
      <h4>{title}</h4>
      <p className="text-muted">{body}</p>
    </div>
  );
}
