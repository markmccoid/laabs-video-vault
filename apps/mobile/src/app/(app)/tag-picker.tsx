import { checkTagName, tagKey } from "@lvv/core";
import { useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Chip, GroupLabel, SheetHeader } from "@/components/ui";
import { api, type Id } from "@/lib/api";
import { attempt } from "@/lib/prompt";
import { decodeIds } from "@/lib/selection";
import { fonts, GUTTER, radius, type, useTheme } from "@/lib/theme";

/**
 * Tags sheet (2e). Changes apply as you tap. With several videos, the
 * current tags are the ones all of them share; adding a tag adds it to all.
 */
export default function TagPicker() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ videoIds?: string }>();
  const videoIds = decodeIds<Id<"videos">>(params.videoIds);
  const tags = useQuery(api.tags.list);
  const current = useQuery(api.videos.tagsForVideos, { videoIds });
  const single = useQuery(api.videos.get, videoIds.length === 1 ? { videoId: videoIds[0]! } : "skip");
  const apply = useMutation(api.tags.applyToVideos);
  const createTag = useMutation(api.tags.create);
  const [draft, setDraft] = useState("");

  const subtitle = videoIds.length === 1 ? (single ? `“${single.title || "Video"}”` : undefined) : `${videoIds.length} videos`;
  const header = <SheetHeader title="Tags" subtitle={subtitle} onClose={() => router.back()} action={{ label: "Done", onPress: () => router.back() }} />;

  if (!tags || !current) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        {header}
        <ActivityIndicator style={{ marginTop: 40 }} />
      </View>
    );
  }

  const shared = tags.filter((t) => current.length > 0 && current.every((ids) => ids.includes(t._id)));
  const sharedIds = new Set(shared.map((t) => t._id));
  const check = checkTagName(draft);
  const q = tagKey(check.ok ? check.name : draft.trim());
  const suggestions = tags.filter((t) => !sharedIds.has(t._id) && (!q || t.nameLower.includes(q)));
  const exact = tags.find((t) => t.nameLower === q);
  const canCreate = !!q && !exact && check.ok;

  const add = (tagId: Id<"tags">) => {
    setDraft("");
    void attempt("Couldn't add tag", () => apply({ videoIds, add: [tagId], remove: [] }));
  };
  const remove = (tagId: Id<"tags">) =>
    void attempt("Couldn't remove tag", () => apply({ videoIds, add: [], remove: [tagId] }));

  const submit = async () => {
    if (exact) {
      if (!sharedIds.has(exact._id)) add(exact._id);
      else setDraft("");
      return;
    }
    if (!check.ok) return;
    const ok = await attempt("Couldn't create tag", async () => {
      const tagId = await createTag({ name: check.name.toLowerCase() });
      await apply({ videoIds, add: [tagId], remove: [] });
    });
    if (ok) setDraft("");
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {header}
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {shared.length > 0 ? (
          <View style={styles.wrap}>
            {shared.map((t) => (
              <Chip key={t._id} label={t.name} variant="sage" size="md" onRemove={t.system ? undefined : () => remove(t._id)} />
            ))}
          </View>
        ) : (
          <Text style={[type.body, { color: theme.muted, paddingHorizontal: GUTTER }]}>
            {videoIds.length === 1 ? "No tags yet." : "These videos share no tags yet."}
          </Text>
        )}

        <View style={[styles.field, { backgroundColor: theme.surface }]}>
          <SymbolView name="magnifyingglass" size={16} tintColor={theme.muted} />
          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder="Find or create a tag"
            placeholderTextColor={theme.muted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            submitBehavior="submit"
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => void submit()}
          />
        </View>

        {canCreate && (
          <View style={styles.wrap}>
            <Chip label={`Create “${q}”`} icon="plus" variant="accent" size="md" onPress={() => void submit()} />
          </View>
        )}
        {draft.trim() !== "" && !check.ok && !exact && (
          <Text style={[type.meta, { color: theme.danger, paddingHorizontal: GUTTER }]}>{check.reason}</Text>
        )}

        {suggestions.length > 0 && (
          <>
            <GroupLabel>{q ? "Matching tags" : "Your tags"}</GroupLabel>
            <View style={styles.wrap}>
              {suggestions.map((t) => (
                <Chip key={t._id} label={t.name} icon="plus" size="md" onPress={() => add(t._id)} />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, paddingBottom: 40, gap: 14 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: GUTTER },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: GUTTER,
    paddingHorizontal: 16,
    minHeight: 50,
    borderRadius: radius.pill,
  },
  input: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, paddingVertical: 12 },
});
