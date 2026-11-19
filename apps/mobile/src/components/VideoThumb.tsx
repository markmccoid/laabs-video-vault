import { formatDuration } from "@lvv/core";
import { Image } from "expo-image";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import type { VideoListItem } from "@/components/VideoRow";
import { useTheme } from "@/lib/theme";

type Props = {
  video: VideoListItem;
  style?: StyleProp<ViewStyle>;
  /** In select mode: whether this video is selected. Undefined when not selecting. */
  selected?: boolean;
};

/** 16:9 thumbnail with the duration and SHORT badges. Shared by the list row and grid card. */
export function VideoThumb({ video, style, selected }: Props) {
  const theme = useTheme();
  return (
    <View style={[styles.wrap, style]}>
      <Image source={video.thumbnail} style={styles.image} contentFit="cover" transition={150} />
      {video.durationSec !== undefined && <Text style={styles.duration}>{formatDuration(video.durationSec)}</Text>}
      {video.isShort && <Text style={[styles.badge, { backgroundColor: theme.accent }]}>SHORT</Text>}
      {selected !== undefined && (
        <View style={[StyleSheet.absoluteFill, selected && styles.dim]}>
          <View
            style={[styles.check, selected ? { backgroundColor: theme.accent, borderColor: "#fff" } : styles.checkOff]}
          >
            {selected && <Text style={styles.checkGlyph}>✓</Text>}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dim: { backgroundColor: "#0004" },
  check: {
    position: "absolute",
    right: 6,
    top: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkOff: { borderColor: "#fff", backgroundColor: "#0005" },
  checkGlyph: { color: "#fff", fontSize: 13, fontWeight: "900" },
  wrap: { aspectRatio: 16 / 9, borderRadius: 10, overflow: "hidden", backgroundColor: "#0003" },
  image: { width: "100%", height: "100%" },
  duration: {
    position: "absolute",
    right: 4,
    bottom: 4,
    backgroundColor: "#000C",
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
    paddingHorizontal: 4,
    borderRadius: 4,
    overflow: "hidden",
  },
  badge: {
    position: "absolute",
    left: 4,
    top: 4,
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: "hidden",
  },
});
