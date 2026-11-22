import { Copy, FolderInput, RotateCcw, Tag, Trash2, X, XCircle, type LucideIcon } from "lucide-react";
import type { ListVideo } from "../lib/api";
import { Icon } from "./Icon";
import { useVideoActions } from "./videoActions";

/** The detail pane while several videos are selected: what's chosen, and what can be done to all of them. */
export function SelectionPane({
  videos,
  inTrash,
  inJustAdded,
  onClear,
}: {
  videos: ListVideo[];
  inTrash: boolean;
  inJustAdded: boolean;
  onClear: () => void;
}) {
  const actions = useVideoActions();
  const n = videos.length;

  const button = (label: string, icon: LucideIcon, run: () => void, kbd?: string, danger = false) => (
    <button className="btn btn-secondary selection-action" data-danger={danger || undefined} onClick={run}>
      <Icon as={icon} size={16} />
      <span>{label}</span>
      {kbd && <span className="kbd">{kbd}</span>}
    </button>
  );

  return (
    <aside className="detail-pane" aria-label={`${n} videos selected`}>
      <div className="detail-bar" data-tauri-drag-region>
        <button className="btn btn-icon" aria-label="Clear selection" title="Clear selection" onClick={onClear}>
          <Icon as={X} />
        </button>
      </div>
      <div className="detail-scroll selection-pane">
        <div className="selection-stack" aria-hidden="true">
          {videos.slice(0, 3).map((v, i) => (
            <img key={v._id} src={v.thumbnail} alt="" className="washed" style={{ "--i": i } as React.CSSProperties} draggable={false} />
          ))}
        </div>
        <h4>{n} videos selected</h4>
        <p className="meta">⌘-click to add or remove one, ⇧-click for a range.</p>
        <div className="selection-actions">
          {inTrash ? (
            <>
              {button(`Restore ${n} videos`, RotateCcw, () => actions.restore(videos))}
              {button("Delete forever…", Trash2, () => actions.deleteForever(videos), "⌘⌫", true)}
            </>
          ) : (
            <>
              {button("Move to folder…", FolderInput, () => actions.move(videos), "⇧⌘M")}
              {button("Tags…", Tag, () => actions.editTags(videos), "⌘T")}
              {button("Copy links", Copy, () => actions.copyLinks(videos), "⇧⌘C")}
              {inJustAdded && button("Dismiss from Just Added", XCircle, () => actions.dismiss(videos))}
              {button("Move to Trash", Trash2, () => actions.trash(videos), "⌘⌫", true)}
            </>
          )}
        </div>
        <ul className="selection-list">
          {videos.map((v) => (
            <li key={v._id}>{v.title}</li>
          ))}
        </ul>
      </div>
      {actions.dialog}
    </aside>
  );
}
