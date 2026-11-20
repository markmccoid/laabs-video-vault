import { useQuery } from "convex/react";
import { VideoListScreen } from "@/components/VideoListScreen";
import { api } from "@/lib/api";

export default function Inbox() {
  const videos = useQuery(api.videos.listByFolder, {});
  return (
    <VideoListScreen
      title="Inbox"
      videos={videos}
      emptyTitle="Inbox is clear"
      emptyBody="New videos land here until you file them."
    />
  );
}
