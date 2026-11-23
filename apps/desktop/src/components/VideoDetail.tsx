import { folderPath, formatDuration, timestampLabel, timestampSeconds, watchUrl, wordCount } from "@lvv/core";
import { useMutation, useQuery } from "convex/react";
import { BookmarkPlus, ExternalLink, FolderInput, PanelLeft, Pencil, PanelLeftDashed, PanelRight, Trash2, X, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { api, type Id, type VideoDetail as Detail } from "../lib/api";
import { errorMessage } from "../lib/errors";
import { originOf } from "../lib/moves";
import type { ListMode } from "../lib/listMode";
import { MOD } from "../lib/views";
import { useCommand } from "./Commands";
import { TAG_INPUT_ID, TagEditor } from "./TagEditor";
import { MoveDialog } from "./Dialogs";
import { Icon } from "./Icon";
import { ContextMenu, type MenuItem } from "./Menu";
import { SpeedControl } from "./GravityWell";
import { Player, type PlayerHandle } from "./Player";
import { useToast } from "./Toast";

type LayoutProps = { listMode: ListMode; onListMode: (m: ListMode) => void };

export function VideoDetail({
  videoId,
  onClose,
  ...layout
}: { videoId: Id<"videos">; onClose: () => void } & LayoutProps) {
  const video = useQuery(api.videos.get, { videoId });
  if (video === undefined) return <aside className="detail-pane" aria-busy="true" />;
  return <DetailBody key={video._id} video={video} onClose={onClose} {...layout} />;
}

const LIST_MODES: { mode: ListMode; label: string; icon: LucideIcon }[] = [
  { mode: "browse", label: "Expand list", icon: PanelRight },
  { mode: "compact", label: "Shrink list", icon: PanelLeft },
  { mode: "hidden", label: "Hide list", icon: PanelLeftDashed },
];

/** Three-way switch for how much room the list gets beside this video. */
function ListModeSwitch({ listMode, onListMode }: LayoutProps) {
  return (
    <div className="segmented" role="group" aria-label="List size">
      {LIST_MODES.map(({ mode, label, icon }) => (
        <button
          key={mode}
          className="btn btn-icon btn-icon-sm"
          aria-label={label}
          aria-pressed={listMode === mode}
          title={`${label} (${MOD}\\ to cycle)`}
          onClick={() => onListMode(mode)}
        >
          <Icon as={icon} size={16} />
        </button>
      ))}
    </div>
  );
}

function DetailBody({ video, onClose, ...layout }: { video: Detail; onClose: () => void } & LayoutProps) {
  const folders = useQuery(api.folders.list);
  const markOpened = useMutation(api.videos.markOpened);
  const trash = useMutation(api.videos.trash);
  const restore = useMutation(api.videos.restore);
  const refresh = useMutation(api.videos.refreshMetadata);
  const toast = useToast();
  const player = useRef<PlayerHandle>(null);
  const [rate, setRate] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [dialog, setDialog] = useState<ReactNode>(null);
  const trashed = video.deletedAt !== undefined;
  const folderName = video.folderId && folders ? folderPath(folders, video.folderId).join(" › ") : "Inbox";

  useEffect(() => {
    if (!trashed) void markOpened({ videoId: video._id });
  }, [video._id, trashed, markOpened]);

  const openMove = () => setDialog(<MoveDialog from={[originOf(video)]} onClose={() => setDialog(null)} />);

  // Commands for the open video (menu bar and shortcuts; see lib/commands.ts).
  // Move, copy link and trash belong to the list, since they work on a selection.
  useCommand("playPause", () => player.current?.togglePlay());
  useCommand("openInYouTube", () => window.open(watchUrl(video.youtubeId, player.current?.currentTime()), "_blank"));
  useCommand(
    "refreshMetadata",
    !trashed &&
      (() =>
        void refresh({ videoId: video._id }).then(
          () => toast("Refreshing details from YouTube"),
          (err: unknown) => toast(errorMessage(err)),
        )),
  );

  return (
    <aside className="detail-pane" aria-label="Video">
      <div className="detail-bar" data-tauri-drag-region>
        <button className="btn btn-icon" aria-label="Close" title="Close" onClick={onClose}>
          <Icon as={X} />
        </button>
        <ListModeSwitch {...layout} />
        <span style={{ flex: 1 }} data-tauri-drag-region />
        {!trashed && (
          <>
            <button
              className="btn btn-icon"
              aria-label="Move to folder"
              title="Move to folder (⇧⌘M)"
              onClick={openMove}
            >
              <Icon as={FolderInput} />
            </button>
            <button
              className="btn btn-icon"
              aria-label="Move to Trash"
              title="Move to Trash"
              onClick={() =>
                void trash({ videoId: video._id }).then(() =>
                  toast("Moved to Trash", () => restore({ videoId: video._id })),
                )
              }
            >
              <Icon as={Trash2} />
            </button>
          </>
        )}
        <a className="btn btn-icon" href={watchUrl(video.youtubeId)} target="_blank" rel="noreferrer" title="Open in YouTube" aria-label="Open in YouTube">
          <Icon as={ExternalLink} />
        </a>
      </div>

      <div className="detail-scroll">
        <Player ref={player} youtubeId={video.youtubeId} title={video.title} rate={rate} onPlayingChange={setPlaying} />
        <div className="player-bar">
          <SpeedControl rate={rate} onChange={setRate} playing={playing} />
        </div>

        <div className="detail-head">
          <h4>{video.title}</h4>
          <p className="meta">
            {video.channelTitle}
            {video.durationSec ? ` · ${formatDuration(video.durationSec)}` : ""}
            {` · ${trashed ? "In Trash" : folderName}`}
          </p>
          {!trashed ? (
            <TagEditor videoIds={[video._id]} inputId={TAG_INPUT_ID} />
          ) : video.tags.length > 0 && (
            <div className="tag-row">
              {video.tags.map((t) => (
                <span key={t._id} className="tag tag-sage-solid">
                  {t.name}
                </span>
              ))}
            </div>
          )}
        </div>

        <Timestamps video={video} player={player} readOnly={trashed} />
        <Notes video={video} readOnly={trashed} />

        {video.description && (
          <details className="description">
            <summary>Description</summary>
            <p>{video.description}</p>
          </details>
        )}
      </div>
      {dialog}
    </aside>
  );
}

type Stamp = Detail["bookmarks"][number];

function Timestamps({
  video,
  player,
  readOnly,
}: {
  video: Detail;
  player: React.RefObject<PlayerHandle | null>;
  readOnly: boolean;
}) {
  const add = useMutation(api.timestamps.add);
  const update = useMutation(api.timestamps.update);
  const remove = useMutation(api.timestamps.remove);
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  /** The moment being described before it's saved; the video plays on meanwhile. */
  const [draft, setDraft] = useState<number | null>(null);
  const [editing, setEditing] = useState<Id<"bookmarks"> | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; stamp: Stamp } | null>(null);
  const chapters = video.bookmarks.filter((b) => b.source === "chapter");
  const mine = video.bookmarks.filter((b) => b.source === "user");

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const capture = () => {
    setEditing(null);
    setDraft(timestampSeconds(player.current?.currentTime() ?? 0));
  };
  useCommand("markMoment", !readOnly && capture);

  const saveDraft = (label: string) => {
    const seconds = draft;
    setDraft(null);
    if (seconds !== null) void run(() => add({ videoId: video._id, seconds, label: timestampLabel(label, seconds) }));
  };

  const saveEdit = (stamp: Stamp, label: string) => {
    setEditing(null);
    const next = timestampLabel(label, stamp.seconds);
    if (next !== stamp.label) void run(() => update({ timestampId: stamp._id, label: next }));
  };

  const del = (stamp: Stamp) =>
    void run(async () => {
      await remove({ timestampId: stamp._id });
      toast("Timestamp deleted", () => add({ videoId: video._id, seconds: stamp.seconds, label: stamp.label }));
    });

  const openInYouTube = (stamp: Stamp) => window.open(watchUrl(video.youtubeId, stamp.seconds), "_blank");

  const menuItems = (stamp: Stamp): MenuItem[] => {
    const own = stamp.source === "user" && !readOnly;
    return [
      { label: "Play from here", onSelect: () => player.current?.seekTo(stamp.seconds) },
      { label: "Open in YouTube", onSelect: () => openInYouTube(stamp) },
      {
        label: "Copy link",
        onSelect: () =>
          void navigator.clipboard.writeText(watchUrl(video.youtubeId, stamp.seconds)).then(() => toast("Link copied")),
      },
      ...(own
        ? ([
            { kind: "sep" },
            { label: "Edit description", onSelect: () => setEditing(stamp._id) },
            { label: "Delete", danger: true, onSelect: () => del(stamp) },
          ] satisfies MenuItem[])
        : []),
    ];
  };

  const row = (b: Stamp, own: boolean) => {
    const time = formatDuration(b.seconds);
    const editable = own && !readOnly;
    return (
      <li
        key={b._id}
        className="ts-row"
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu({ x: e.clientX, y: e.clientY, stamp: b });
        }}
      >
        <button className="ts-time" onClick={() => player.current?.seekTo(b.seconds)} title="Play from here">
          {time}
        </button>
        {editing === b._id ? (
          <LabelInput initial={b.label} onSave={(label) => saveEdit(b, label)} onCancel={() => setEditing(null)} />
        ) : (
          <>
            <span
              className="ts-label"
              title={editable ? `${b.label}\nDouble-click to edit` : b.label}
              onDoubleClick={editable ? () => setEditing(b._id) : undefined}
            >
              {b.label}
            </span>
            {editable && (
              <span className="ts-actions">
                <button className="btn btn-icon btn-icon-sm" aria-label={`Edit timestamp at ${time}`} title="Edit description" onClick={() => setEditing(b._id)}>
                  <Icon as={Pencil} size={14} />
                </button>
                <button className="btn btn-icon btn-icon-sm" aria-label={`Delete timestamp at ${time}`} title="Delete" onClick={() => del(b)}>
                  <Icon as={Trash2} size={14} />
                </button>
              </span>
            )}
            <button
              className="btn btn-icon btn-icon-sm ts-yt"
              aria-label={`Open in YouTube at ${time}`}
              title={`Open in YouTube at ${time}`}
              onClick={() => openInYouTube(b)}
            >
              <Icon as={ExternalLink} size={14} />
            </button>
          </>
        )}
      </li>
    );
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <h5>Timestamps</h5>
        {!readOnly && (
          <button className="btn btn-ghost btn-sm" onClick={capture}>
            <Icon as={BookmarkPlus} size={16} /> Mark this moment
          </button>
        )}
      </div>
      {draft === null && mine.length === 0 && chapters.length === 0 && (
        <p className="text-muted small">Play the video and mark a moment to come back to it.</p>
      )}
      {(draft !== null || mine.length > 0) && (
        <ul className="ts-list">
          {draft !== null && (
            <li className="ts-row">
              <span className="ts-time ts-time-draft">{formatDuration(draft)}</span>
              <LabelInput initial="" onSave={saveDraft} onCancel={() => setDraft(null)} />
            </li>
          )}
          {mine.map((b) => row(b, true))}
        </ul>
      )}
      {chapters.length > 0 && (
        <>
          <div className="kicker">Chapters</div>
          <ul className="ts-list">{chapters.map((b) => row(b, false))}</ul>
        </>
      )}
      {error && <p className="field-error">{error}</p>}
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems(menu.stamp)} onClose={() => setMenu(null)} />}
    </section>
  );
}

/** Inline description field: Return or clicking away saves, Escape cancels. */
function LabelInput({ initial, onSave, onCancel }: { initial: string; onSave: (label: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(initial);
  const done = useRef(false);
  const finish = (save: boolean) => {
    if (done.current) return;
    done.current = true;
    if (save) onSave(value.trim());
    else onCancel();
  };
  return (
    <input
      className="input ts-input"
      autoFocus
      placeholder="Add a short description"
      aria-label="Timestamp description"
      value={value}
      maxLength={200}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") finish(true);
        else if (e.key === "Escape") finish(false);
        else return;
        e.preventDefault();
        e.stopPropagation();
      }}
      onBlur={() => finish(true)}
    />
  );
}

type SaveState = "idle" | "saving" | "saved" | "error";

function Notes({ video, readOnly }: { video: Detail; readOnly: boolean }) {
  const update = useMutation(api.videos.updateNotes);
  const [text, setText] = useState(video.notes);
  const [state, setState] = useState<SaveState>("idle");
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef(text);
  latest.current = text;

  // Save a moment after typing stops, and on the way out.
  const save = async (value: string) => {
    setState("saving");
    try {
      await update({ videoId: video._id, notes: value });
      setState("saved");
    } catch {
      setState("error");
    }
  };
  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      if (latest.current !== video.notes) void update({ videoId: video._id, notes: latest.current });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const status =
    state === "saving" ? "Saving…" : state === "saved" ? "Saved" : state === "error" ? "Couldn't save" : "Private to you";

  return (
    <section className="panel notes">
      <div className="panel-head">
        <h5>Notes</h5>
        <span className="notes-status">
          {status}
          {text.trim() ? ` · ${wordCount(text)} words` : ""}
        </span>
      </div>
      <textarea
        className="notes-input"
        placeholder="Jot down what matters, steps to try, ideas…"
        value={text}
        readOnly={readOnly}
        onChange={(e) => {
          setText(e.target.value);
          setState("idle");
          window.clearTimeout(timer.current);
          const value = e.target.value;
          timer.current = window.setTimeout(() => void save(value), 700);
        }}
        onBlur={() => {
          window.clearTimeout(timer.current);
          if (text !== video.notes) void save(text);
        }}
      />
    </section>
  );
}
