import { Pressable, StyleSheet } from "react-native";
import { openVideo, VideoInfo, type VideoItemProps } from "@/components/VideoRow";
import { VideoThumb } from "@/components/VideoThumb";
import { useTheme } from "@/lib/theme";

/** Grid tile: full-width thumbnail with the title and channel underneath. */
export function VideoCard({ video, width, onPress, selected }: VideoItemProps & { width: number }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress ?? (() => openVideo(video))}
      accessibilityState={selected === undefined ? undefined : { selected }}
      style={({ pressed }) => [styles.card, { width, backgroundColor: theme.card, opacity: pressed ? 0.7 : 1 }]}
    >
      <VideoThumb video={video} style={styles.thumb} selected={selected} />
      <VideoInfo video={video} compact />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, padding: 8, gap: 8 },
  thumb: { width: "100%" },
});
