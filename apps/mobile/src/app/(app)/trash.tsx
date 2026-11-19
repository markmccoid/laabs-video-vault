import { useMutation, useQuery } from "convex/react";
import { Alert } from "react-native";
import { VideoListScreen } from "@/components/VideoListScreen";
import type { VideoListItem } from "@/components/VideoRow";
import { api } from "@/lib/api";
import { attempt, confirmDestructive } from "@/lib/prompt";

export default function Trash() {
  const videos = useQuery(api.videos.listTrash);
  const restoreMany = useMutation(api.videos.restoreMany);
  const deleteForever = useMutation(api.videos.deleteForever);
  const emptyTrash = useMutation(api.videos.emptyTrash);

  const onPressVideo = (video: VideoListItem) =>
    Alert.alert(video.title || "This video", undefined, [
      { text: "Restore", onPress: () => void attempt("Couldn't restore", () => restoreMany({ videoIds: [video._id] })) },
      {
        text: "Delete Forever",
        style: "destructive",
        onPress: () => void attempt("Couldn't delete", () => deleteForever({ videoIds: [video._id] })),
      },
      { text: "Cancel", style: "cancel" },
    ]);

  const onEmpty = async () => {
    const n = videos?.length ?? 0;
    const ok = await confirmDestructive(
      "Empty Trash?",
      `${n === 1 ? "1 video" : `All ${n} videos`} will be deleted forever. This can't be undone.`,
      "Empty Trash",
    );
    if (ok) await attempt("Couldn't empty Trash", () => emptyTrash());
  };

  return (
    <VideoListScreen
      title="Trash"
      mode="trash"
      videos={videos}
      onPressVideo={onPressVideo}
      emptyTitle="Trash is empty"
      emptyBody="Videos you move to the Trash stay here until you delete them."
      menuItems={[
        { label: "Empty Trash", icon: "trash.slash", onPress: onEmpty, destructive: true, hidden: !videos?.length },
      ]}
    />
  );
}
