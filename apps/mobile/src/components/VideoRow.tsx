import { formatDuration } from "@lvv/core";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { Doc } from "@/lib/api";
import { useTheme } from "@/lib/theme";

export type VideoListItem = Doc<"videos"> & { thumbnail: string };

export function VideoRow({ video }: { video: VideoListItem }) {
  const theme = useTheme();
  const pending = video.metadataState === "pending";
  const unavailable = video.metadataState === "unavailable";

  return (
    <Link href={`/video/${video._id}`} asChild>
      <Pressable style={({ pressed }) => [styles.row, { backgroundColor: theme.card, opacity: pressed ? 0.7 : 1 }]}>
        <View style={styles.thumbWrap}>
          <Image source={video.thumbnail} style={styles.thumb} contentFit="cover" transition={150} />
          {video.durationSec !== undefined && (
            <Text style={styles.duration}>{formatDuration(video.durationSec)}</Text>
          )}
          {video.isShort && <Text style={[styles.badge, { backgroundColor: theme.accent }]}>SHORT</Text>}
        </View>

        <View style={styles.info}>
          {pending && !video.title ? (
            <View style={styles.pendingRow}>
              <ActivityIndicator size="small" />
              <Text style={{ color: theme.muted }}>Fetching details…</Text>
            </View>
          ) : (
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
              {video.title || video.youtubeId}
            </Text>
          )}
          {!!video.channelTitle && (
            <Text style={[styles.channel, { color: theme.muted }]} numberOfLines={1}>
              {video.channelTitle}
            </Text>
          )}
          {unavailable && <Text style={[styles.channel, { color: theme.danger }]}>Unavailable on YouTube</Text>}
          {video.metadataState === "failed" && (
            <Text style={[styles.channel, { color: theme.danger }]}>Couldn't load details</Text>
          )}
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12, padding: 10, marginHorizontal: 16, borderRadius: 14 },
  thumbWrap: { width: 140, aspectRatio: 16 / 9, borderRadius: 10, overflow: "hidden", backgroundColor: "#0003" },
  thumb: { width: "100%", height: "100%" },
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
  info: { flex: 1, gap: 4, justifyContent: "center" },
  pendingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 15, fontWeight: "600", lineHeight: 20 },
  channel: { fontSize: 13 },
});
