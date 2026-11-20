import { checkTagName, parseYouTubeUrl, tagKey } from "@lvv/core";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ClipboardPasteButton } from "expo-clipboard";
import { router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { FolderPicker, type PickerValue } from "@/components/FolderPicker";
import { Chip, GroupLabel, SheetHeader, SheetScroll } from "@/components/ui";
import { VideoThumb } from "@/components/VideoThumb";
import { api, type Id } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { useFolders } from "@/lib/folders";
import { fonts, GUTTER, radius, type, useTheme } from "@/lib/theme";

type VideoPreview = FunctionReturnType<typeof api.youtube.preview>;
type Preview = VideoPreview | { status: "loading" } | null;

/** Add video (2g): link → preview → folder → tags → Save. */
export default function AddVideoSheet() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ folderId?: Id<"folders"> }>();
  const data = useFolders();
  const allTags = useQuery(api.tags.list);
  const fetchPreview = useAction(api.youtube.preview);
  const addVideo = useMutation(api.videos.add);
  const createTag = useMutation(api.tags.create);
  const applyTags = useMutation(api.tags.applyToVideos);

  const [link, setLink] = useState("");
  const [preview, setPreview] = useState<Preview>(null);
  const [folder, setFolder] = useState<PickerValue>(params.folderId ?? "root");
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const parsed = parseYouTubeUrl(link);
  const videoKey = parsed?.videoId;

  // Look the video up whenever the link points at a different video.
  useEffect(() => {
    if (!videoKey) {
      setPreview(null);
      return;
    }
    let live = true;
    setPreview({ status: "loading" });
    fetchPreview({ input: videoKey })
      .then((p) => live && setPreview(p))
      .catch(() => live && setPreview({ status: "failed" }));
    return () => {
      live = false;
    };
  }, [videoKey, fetchPreview]);

  const addTag = (raw: string) => {
    const check = checkTagName(raw);
    if (!check.ok) return;
    const name = check.name.toLowerCase();
    setTags((prev) => (prev.some((t) => tagKey(t) === name) ? prev : [...prev, name]));
    setTagDraft("");
  };

  const save = async () => {
    if (preview?.status !== "ok") return;
    setSaving(true);
    try {
      const result = await addVideo({ input: link, folderId: folder === "root" ? undefined : folder });
      if (tags.length > 0) {
        const byName = new Map((allTags ?? []).map((t) => [t.nameLower, t._id]));
        const ids: Id<"tags">[] = [];
        for (const name of tags) ids.push(byName.get(tagKey(name)) ?? (await createTag({ name })));
        await applyTags({ videoIds: [result.videoId], add: ids, remove: [] });
      }
      router.back();
      if (result.status === "duplicate") {
        Alert.alert(
          "Already saved",
          "This video was already in your library. Its tags were updated; its folder wasn't changed.",
        );
      }
    } catch (err) {
      Alert.alert("Couldn't add video", errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const suggestions = (allTags ?? [])
    .filter((t) => !tags.includes(t.nameLower) && (!tagDraft || t.nameLower.includes(tagKey(tagDraft.trim()))))
    .slice(0, 12);

  return (
    <SheetScroll
      header={
        <SheetHeader
          title="Add video"
          onClose={() => router.back()}
          action={{
            label: saving ? "Saving…" : "Save",
            onPress: () => void save(),
            disabled: preview?.status !== "ok" || saving,
          }}
        />
      }
      contentStyle={styles.content}
    >
      <View style={[styles.linkField, { backgroundColor: theme.surface }]}>
        <SymbolView name="link" size={16} tintColor={theme.muted} />
        <TextInput
          autoFocus
          value={link}
          onChangeText={setLink}
          placeholder="YouTube link"
          placeholderTextColor={theme.muted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="done"
          style={[styles.input, { color: theme.text }]}
        />
        <ClipboardPasteButton
          onPress={(e) => e.type === "text" && setLink(e.text)}
          acceptedContentTypes={["plain-text", "url"]}
          displayMode="iconAndLabel"
          cornerStyle="capsule"
          backgroundColor={theme.accent}
          foregroundColor={theme.accentText}
          style={styles.paste}
        />
      </View>
      {!!link.trim() && !parsed && (
        <Text style={[type.meta, { color: theme.danger, paddingHorizontal: GUTTER + 4 }]}>
          That isn't a YouTube link.
        </Text>
      )}

      <PreviewCard preview={preview} />

      <GroupLabel>Save to</GroupLabel>
      {data.folders && <FolderPicker data={data} value={folder} onChange={setFolder} />}

      <GroupLabel>Tags</GroupLabel>
      <View style={styles.wrap}>
        {tags.map((t) => (
          <Chip key={t} label={t} variant="sage" size="md" onRemove={() => setTags(tags.filter((x) => x !== t))} />
        ))}
      </View>
      <View style={[styles.linkField, { backgroundColor: theme.surface, marginTop: tags.length ? 10 : 0 }]}>
        <SymbolView name="tag" size={16} tintColor={theme.muted} />
        <TextInput
          value={tagDraft}
          onChangeText={setTagDraft}
          onSubmitEditing={() => addTag(tagDraft)}
          submitBehavior="submit"
          placeholder="Find or create a tag"
          placeholderTextColor={theme.muted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          style={[styles.input, { color: theme.text }]}
        />
      </View>
      <View style={[styles.wrap, { marginTop: 10 }]}>
        {!!tagDraft.trim() && !(allTags ?? []).some((t) => t.nameLower === tagKey(tagDraft.trim())) && (
          <Chip
            label={`Create “${tagKey(tagDraft.trim())}”`}
            icon="plus"
            variant="accent"
            size="md"
            onPress={() => addTag(tagDraft)}
          />
        )}
        {suggestions.map((t) => (
          <Chip key={t._id} label={t.name} icon="plus" size="md" onPress={() => addTag(t.name)} />
        ))}
      </View>
    </SheetScroll>
  );
}

function PreviewCard({ preview }: { preview: Preview }) {
  const theme = useTheme();
  if (!preview || preview.status === "invalid") return null;
  if (preview.status === "loading") {
    return (
      <View style={[styles.preview, { backgroundColor: theme.surface }]}>
        <ActivityIndicator />
        <Text style={[type.body, { color: theme.muted }]}>Fetching video details…</Text>
      </View>
    );
  }
  if (preview.status !== "ok") {
    return (
      <View style={[styles.preview, { backgroundColor: theme.surface }]}>
        <SymbolView name="exclamationmark.triangle" size={18} tintColor={theme.danger} />
        <Text style={[type.body, { color: theme.text, flex: 1 }]}>
          {preview.status === "unavailable"
            ? "This video is private, deleted, or unavailable."
            : "Couldn't fetch the details. Check your connection."}
        </Text>
      </View>
    );
  }
  return (
    <View style={[styles.preview, { backgroundColor: theme.surface }]}>
      <VideoThumb
        video={{
          thumbnail: preview.thumbUrl ?? `https://i.ytimg.com/vi/${preview.youtubeId}/hqdefault.jpg`,
          durationSec: preview.durationSec,
          isShort: false,
        }}
        style={{ width: 120 }}
        playDisc={false}
      />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={[type.rowTitle, { color: theme.text }]} numberOfLines={3}>
          {preview.title}
        </Text>
        <Text style={[type.meta, { color: theme.muted }]}>{preview.channelTitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, paddingBottom: 60, gap: 10 },
  linkField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: GUTTER,
    paddingLeft: 16,
    paddingRight: 6,
    minHeight: 52,
    borderRadius: radius.pill,
  },
  input: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, paddingVertical: 12 },
  paste: { width: 96, height: 38 },
  preview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: GUTTER,
    padding: 12,
    borderRadius: radius.card,
    minHeight: 64,
  },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: GUTTER },
});
