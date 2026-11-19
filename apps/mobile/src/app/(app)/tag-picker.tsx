import { checkTagName } from "@lvv/core";
import { useMutation, useQuery } from "convex/react";
import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { NavRow, RowGroup } from "@/components/NavRow";
import { api, type Id } from "@/lib/api";
import { attempt } from "@/lib/prompt";
import { decodeIds } from "@/lib/selection";
import { useTheme } from "@/lib/theme";

/**
 * Add or remove tags on the videos in `videoIds`. Changes apply as you tap.
 * With several videos, a check means every one has the tag; tapping a tag
 * some of them have adds it to the rest.
 */
export default function TagPicker() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ videoIds?: string }>();
  const videoIds = decodeIds<Id<"videos">>(params.videoIds);
  const tags = useQuery(api.tags.list);
  const current = useQuery(api.videos.tagsForVideos, { videoIds });
  const apply = useMutation(api.tags.applyToVideos);
  const createTag = useMutation(api.tags.create);
  const [draft, setDraft] = useState("");

  if (!tags || !current) return <ActivityIndicator style={{ marginTop: 40 }} />;

  const countFor = (tagId: Id<"tags">) => current.filter((ids) => ids.includes(tagId)).length;

  const toggle = (tagId: Id<"tags">) => {
    const all = countFor(tagId) === videoIds.length;
    void attempt("Couldn't update tags", () =>
      apply({ videoIds, add: all ? [] : [tagId], remove: all ? [tagId] : [] }),
    );
  };

  const draftCheck = checkTagName(draft);
  const addDraft = async () => {
    if (!draftCheck.ok) return;
    const ok = await attempt("Couldn't add tag", async () => {
      const tagId = await createTag({ name: draftCheck.name });
      await apply({ videoIds, add: [tagId], remove: [] });
    });
    if (ok) setDraft("");
  };

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: videoIds.length === 1 ? "Tags" : `Tags for ${videoIds.length} Videos` }} />
      <View style={[styles.newTag, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <TextInput
          style={[styles.input, { color: theme.text }]}
          placeholder="New tag"
          placeholderTextColor={theme.muted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={addDraft}
        />
        <Pressable
          onPress={addDraft}
          disabled={!draftCheck.ok}
          style={[styles.add, { backgroundColor: draftCheck.ok ? theme.accent : theme.border }]}
        >
          <Text style={{ color: theme.accentText, fontWeight: "700" }}>Add</Text>
        </Pressable>
      </View>
      {tags.length > 0 && (
        <RowGroup>
          {tags.map((tag) => {
            const n = countFor(tag._id);
            const some = n > 0 && n < videoIds.length;
            return (
              <NavRow
                key={tag._id}
                icon="number"
                label={tag.name}
                detail={some ? `${n} of ${videoIds.length}` : undefined}
                checked={n === videoIds.length && n > 0}
                chevron={false}
                onPress={() => toggle(tag._id)}
              />
            );
          })}
        </RowGroup>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: 16, gap: 16 },
  newTag: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingLeft: 14,
    paddingRight: 6,
    marginHorizontal: 16,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 12 },
  add: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 },
});
