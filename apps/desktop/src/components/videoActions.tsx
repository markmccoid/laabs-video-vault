import { watchUrl } from "@lvv/core";
import { useMutation } from "convex/react";
import { useState, type ReactNode } from "react";
import { api, type ListVideo } from "../lib/api";
import { originOf } from "../lib/moves";
import { ConfirmDialog, MoveDialog } from "./Dialogs";
import { TAG_INPUT_ID, TagsDialog } from "./TagEditor";
import { useToast } from "./Toast";

const count = (n: number) => (n === 1 ? "1 video" : `${n} videos`);

/**
 * What can be done to one or more list videos: shared by the row menus, the
 * menu bar commands, and the "N selected" pane. Render `dialog` somewhere.
 */
export function useVideoActions() {
  const trashMany = useMutation(api.videos.trashMany);
  const restoreMany = useMutation(api.videos.restoreMany);
  const deleteForever = useMutation(api.videos.deleteForever);
  const dismissMany = useMutation(api.videos.dismissJustAdded);
  const toast = useToast();
  const [dialog, setDialog] = useState<ReactNode>(null);
  const close = () => setDialog(null);
  const ids = (vs: ListVideo[]) => vs.map((v) => v._id);

  return {
    dialog,
    trash: (vs: ListVideo[]) =>
      void trashMany({ videoIds: ids(vs) }).then(() =>
        toast(vs.length === 1 ? "Moved to Trash" : `Moved ${count(vs.length)} to Trash`, () => restoreMany({ videoIds: ids(vs) })),
      ),
    restore: (vs: ListVideo[]) =>
      void restoreMany({ videoIds: ids(vs) }).then(() => toast(vs.length === 1 ? "Restored" : `Restored ${count(vs.length)}`)),
    deleteForever: (vs: ListVideo[]) =>
      setDialog(
        <ConfirmDialog
          title="Delete forever?"
          body={`${vs.length === 1 ? `“${vs[0]!.title}” and its` : `${count(vs.length)} and their`} notes and timestamps will be gone. This can't be undone.`}
          confirm="Delete forever"
          onClose={close}
          onConfirm={() => deleteForever({ videoIds: ids(vs) })}
        />,
      ),
    move: (vs: ListVideo[]) => setDialog(<MoveDialog from={vs.map(originOf)} onClose={close} />),
    copyLinks: (vs: ListVideo[]) =>
      void navigator.clipboard
        .writeText(vs.map((v) => watchUrl(v.youtubeId)).join("\n"))
        .then(() => toast(vs.length === 1 ? "Link copied" : `${vs.length} links copied`)),
    /** The open video's tag field when it's that video, otherwise a dialog. */
    editTags: (vs: ListVideo[]) => {
      const field =
        vs.length === 1 ? document.querySelector<HTMLElement>(`#${TAG_INPUT_ID}[data-video-id="${vs[0]!._id}"]`) : null;
      if (field) field.focus();
      else setDialog(<TagsDialog videoIds={ids(vs)} onClose={close} />);
    },
    dismiss: (vs: ListVideo[]) =>
      void dismissMany({ videoIds: ids(vs) }).then(() => vs.length > 1 && toast(`Dismissed ${count(vs.length)}`)),
  };
}

export type VideoActions = ReturnType<typeof useVideoActions>;
