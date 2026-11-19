import { useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { VideoListScreen } from "@/components/VideoListScreen";
import { api, type Id } from "@/lib/api";
import { attempt, confirmDestructive, promptText } from "@/lib/prompt";

export default function TagScreen() {
  const { id } = useLocalSearchParams<{ id: Id<"tags"> }>();
  const tag = useQuery(api.tags.get, { tagId: id });
  const videos = useQuery(api.videos.listByTag, tag ? { tagId: id } : "skip");
  const rename = useMutation(api.tags.rename);
  const remove = useMutation(api.tags.remove);

  // The tag was deleted (here or on another device).
  useEffect(() => {
    if (tag === null && router.canGoBack()) router.back();
  }, [tag]);

  const onRename = async () => {
    const name = await promptText("Rename Tag", { initial: tag?.name });
    if (name !== null) await attempt("Couldn't rename tag", () => rename({ tagId: id, name }));
  };

  const onDelete = async () => {
    const ok = await confirmDestructive(
      `Delete #${tag?.name}?`,
      "The tag is removed from every video. The videos stay in your library.",
      "Delete Tag",
    );
    if (ok) await attempt("Couldn't delete tag", () => remove({ tagId: id }));
  };

  return (
    <VideoListScreen
      title={tag ? `#${tag.name}` : ""}
      videos={videos}
      emptyTitle="No videos with this tag"
      emptyBody="Select videos in a folder, then tap Tag."
      menuItems={[
        { label: "Rename Tag", icon: "pencil", onPress: onRename, hidden: !!tag?.system },
        { label: "Delete Tag", icon: "trash", onPress: onDelete, destructive: true, hidden: !!tag?.system },
      ]}
    />
  );
}
