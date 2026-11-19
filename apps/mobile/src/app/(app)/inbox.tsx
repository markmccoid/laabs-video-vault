import { useQuery } from "convex/react";
import { AddVideoBar } from "@/components/AddVideoBar";
import { VideoListScreen } from "@/components/VideoListScreen";
import { api } from "@/lib/api";

export default function Inbox() {
  const videos = useQuery(api.videos.listByFolder, {});
  return (
    <VideoListScreen
      title="Inbox"
      videos={videos}
      header={<AddVideoBar />}
      emptyTitle="Your Inbox is empty"
      emptyBody="Copy a link in YouTube, then tap Paste above."
    />
  );
}
