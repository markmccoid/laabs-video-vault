import { folderPath, formatDuration, watchUrl } from "@lvv/core";
import { useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SymbolView } from "expo-symbols";
import { YouTubePlayer, type YouTubePlayerHandle } from "@/components/YouTubePlayer";
import { api, type Id } from "@/lib/api";
import { useTheme } from "@/lib/theme";

/** Detail screen: embedded player, metadata, chapters (seek the player), notes. */
export default function VideoDetail() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: Id<"videos"> }>();
  const video = useQuery(api.videos.get, { videoId: id });
  const folders = useQuery(api.folders.list);
  const updateNotes = useMutation(api.videos.updateNotes);
  const markOpened = useMutation(api.videos.markOpened);
  const trash = useMutation(api.videos.trash);
  const refresh = useMutation(api.videos.refreshMetadata);

  const [notes, setNotes] = useState<string | null>(null);
  const [showDescription, setShowDescription] = useState(false);
  const player = useRef<YouTubePlayerHandle>(null);

  useEffect(() => {
    void markOpened({ videoId: id });
  }, [id, markOpened]);

  if (video === undefined) return <ActivityIndicator style={{ marginTop: 40 }} />;

  const openInYouTube = () => void Linking.openURL(watchUrl(video.youtubeId));
  const location = video.folderId && folders ? folderPath(folders, video.folderId).join(" › ") || "Inbox" : "Inbox";
  const editTags = () => router.push({ pathname: "/tag-picker", params: { videoIds: id } });
  const chapters = video.bookmarks.filter((b) => b.source === "chapter");

  const confirmTrash = () =>
    Alert.alert("Move to Trash?", video.title || "This video", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Move to Trash",
        style: "destructive",
        onPress: async () => {
          await trash({ videoId: id });
          router.back();
        },
      },
    ]);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <YouTubePlayer ref={player} youtubeId={video.youtubeId} thumbnail={video.thumbnail} />

      <View style={styles.section}>
        <Text style={[styles.title, { color: theme.text }]}>{video.title || "Loading…"}</Text>
        <Text style={{ color: theme.muted }}>
          {[
            video.channelTitle,
            video.durationSec !== undefined ? formatDuration(video.durationSec) : null,
            video.publishedAt ? new Date(video.publishedAt).toLocaleDateString() : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </Text>
        <Pressable onPress={openInYouTube} hitSlop={6} style={styles.openLink}>
          <Text style={{ color: theme.accent, fontWeight: "600" }}>Open in YouTube ↗</Text>
        </Pressable>

        <Pressable
          style={styles.folderRow}
          onPress={() => router.push({ pathname: "/move", params: { videoIds: id } })}
          accessibilityRole="button"
          accessibilityLabel={`Folder: ${location}. Move`}
        >
          <SymbolView name={video.folderId ? "folder" : "tray"} size={16} tintColor={theme.muted} />
          <Text style={{ color: theme.text, flexShrink: 1 }} numberOfLines={1}>
            {location}
          </Text>
          <Text style={{ color: theme.accent, fontWeight: "600" }}>Move</Text>
        </Pressable>

        <View style={styles.tags}>
          {video.tags.map((t) => (
            <Pressable key={t._id} onPress={() => router.push(`/tag/${t._id}`)}>
              <Text style={[styles.tag, { backgroundColor: theme.border, color: theme.text }]}>#{t.name}</Text>
            </Pressable>
          ))}
          <Pressable onPress={editTags} accessibilityRole="button" accessibilityLabel="Edit tags">
            <Text style={[styles.tag, styles.tagEdit, { borderColor: theme.accent, color: theme.accent }]}>
              {video.tags.length ? "Edit Tags" : "+ Add Tag"}
            </Text>
          </Pressable>
        </View>

        {(video.metadataState === "failed" || video.metadataState === "unavailable") && (
          <Pressable onPress={() => refresh({ videoId: id })}>
            <Text style={{ color: theme.danger }}>
              {video.metadataState === "unavailable" ? "Unavailable on YouTube." : "Couldn't load details."} Tap to
              retry.
            </Text>
          </Pressable>
        )}
      </View>

      <View style={styles.section}>
        <Text style={[styles.heading, { color: theme.text }]}>Notes</Text>
        <TextInput
          multiline
          style={[styles.notes, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
          placeholder="Why did you save this?"
          placeholderTextColor={theme.muted}
          value={notes ?? video.notes}
          onChangeText={setNotes}
          onBlur={() => {
            if (notes !== null && notes !== video.notes) void updateNotes({ videoId: id, notes });
            setNotes(null);
          }}
        />
      </View>

      {chapters.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.heading, { color: theme.text }]}>Chapters</Text>
          {chapters.map((c) => (
            <Pressable key={c._id} style={styles.chapter} onPress={() => player.current?.seekTo(c.seconds)}>
              <Text style={[styles.chapterTime, { color: theme.accent }]}>{formatDuration(c.seconds)}</Text>
              <Text style={[styles.chapterLabel, { color: theme.text }]}>{c.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {!!video.description && (
        <View style={styles.section}>
          <Pressable onPress={() => setShowDescription(!showDescription)}>
            <Text style={[styles.heading, { color: theme.text }]}>
              Description {showDescription ? "▾" : "▸"}
            </Text>
          </Pressable>
          {showDescription && <Text style={{ color: theme.muted, lineHeight: 20 }}>{video.description}</Text>}
        </View>
      )}

      <Pressable style={styles.section} onPress={confirmTrash}>
        <Text style={{ color: theme.danger, fontWeight: "600" }}>Move to Trash</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 48 },
  openLink: { alignSelf: "flex-start" },
  section: { paddingHorizontal: 16, paddingTop: 16, gap: 8 },
  title: { fontSize: 20, fontWeight: "700", lineHeight: 26 },
  heading: { fontSize: 17, fontWeight: "700" },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: "hidden", fontSize: 13 },
  tagEdit: { borderWidth: 1, fontWeight: "600" },
  folderRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  notes: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 90, fontSize: 15, textAlignVertical: "top" },
  chapter: { flexDirection: "row", gap: 12, paddingVertical: 6 },
  chapterTime: { fontVariant: ["tabular-nums"], fontWeight: "600", width: 64 },
  chapterLabel: { flex: 1 },
});
