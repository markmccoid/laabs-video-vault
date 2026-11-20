import { Button, Host, Image as SwiftImage, Menu } from "@expo/ui/swift-ui";
import { frame } from "@expo/ui/swift-ui/modifiers";
import { highlight, snippet } from "@lvv/core";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { memo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Chip } from "@/components/ui";
import { VideoThumb } from "@/components/VideoThumb";
import type { Doc } from "@/lib/api";
import { GUTTER, type, useTheme } from "@/lib/theme";
import { useVideoActions } from "@/lib/videoActions";

export type VideoListItem = Doc<"videos"> & { thumbnail: string; tagNames: string[] };

export function openVideo(video: Pick<VideoListItem, "_id">) {
  router.push(`/video/${video._id}`);
}

export type VideoRowProps = {
  video: VideoListItem;
  /** Defaults to opening the player. */
  onPress?: () => void;
  /** In select mode: whether this video is selected. Undefined when not selecting. */
  selected?: boolean;
  /** Search text to highlight; a description-only match shows a snippet. */
  query?: string;
  /** Folder path shown after the channel (search and tag views). */
  path?: string;
  /** Adds "Select" to the … menu. */
  onStartSelect?: () => void;
  /** Hide the … menu (Trash). */
  menu?: boolean;
};

/** Highlighted runs of `query` inside `text`. */
export function Highlighted({ text, query, color }: { text: string; query?: string; color: string }) {
  const theme = useTheme();
  if (!query) return <>{text}</>;
  return (
    <>
      {highlight(text, query).map((seg, i) =>
        seg.match ? (
          <Text key={i} style={{ backgroundColor: theme.highlight, color }}>
            {seg.text}
          </Text>
        ) : (
          seg.text
        ),
      )}
    </>
  );
}

/** Shared video row: thumbnail, title, meta, tag chips, and a … menu. */
export const VideoRow = memo(function VideoRow({
  video,
  onPress,
  selected,
  query,
  path,
  onStartSelect,
  menu = true,
}: VideoRowProps) {
  const theme = useTheme();
  const pending = video.metadataState === "pending" && !video.title;
  const selecting = selected !== undefined;
  const titleMatches = !!query && video.title.toLowerCase().includes(query.trim().toLowerCase());
  const descSnippet = query && !titleMatches ? snippet(video.description, query) : null;
  const tags = video.tagNames;
  const meta = [video.channelTitle, path].filter(Boolean).join(" · ");

  // The … menu is a sibling of the pressable area: a SwiftUI menu inside an
  // RN Pressable never gets the touch.
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onPress ?? (() => openVideo(video))}
        accessibilityRole="button"
        accessibilityState={selecting ? { selected } : undefined}
        style={({ pressed }) => [styles.press, { opacity: pressed ? 0.75 : 1 }]}
      >
        {selecting && (
          <View
            style={[
              styles.check,
              selected ? { backgroundColor: theme.accent, borderColor: theme.accent } : { borderColor: theme.dashed },
            ]}
          >
            {selected && <SymbolView name="checkmark" size={12} weight="heavy" tintColor={theme.accentText} />}
          </View>
        )}
        <VideoThumb video={video} style={styles.thumb} />
        <View style={styles.info}>
          {pending ? (
            <View style={styles.pending}>
              <ActivityIndicator size="small" />
              <Text style={[type.meta, { color: theme.muted }]}>Fetching video details…</Text>
            </View>
          ) : (
            <Text style={[type.rowTitle, { color: theme.text }]} numberOfLines={2}>
              <Highlighted text={video.title || video.youtubeId} query={query} color={theme.text} />
            </Text>
          )}
          {!!meta && (
            <Text style={[type.meta, { color: theme.muted }]} numberOfLines={1}>
              {meta}
            </Text>
          )}
          {!!descSnippet && (
            <Text style={[type.meta, { color: theme.muted }]} numberOfLines={2}>
              <Highlighted text={descSnippet} query={query} color={theme.text} />
            </Text>
          )}
          {video.metadataState === "unavailable" && (
            <Text style={[type.metaStrong, { color: theme.danger }]}>Unavailable on YouTube</Text>
          )}
          {video.metadataState === "failed" && (
            <Text style={[type.metaStrong, { color: theme.danger }]}>Couldn't load details</Text>
          )}
          {tags.length > 0 && (
            <View style={styles.tags}>
              {tags.slice(0, 3).map((t) => (
                <Chip key={t} label={t} />
              ))}
              {tags.length > 3 && <Chip label={`+${tags.length - 3}`} />}
            </View>
          )}
        </View>
      </Pressable>
      {menu && !selecting && <VideoMenu video={video} onStartSelect={onStartSelect} />}
    </View>
  );
});

/** The row's … button: a native SwiftUI menu. */
function VideoMenu({ video, onStartSelect }: { video: VideoListItem; onStartSelect?: () => void }) {
  const theme = useTheme();
  const actions = useVideoActions();
  const ids = [video._id];
  return (
    <Host matchContents colorScheme={theme.scheme} style={styles.menuHost}>
      <Menu
        label={<SwiftImage systemName="ellipsis" size={17} color={theme.muted} />}
        modifiers={[frame({ width: 34, height: 44 })]}
      >
        <Button label="Play" systemImage="play.fill" onPress={() => actions.play(video._id)} />
        <Button label="Move to folder…" systemImage="folder" onPress={() => actions.move(ids)} />
        <Button label="Edit tags…" systemImage="tag" onPress={() => actions.editTags(ids)} />
        {onStartSelect && <Button label="Select" systemImage="checkmark.circle" onPress={onStartSelect} />}
        <Button label="Delete" systemImage="trash" role="destructive" onPress={() => void actions.trash(ids)} />
      </Menu>
    </Host>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: GUTTER, paddingVertical: 8 },
  press: { flex: 1, flexDirection: "row", alignItems: "flex-start", gap: 12 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  thumb: { width: 128, height: 72 },
  info: { flex: 1, gap: 4, paddingTop: 2 },
  pending: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 40 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 2 },
  menuHost: { marginRight: -8, marginTop: -6, marginLeft: 4 },
});
