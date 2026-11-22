import { MAX_FOLDER_DEPTH, parseYouTubeUrl } from "@lvv/core";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api, type FolderDoc, type Id } from "../lib/api";
import { errorMessage } from "../lib/errors";
import { commonFolder, moveBack, type Origin } from "../lib/moves";
import { Dialog } from "./Dialog";
import { FolderSelect } from "./FolderSelect";
import { useToast } from "./Toast";

const STATUS_WORDS = {
  added: "Added",
  restored: "Restored from Trash",
  duplicate: "Already in your library",
  updated: "Updated",
} as const;

export function AddVideoDialog({
  defaultFolderId,
  onClose,
  onAdded,
}: {
  defaultFolderId?: Id<"folders">;
  onClose: () => void;
  onAdded: (videoId: Id<"videos">) => void;
}) {
  const folders = useQuery(api.folders.list) ?? [];
  const add = useMutation(api.videos.add);
  const toast = useToast();
  const [input, setInput] = useState("");
  const [folderId, setFolderId] = useState<Id<"folders"> | undefined>(defaultFolderId);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const parsed = parseYouTubeUrl(input);

  const submit = async () => {
    if (!parsed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await add({ input, folderId, notes: notes.trim() || undefined });
      toast(STATUS_WORDS[result.status]);
      onAdded(result.videoId);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Dialog
      title="Add video"
      onClose={onClose}
      onSubmit={submit}
      actions={
        <>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={!parsed || busy}>
            {busy ? "Adding…" : "Add"}
          </button>
        </>
      }
    >
      <div className="stack">
        <div className="field">
          <label htmlFor="add-url">
            YouTube link
            {input && !parsed && <span className="field-error"> · Not a YouTube link</span>}
          </label>
          <input
            id="add-url"
            className="input"
            placeholder="Paste a link to a video or Short"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <div className="field">
          <label htmlFor="add-folder">Folder</label>
          <FolderSelect id="add-folder" folders={folders} value={folderId} onChange={setFolderId} />
        </div>
        <div className="field">
          <label htmlFor="add-notes">Note</label>
          <textarea
            id="add-notes"
            className="input"
            placeholder="Why you saved it, what to look for…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        {error && <p className="field-error">{error}</p>}
      </div>
    </Dialog>
  );
}

/** Move one or more videos; Undo puts each back in its own folder. */
export function MoveDialog({ from, onClose }: { from: Origin[]; onClose: () => void }) {
  const folders = useQuery(api.folders.list) ?? [];
  const move = useMutation(api.videos.move);
  const toast = useToast();
  const videoIds = from.map((o) => o.videoId);
  const [folderId, setFolderId] = useState<Id<"folders"> | undefined>(() => commonFolder(from));
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    try {
      await move({ videoIds, folderId });
      const name = folderId ? (folders.find((f) => f._id === folderId)?.name ?? "folder") : "Inbox";
      toast(`Moved to ${name}`, () => moveBack(move, from));
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Dialog
      title={videoIds.length === 1 ? "Move to folder" : `Move ${videoIds.length} videos`}
      onClose={onClose}
      onSubmit={submit}
      actions={
        <>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary btn-sm">
            Move
          </button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="move-folder">Folder</label>
        <FolderSelect id="move-folder" folders={folders} value={folderId} onChange={setFolderId} />
      </div>
      {error && <p className="field-error">{error}</p>}
    </Dialog>
  );
}

export function NewFolderDialog({
  parent,
  onClose,
  onCreated,
}: {
  parent?: FolderDoc;
  onClose: () => void;
  onCreated: (id: Id<"folders">) => void;
}) {
  const folders = useQuery(api.folders.list) ?? [];
  const create = useMutation(api.folders.create);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<Id<"folders"> | undefined>(parent?._id);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) return;
    try {
      onCreated(await create({ name, parentId }));
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Dialog
      title="New folder"
      onClose={onClose}
      onSubmit={submit}
      actions={
        <>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={!name.trim()}>
            Create
          </button>
        </>
      }
    >
      <div className="stack">
        <div className="field">
          <label htmlFor="folder-name">Name</label>
          <input id="folder-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="folder-parent">Inside</label>
          <FolderSelect
            id="folder-parent"
            folders={folders}
            value={parentId}
            onChange={setParentId}
            maxDepth={MAX_FOLDER_DEPTH - 2}
            emptyLabel="Top level"
          />
        </div>
        <p className="text-muted small">Folders nest up to three levels deep.</p>
        {error && <p className="field-error">{error}</p>}
      </div>
    </Dialog>
  );
}

export function RenameDialog({
  title,
  initial,
  onClose,
  onSave,
  lowercase = false,
}: {
  title: string;
  initial: string;
  onClose: () => void;
  onSave: (name: string) => Promise<unknown>;
  /** Tags: show the name lowercase as it's typed, the way it will be saved. */
  lowercase?: boolean;
}) {
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    try {
      await onSave(name);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  return (
    <Dialog
      title={title}
      onClose={onClose}
      onSubmit={submit}
      actions={
        <>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={!name.trim()}>
            Rename
          </button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="rename">Name</label>
        <input
          id="rename"
          className="input"
          value={name}
          autoCapitalize="none"
          onChange={(e) => setName(lowercase ? e.target.value.toLowerCase() : e.target.value)}
        />
      </div>
      {error && <p className="field-error">{error}</p>}
    </Dialog>
  );
}

export function ConfirmDialog({
  title,
  body,
  confirm,
  onClose,
  onConfirm,
}: {
  title: string;
  body: string;
  confirm: string;
  onClose: () => void;
  onConfirm: () => Promise<unknown>;
}) {
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog
      title={title}
      onClose={onClose}
      onSubmit={async () => {
        try {
          await onConfirm();
          onClose();
        } catch (err) {
          setError(errorMessage(err));
        }
      }}
      actions={
        <>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary btn-sm">
            {confirm}
          </button>
        </>
      }
    >
      <p>{body}</p>
      {error && <p className="field-error">{error}</p>}
    </Dialog>
  );
}
