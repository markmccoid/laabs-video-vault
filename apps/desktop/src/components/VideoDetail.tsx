import { folderPath, formatDuration, timestampLabel, timestampSeconds, watchUrl, wordCount } from "@lvv/core";
import { useMutation, useQuery } from "convex/react";
import { BookmarkPlus, ExternalLink, FolderInput, PanelLeft, PanelLeftDashed, PanelRight, Trash2, X, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { api, type Id, type VideoDetail as Detail } from "../lib/api";
import { errorMessage } from "../lib/errors";
import type { ListMode } from "../lib/listMode";
import { MOD } from "../lib/views";
import { MoveDialog } from "./Dialogs";
import { Icon } from "./Icon";
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
  const toast = useToast();
  const player = useRef<PlayerHandle>(null);
  const [dialog, setDialog] = useState<ReactNode>(null);
  const trashed = video.deletedAt !== undefined;
  const folderName = video.folderId && folders ? folderPath(folders, video.folderId).join(" › ") : "Inbox";

  useEffect(() => {
    if (!trashed) void markOpened({ videoId: video._id });
  }, [video._id, trashed, markOpened]);

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
              title="Move to folder"
              onClick={() =>
                setDialog(
                  <MoveDialog videoIds={[video._id]} currentFolderId={video.folderId} onClose={() => setDialog(null)} />,
                )
              }
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
        <Player ref={player} youtubeId={video.youtubeId} title={video.title} />

        <div className="detail-head">
          <h4>{video.title}</h4>
          <p className="meta">
            {video.channelTitle}
            {video.durationSec ? ` · ${formatDuration(video.durationSec)}` : ""}
            {` · ${trashed ? "In Trash" : folderName}`}
          </p>
          {video.tags.length > 0 && (
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
  const remove = useMutation(api.timestamps.remove);
  const [error, setError] = useState<string | null>(null);
  const chapters = video.bookmarks.filter((b) => b.source === "chapter");
  const mine = video.bookmarks.filter((b) => b.source === "user");

  const capture = async () => {
    const seconds = timestampSeconds(player.current?.currentTime() ?? 0);
    setError(null);
    try {
      await add({ videoId: video._id, seconds, label: timestampLabel("", seconds) });
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const row = (b: Detail["bookmarks"][number], removable: boolean) => (
    <li key={b._id} className="ts-row">
      <button className="ts-time" onClick={() => player.current?.seekTo(b.seconds)} title="Play from here">
        {formatDuration(b.seconds)}
      </button>
      <span className="ts-label">{b.label}</span>
      {removable && !readOnly && (
        <button className="btn btn-icon btn-icon-sm ts-remove" aria-label="Remove timestamp" onClick={() => void remove({ timestampId: b._id })}>
          <Icon as={X} size={14} />
        </button>
      )}
    </li>
  );

  return (
    <section className="panel">
      <div className="panel-head">
        <h5>Timestamps</h5>
        {!readOnly && (
          <button className="btn btn-ghost btn-sm" onClick={() => void capture()}>
            <Icon as={BookmarkPlus} size={16} /> Mark this moment
          </button>
        )}
      </div>
      {mine.length === 0 && chapters.length === 0 && (
        <p className="text-muted small">Play the video and mark a moment to come back to it.</p>
      )}
      {mine.length > 0 && <ul className="ts-list">{mine.map((b) => row(b, true))}</ul>}
      {chapters.length > 0 && (
        <>
          <div className="kicker">Chapters</div>
          <ul className="ts-list">{chapters.map((b) => row(b, false))}</ul>
        </>
      )}
      {error && <p className="field-error">{error}</p>}
    </section>
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
