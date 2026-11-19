import { useMutation } from "convex/react";
import { router } from "expo-router";
import { api, type Doc, type Id } from "@/lib/api";
import { attempt, confirmDestructive, promptText } from "@/lib/prompt";

/** Create / rename / move / delete folders, with prompts and error alerts. */
export function useFolderActions() {
  const create = useMutation(api.folders.create);
  const rename = useMutation(api.folders.rename);
  const remove = useMutation(api.folders.remove);

  return {
    async newFolder(parentId?: Id<"folders">) {
      const name = await promptText(parentId ? "New Subfolder" : "New Folder", { action: "Create" });
      if (name === null) return;
      await attempt("Couldn't create folder", () => create({ name, parentId }));
    },

    async rename(folder: Doc<"folders">) {
      const name = await promptText("Rename Folder", { initial: folder.name });
      if (name !== null) await attempt("Couldn't rename folder", () => rename({ folderId: folder._id, name }));
    },

    move(folder: Doc<"folders">) {
      router.push({ pathname: "/move", params: { folderId: folder._id } });
    },

    /** Returns true if the folder was deleted. */
    async remove(folder: Doc<"folders">) {
      const ok = await confirmDestructive(
        `Delete "${folder.name}"?`,
        `Its subfolders are deleted too. All their videos move to ${folder.parentId ? "the parent folder" : "the Inbox"}.`,
        "Delete Folder",
      );
      return ok && (await attempt("Couldn't delete folder", () => remove({ folderId: folder._id })));
    },
  };
}
