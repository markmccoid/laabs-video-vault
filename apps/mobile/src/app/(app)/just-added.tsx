import { VideoListScreen } from "@/components/VideoListScreen";
import { useJustAdded } from "@/lib/justAdded";

export default function JustAdded() {
  const videos = useJustAdded();
  return (
    <VideoListScreen
      title="Just Added"
      videos={videos}
      emptyTitle="Nothing added recently"
      emptyBody="Videos you add show here for 12 hours, whichever folder they're in."
    />
  );
}
