import { useMutation } from "convex/react";
import { useState, type ReactNode } from "react";
import { api, type Id } from "../lib/api";
import { ConfirmDialog, RenameDialog } from "./Dialogs";

type TagLike = { _id: Id<"tags">; name: string; count: number; system?: string };

/**
 * Rename and delete a tag, from the sidebar's right-click menu or the tag
 * view's header. Built-in tags (Short) can't be changed. Render `dialog`.
 */
export function useTagActions(onDeleted: (tagId: Id<"tags">) => void) {
  const renameTag = useMutation(api.tags.rename);
  const removeTag = useMutation(api.tags.remove);
  const [dialog, setDialog] = useState<ReactNode>(null);
  const close = () => setDialog(null);

  return {
    dialog,
    rename: (tag: TagLike) =>
      setDialog(
        <RenameDialog
          title="Rename tag"
          initial={tag.name}
          lowercase
          onClose={close}
          onSave={(name) => renameTag({ tagId: tag._id, name })}
        />,
      ),
    remove: (tag: TagLike) =>
      setDialog(
        <ConfirmDialog
          title={`Delete #${tag.name}?`}
          body={
            tag.count > 0
              ? `#${tag.name} will be removed from all ${tag.count === 1 ? "1 video" : `${tag.count} videos`} that have it. The videos stay in your library. This can't be undone.`
              : `No videos have #${tag.name}. This can't be undone.`
          }
          confirm="Delete tag"
          onClose={close}
          onConfirm={async () => {
            await removeTag({ tagId: tag._id });
            onDeleted(tag._id);
          }}
        />,
      ),
  };
}
