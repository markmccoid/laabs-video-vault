import { useAuthActions } from "@convex-dev/auth/react";
import { buildFolderTree, folderTone, MAX_FOLDER_DEPTH, type FolderNode } from "@lvv/core";
import { useMutation, useQuery } from "convex/react";
import { ChevronRight, Clock, Inbox, LogOut, Plus, Tag, Trash2 } from "lucide-react";
import { useMemo, useState, type DragEvent, type ReactNode } from "react";
import { api, type FolderDoc, type Id } from "../lib/api";
import type { ThemeChoice } from "../lib/theme";
import { sameView, type View } from "../lib/views";
import { ConfirmDialog, NewFolderDialog, RenameDialog } from "./Dialogs";
import { Icon } from "./Icon";
import { ContextMenu, type MenuItem } from "./Menu";
import { useToast } from "./Toast";

export const DRAG_TYPE = "application/x-lvv-videos";
export type DragPayload = { videoIds: Id<"videos">[]; fromFolderId: Id<"folders"> | null };

function countLabel(n: number | undefined, cap = 200) {
  if (!n) return null;
  return n >= cap ? `${cap}+` : String(n);
}

export function Sidebar({
  view,
  onView,
  theme,
  onTheme,
  justAddedSinceMs,
}: {
  view: View;
  onView: (v: View) => void;
  theme: ThemeChoice;
  onTheme: (t: ThemeChoice) => void;
  justAddedSinceMs: number;
}) {
  const folders = useQuery(api.folders.list);
  const counts = useQuery(api.folders.counts);
  const tags = useQuery(api.tags.list);
  const inbox = useQuery(api.videos.listByFolder, {});
  const justAdded = useQuery(api.videos.listJustAdded, { since: justAddedSinceMs });
  const viewer = useQuery(api.users.viewer);
  const removeFolder = useMutation(api.folders.remove);
  const renameFolder = useMutation(api.folders.rename);
  const move = useMutation(api.videos.move);
  const { signOut } = useAuthActions();
  const toast = useToast();

  const tree = useMemo(() => buildFolderTree(folders ?? []), [folders]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<{ x: number; y: number; folder: FolderDoc } | null>(null);
  const [dialog, setDialog] = useState<ReactNode>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const close = () => setDialog(null);

  const dropHandlers = (key: string, folderId: Id<"folders"> | undefined, name: string) => ({
    onDragOver: (e: DragEvent) => {
      if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDropTarget(key);
    },
    onDragLeave: () => setDropTarget((k) => (k === key ? null : k)),
    onDrop: (e: DragEvent) => {
      setDropTarget(null);
      setDragging(false);
      const raw = e.dataTransfer.getData(DRAG_TYPE);
      if (!raw) return;
      e.preventDefault();
      const { videoIds, fromFolderId } = JSON.parse(raw) as DragPayload;
      if ((fromFolderId ?? undefined) === folderId) return;
      void move({ videoIds, folderId }).then(() =>
        toast(`Moved to ${name}`, () => move({ videoIds, folderId: fromFolderId ?? undefined })),
      );
    },
    "data-drop": dropTarget === key ? "over" : dragging ? "live" : undefined,
  });

  const folderMenu = (folder: FolderDoc): MenuItem[] => [
    {
      label: "New subfolder…",
      disabled: folder.depth >= MAX_FOLDER_DEPTH - 1,
      onSelect: () =>
        setDialog(
          <NewFolderDialog
            parent={folder}
            onClose={close}
            onCreated={(id) => onView({ kind: "folder", id })}
          />,
        ),
    },
    {
      label: "Rename…",
      onSelect: () =>
        setDialog(
          <RenameDialog
            title="Rename folder"
            initial={folder.name}
            onClose={close}
            onSave={(name) => renameFolder({ folderId: folder._id, name })}
          />,
        ),
    },
    { kind: "sep" },
    {
      label: "Delete folder…",
      danger: true,
      onSelect: () =>
        setDialog(
          <ConfirmDialog
            title={`Delete "${folder.name}"?`}
            body="Its subfolders go too. Every video inside moves up to the parent folder, or the Inbox. No videos are deleted."
            confirm="Delete folder"
            onClose={close}
            onConfirm={async () => {
              await removeFolder({ folderId: folder._id });
              if (view.kind === "folder" && view.id === folder._id) onView({ kind: "inbox" });
            }}
          />,
        ),
    },
  ];

  const renderFolder = (node: FolderNode<FolderDoc>): ReactNode => {
    const open = !collapsed.has(node._id);
    const current = sameView(view, { kind: "folder", id: node._id });
    const tone = folderTone(folders ?? [], node._id);
    return (
      <li key={node._id}>
        <div
          className="side-item"
          role="treeitem"
          aria-current={current ? "true" : undefined}
          aria-expanded={node.children.length ? open : undefined}
          style={{ paddingLeft: `calc(var(--space-3) + ${node.depth * 14}px)` }}
          tabIndex={0}
          onClick={() => onView({ kind: "folder", id: node._id })}
          onKeyDown={(e) => e.key === "Enter" && onView({ kind: "folder", id: node._id })}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenu({ x: e.clientX, y: e.clientY, folder: node });
          }}
          {...dropHandlers(node._id, node._id, node.name)}
        >
          {node.children.length > 0 ? (
            <button
              className="disclosure"
              aria-label={open ? "Collapse" : "Expand"}
              data-open={open || undefined}
              onClick={(e) => {
                e.stopPropagation();
                setCollapsed((s) => {
                  const next = new Set(s);
                  if (open) next.add(node._id);
                  else next.delete(node._id);
                  return next;
                });
              }}
            >
              <Icon as={ChevronRight} size={14} />
            </button>
          ) : (
            <span className="disclosure" />
          )}
          <span className={`tone-dot tone-${tone}`} aria-hidden="true" />
          <span className="side-label">{node.name}</span>
          <span className="count">{countLabel(counts?.[node._id])}</span>
        </div>
        {open && node.children.length > 0 && <ul role="group">{node.children.map(renderFolder)}</ul>}
      </li>
    );
  };

  const navItem = (target: View, icon: typeof Inbox, label: string, count?: string | null, drop?: object) => (
    <div
      className="side-item"
      role="button"
      tabIndex={0}
      aria-current={sameView(view, target) ? "true" : undefined}
      onClick={() => onView(target)}
      onKeyDown={(e) => e.key === "Enter" && onView(target)}
      {...drop}
    >
      <Icon as={icon} />
      <span className="side-label">{label}</span>
      <span className="count">{count}</span>
    </div>
  );

  return (
    <aside
      className="sidebar app-sidebar"
      onDragEnter={(e) => e.dataTransfer.types.includes(DRAG_TYPE) && setDragging(true)}
      onDragEnd={() => setDragging(false)}
    >
      <div className="sidebar-top" data-tauri-drag-region />
      <div className="brand" data-tauri-drag-region>
        Video Vault
      </div>

      <nav className="sidebar-scroll" aria-label="Library">
        <div className="side-head">Library</div>
        {navItem({ kind: "justAdded" }, Clock, "Just Added", countLabel(justAdded?.length))}
        {navItem({ kind: "inbox" }, Inbox, "Inbox", countLabel(inbox?.length), dropHandlers("inbox", undefined, "Inbox"))}
        {navItem({ kind: "trash" }, Trash2, "Trash")}

        <div className="side-head side-head-row">
          Folders
          <button
            className="btn btn-ghost btn-icon-sm"
            aria-label="New folder"
            title="New folder"
            onClick={() =>
              setDialog(<NewFolderDialog onClose={close} onCreated={(id) => onView({ kind: "folder", id })} />)
            }
          >
            <Icon as={Plus} size={16} />
          </button>
        </div>
        {folders && folders.length === 0 && <p className="side-empty">No folders yet.</p>}
        <ul className="tree" role="tree">
          {tree.map(renderFolder)}
        </ul>

        {tags && tags.length > 0 && (
          <>
            <div className="side-head">Tags</div>
            {[...tags]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((t) => (
                <div key={t._id}>{navItem({ kind: "tag", id: t._id }, Tag, t.name, countLabel(t.count, 500))}</div>
              ))}
          </>
        )}
      </nav>

      <div className="sidebar-foot">
        <div className="seg seg-sm" role="radiogroup" aria-label="Appearance">
          {(["system", "light", "dark"] as const).map((t) => (
            <label key={t} className="seg-opt">
              <input type="radio" name="theme" checked={theme === t} onChange={() => onTheme(t)} />
              {t[0]!.toUpperCase() + t.slice(1)}
            </label>
          ))}
        </div>
        <div className="account">
          <span className="account-email" title={viewer?.email ?? undefined}>
            {viewer?.email ?? "Signed in"}
          </span>
          <button className="btn btn-ghost btn-icon-sm" aria-label="Sign out" title="Sign out" onClick={() => void signOut()}>
            <Icon as={LogOut} size={16} />
          </button>
        </div>
      </div>

      {menu && <ContextMenu x={menu.x} y={menu.y} items={folderMenu(menu.folder)} onClose={() => setMenu(null)} />}
      {dialog}
    </aside>
  );
}

