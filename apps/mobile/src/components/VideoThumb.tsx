import { formatDuration } from "@lvv/core";
import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import type { VideoListItem } from "@/components/VideoRow";
import { fonts, palette, radius, useTheme } from "@/lib/theme";

type Props = {
  video: Pick<VideoListItem, "thumbnail" | "durationSec" | "isShort">;
  style?: StyleProp<ViewStyle>;
  /** Show the small play disc (rows). */
  playDisc?: boolean;
};

/**
 * 16:9 thumbnail with the Organic "washed" treatment, duration pill, and
 * SHORT badge. Shared by video rows, the Add sheet preview, and "More in".
 */
export function VideoThumb({ video, style, playDisc = true }: Props) {
  const theme = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: theme.surface }, style]}>
      <Image source={video.thumbnail} style={styles.image} contentFit="cover" transition={150} />
      {/* Wash: a faint bg-coloured veil softens saturated thumbnails. */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.bg, opacity: 0.12 }]} />
      {playDisc && (
        <View style={styles.disc}>
          <SymbolView name="play.fill" size={9} tintColor={palette.neutral[900]} />
        </View>
      )}
      {video.durationSec !== undefined && video.durationSec > 0 && (
        <Text style={styles.duration}>{formatDuration(video.durationSec)}</Text>
      )}
      {video.isShort && <Text style={[styles.badge, { backgroundColor: theme.accent }]}>SHORT</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { aspectRatio: 16 / 9, borderRadius: radius.md, overflow: "hidden" },
  image: { width: "100%", height: "100%" },
  disc: {
    position: "absolute",
    left: 6,
    top: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(245,234,216,0.88)",
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 1,
  },
  duration: {
    position: "absolute",
    right: 5,
    bottom: 5,
    backgroundColor: "rgba(46,43,37,0.8)",
    color: "#f5ead8",
    fontFamily: fonts.bold,
    fontSize: 11,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    overflow: "hidden",
  },
  badge: {
    position: "absolute",
    right: 5,
    top: 5,
    color: "#f5ead8",
    fontFamily: fonts.bold,
    fontSize: 9,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 999,
    overflow: "hidden",
  },
});
