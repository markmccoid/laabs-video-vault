import { Button, Host, Image as SwiftImage, Menu } from "@expo/ui/swift-ui";
import { frame, glassEffect } from "@expo/ui/swift-ui/modifiers";
import { formatDuration, watchUrl } from "@lvv/core";
import { useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Keyboard, Linking, Pressable, ScrollView, type ScrollViewInstance, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NotesCard } from "@/components/NotesCard";
import { PlayerControls } from "@/components/PlayerControls";
import { Scrubber } from "@/components/Scrubber";
import { TimestampsCard } from "@/components/TimestampsCard";
import { Chip, SectionTitle } from "@/components/ui";
import { VideoRow } from "@/components/VideoRow";
import { YouTubePlayer, type YouTubePlayerHandle } from "@/components/YouTubePlayer";
import { api, type Id } from "@/lib/api";
import { useFolders } from "@/lib/folders";
import { usePreferences } from "@/lib/preferences";
import { confirmDestructive } from "@/lib/prompt";
import { GUTTER, radius, type, useTheme } from "@/lib/theme";
import { useVideoActions } from "@/lib/videoActions";

/** Player (2i): embed, title, folder, tags, description, timestamps, notes, chapters, more in folder. */
export default function Player() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: Id<"videos"> }>();
  const video = useQuery(api.videos.get, { videoId: id });
  const data = useFolders();
  const siblings = useQuery(
    api.videos.listByFolder,
    video ? (video.folderId ? { folderId: video.folderId } : {}) : "skip",
  );
  const markOpened = useMutation(api.videos.markOpened);
  const refresh = useMutation(api.videos.refreshMetadata);
  const actions = useVideoActions();
  const player = useRef<YouTubePlayerHandle>(null);
  const [time, setTime] = useState({ t: 0, d: 0 });
  const [playing, setPlaying] = useState(false);
  const prefs = usePreferences();
  // Each video starts at the default speed (Settings → Player).
  const [rate, setRate] = useState(prefs.defaultRate);
  const [showDescription, setShowDescription] = useState(false);
  const scroller = useRef<ScrollViewInstance>(null);
  const notesY = useRef(0);

  useEffect(() => {
    void markOpened({ videoId: id });
  }, [id, markOpened]);

  const onTimeUpdate = useCallback((t: number, d: number) => setTime({ t, d }), []);
  // Show the new position right away; the player only reports time once a second.
  const seek = useCallback((s: number, opts?: { play?: boolean }) => {
    setTime((prev) => ({ ...prev, t: s }));
    player.current?.seekTo(s, opts);
  }, []);

  // Bring My notes up under the floating buttons once the keyboard is up, so
  // the keyboard never covers it. The ScrollView's keyboard inset makes room.
  const revealNotes = useCallback(() => {
    const scroll = () =>
      scroller.current?.scrollTo({ y: Math.max(0, notesY.current - (insets.top + 60)), animated: true });
    if (Keyboard.isVisible()) return scroll();
    const sub = Keyboard.addListener("keyboardDidShow", () => {
      sub.remove();
      scroll();
    });
    setTimeout(() => sub.remove(), 1500);
  }, [insets.top]);

  if (video === undefined) {
    return <ActivityIndicator style={{ marginTop: 80 }} />;
  }

  const duration = time.d || video.durationSec || 0;
  const location = data.pathFor(video.folderId);
  const folderName = video.folderId ? (data.byId.get(video.folderId)?.name ?? "Folder") : "Inbox";
  const tone = video.folderId ? data.tone(video.folderId) : theme.tones.neutral;
  const chapters = video.bookmarks.filter((b) => b.source === "chapter");
  const more = (siblings ?? []).filter((v) => v._id !== id).slice(0, 3);
  const description = video.description.trim();

  const confirmTrash = async () => {
    if (await confirmDestructive("Delete this video?", "It moves to Trash. You can restore it from Settings → Trash.", "Delete")) {
      if (await actions.trash([id])) router.back();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        ref={scroller}
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }]}
      >
        <YouTubePlayer
          ref={player}
          youtubeId={video.youtubeId}
          thumbnail={video.thumbnail}
          onTimeUpdate={onTimeUpdate}
          controls={prefs.youtubeControls}
          playbackRate={rate}
          onPlayingChange={setPlaying}
        />
        <Scrubber position={time.t} duration={duration} onSeek={seek} />
        {!prefs.youtubeControls && (
          <PlayerControls
            playing={playing}
            onTogglePlay={() => (playing ? player.current?.pause() : player.current?.play())}
            rate={rate}
            onRateChange={setRate}
            jumpBack={prefs.jumpBack}
            jumpForward={prefs.jumpForward}
            onJump={(delta) => {
              const end = duration || Number.POSITIVE_INFINITY;
              // Keep a paused video paused; a running one keeps playing.
              seek(Math.max(0, Math.min(end, time.t + delta)), { play: playing });
            }}
            onOpenInYouTube={() => {
              player.current?.pause();
              void Linking.openURL(watchUrl(video.youtubeId, time.t));
            }}
          />
        )}

        <View style={styles.titleBlock}>
          <Text style={[type.title, { color: theme.text }]}>{video.title || "Loading…"}</Text>
          {!!video.channelTitle && <Text style={[type.body, { color: theme.muted }]}>{video.channelTitle}</Text>}
          {(video.metadataState === "failed" || video.metadataState === "unavailable") && (
            <Pressable onPress={() => void refresh({ videoId: id })} accessibilityRole="button">
              <Text style={[type.metaStrong, { color: theme.danger }]}>
                {video.metadataState === "unavailable" ? "Unavailable on YouTube." : "Couldn't load details."} Tap to retry.
              </Text>
            </Pressable>
          )}
        </View>

        <Pressable
          onPress={() => actions.move([id])}
          accessibilityRole="button"
          accessibilityLabel={`Folder: ${location}. Move`}
          style={({ pressed }) => [styles.folderCard, { backgroundColor: theme.surface, opacity: pressed ? 0.8 : 1 }]}
        >
          <View style={[styles.folderBadge, { backgroundColor: tone.badge }]}>
            <SymbolView name={video.folderId ? "folder.fill" : "tray"} size={18} tintColor={tone.icon} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[type.meta, { color: theme.muted }]}>{video.folderId ? "Folder" : "Not filed yet"}</Text>
            <Text style={[type.label, { color: theme.text, fontSize: 15 }]} numberOfLines={1}>
              {location}
            </Text>
          </View>
          <Text style={[type.button, { color: theme.accentInk }]}>Move</Text>
        </Pressable>

        <View style={styles.tags}>
          {video.tags.map((t) => (
            <Chip key={t._id} label={t.name} variant="sage" size="md" onPress={() => router.push(`/tag/${t._id}`)} />
          ))}
          <Chip label="Tag" icon="plus" variant="dashed" size="md" onPress={() => actions.editTags([id])} accessibilityLabel="Edit tags" />
        </View>

        {!!description && (
          <Pressable onPress={() => setShowDescription(!showDescription)} accessibilityRole="button" accessibilityHint="Shows the full description">
            <Text style={[type.body, { color: theme.text }]} numberOfLines={showDescription ? undefined : 4}>
              {description}
            </Text>
            <Text style={[type.metaStrong, { color: theme.accentInk, marginTop: 4 }]}>
              {showDescription ? "Show less" : "Show more"}
            </Text>
          </Pressable>
        )}

        <TimestampsCard
          videoId={id}
          youtubeId={video.youtubeId}
          bookmarks={video.bookmarks}
          currentTime={time.t}
          onSeek={seek}
        />

        <View onLayout={(e) => (notesY.current = e.nativeEvent.layout.y)}>
          <NotesCard videoId={id} notes={video.notes} onFocus={revealNotes} />
        </View>

        {chapters.length > 0 && (
          <View style={styles.more}>
            <SectionTitle title="Chapters" />
            {chapters.map((c) => (
              <Pressable key={c._id} style={styles.chapter} onPress={() => seek(c.seconds)} accessibilityRole="button">
                <Text style={[type.metaStrong, styles.chapterTime, { color: theme.accentInk }]}>{formatDuration(c.seconds)}</Text>
                <Text style={[type.body, { color: theme.text, flex: 1 }]}>{c.label}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {more.length > 0 && (
          <View style={styles.more}>
            <SectionTitle title={`More in ${folderName}`} />
            {more.map((v) => (
              <VideoRow key={v._id} video={v} menu={false} onPress={() => router.replace(`/video/${v._id}`)} />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Floating glass controls */}
      <View style={[styles.floating, { top: insets.top + 8 }]} pointerEvents="box-none">
        <Host matchContents colorScheme={theme.scheme}>
          <Button onPress={() => router.back()} modifiers={[frame({ width: 44, height: 44 }), glassEffect({ glass: { variant: "regular", interactive: true }, shape: "circle" })]}>
            <SwiftImage systemName="chevron.down" size={17} color={theme.text} />
          </Button>
        </Host>
        <Host matchContents colorScheme={theme.scheme}>
          <Menu
            label={<SwiftImage systemName="ellipsis" size={17} color={theme.text} />}
            modifiers={[frame({ width: 44, height: 44 }), glassEffect({ glass: { variant: "regular", interactive: true }, shape: "circle" })]}
          >
            <Button label="Open in YouTube" systemImage="arrow.up.right.square" onPress={() => void Linking.openURL(watchUrl(video.youtubeId, time.t))} />
            <Button label="Move to folder…" systemImage="folder" onPress={() => actions.move([id])} />
            <Button label="Edit tags…" systemImage="tag" onPress={() => actions.editTags([id])} />
            <Button label="Delete" systemImage="trash" role="destructive" onPress={() => void confirmTrash()} />
          </Menu>
        </Host>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: GUTTER, gap: 16 },
  titleBlock: { gap: 4 },
  folderCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: radius.card },
  folderBadge: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chapter: { flexDirection: "row", gap: 12, paddingVertical: 8, paddingHorizontal: GUTTER },
  chapterTime: { width: 64, fontVariant: ["tabular-nums"] },
  more: { marginHorizontal: -GUTTER },
  floating: { position: "absolute", left: GUTTER - 4, right: GUTTER - 4, flexDirection: "row", justifyContent: "space-between" },
});
