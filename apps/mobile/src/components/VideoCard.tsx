import { router } from "expo-router";
import { Pressable, StyleSheet } from "react-native";
import { VideoInfo, type VideoListItem } from "@/components/VideoRow";
import { VideoThumb } from "@/components/VideoThumb";
import { useTheme } from "@/lib/theme";

/** Grid tile: full-width thumbnail with the title and channel underneath. */
export function VideoCard({ video, width }: { video: VideoListItem; width: number }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => router.push(`/video/${video._id}`)}
      style={({ pressed }) => [styles.card, { width, backgroundColor: theme.card, opacity: pressed ? 0.7 : 1 }]}
    >
      <VideoThumb video={video} style={styles.thumb} />
      <VideoInfo video={video} compact />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, padding: 8, gap: 8 },
  thumb: { width: "100%" },
});
