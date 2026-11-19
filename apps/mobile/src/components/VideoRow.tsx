import { router } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { VideoThumb } from "@/components/VideoThumb";
import type { Doc } from "@/lib/api";
import { useTheme } from "@/lib/theme";

export type VideoListItem = Doc<"videos"> & { thumbnail: string };

/** Title, channel, and metadata-state lines. Shared by the list row and grid card. */
export function VideoInfo({ video, compact = false }: { video: VideoListItem; compact?: boolean }) {
  const theme = useTheme();
  const pending = video.metadataState === "pending";

  return (
    <View style={styles.info}>
      {pending && !video.title ? (
        <View style={styles.pendingRow}>
          <ActivityIndicator size="small" />
          <Text style={{ color: theme.muted }}>Fetching details…</Text>
        </View>
      ) : (
        <Text style={[styles.title, compact && styles.titleCompact, { color: theme.text }]} numberOfLines={2}>
          {video.title || video.youtubeId}
        </Text>
      )}
      {!!video.channelTitle && (
        <Text style={[styles.channel, { color: theme.muted }]} numberOfLines={1}>
          {video.channelTitle}
        </Text>
      )}
      {video.metadataState === "unavailable" && (
        <Text style={[styles.channel, { color: theme.danger }]}>Unavailable on YouTube</Text>
      )}
      {video.metadataState === "failed" && (
        <Text style={[styles.channel, { color: theme.danger }]}>Couldn't load details</Text>
      )}
    </View>
  );
}

export function VideoRow({ video }: { video: VideoListItem }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => router.push(`/video/${video._id}`)}
      style={({ pressed }) => [styles.row, { backgroundColor: theme.card, opacity: pressed ? 0.7 : 1 }]}
    >
      <VideoThumb video={video} style={styles.thumb} />
      <View style={styles.rowInfo}>
        <VideoInfo video={video} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12, padding: 10, marginHorizontal: 16, borderRadius: 14 },
  thumb: { width: 140 },
  rowInfo: { flex: 1, justifyContent: "center" },
  info: { gap: 4 },
  pendingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 15, fontWeight: "600", lineHeight: 20 },
  titleCompact: { fontSize: 14, lineHeight: 18 },
  channel: { fontSize: 13 },
});
