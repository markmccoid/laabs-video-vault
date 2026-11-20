import { canCreateFolderUnder, flattenFolderTree, MAX_FOLDER_DEPTH } from "@lvv/core";
import { useMutation } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Chip, DepthDots, GroupLabel, SheetHeader } from "@/components/ui";
import { api, type Id } from "@/lib/api";
import { useFolders } from "@/lib/folders";
import { attempt } from "@/lib/prompt";
import { fonts, GUTTER, radius, type, useTheme } from "@/lib/theme";

/** New folder (2d). Default parent = the folder you came from (`parentId`). */
export default function NewFolderSheet() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ parentId?: Id<"folders"> }>();
  const data = useFolders();
  const create = useMutation(api.folders.create);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<Id<"folders"> | undefined>(params.parentId);

  const parent = parentId ? data.byId.get(parentId) : undefined;
  const level = (parent ? parent.depth + 1 : 0) + 1;
  const parents = flattenFolderTree(data.tree).filter((f) => canCreateFolderUnder(f).ok);
  const ready = name.trim().length > 0 && canCreateFolderUnder(parent).ok;

  const submit = async () => {
    if (!ready) return;
    const ok = await attempt("Couldn't create folder", () => create({ name: name.trim(), parentId }));
    if (ok) router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <SheetHeader
        title={params.parentId ? "New subfolder" : "New folder"}
        onClose={() => router.back()}
        action={{ label: "Create", onPress: () => void submit(), disabled: !ready }}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TextInput
          autoFocus
          value={name}
          onChangeText={setName}
          onSubmitEditing={() => void submit()}
          returnKeyType="done"
          placeholder="Folder name"
          placeholderTextColor={theme.muted}
          accessibilityLabel="Folder name"
          style={[styles.name, { borderColor: theme.accentRing, color: theme.text, backgroundColor: theme.bg }]}
        />
        <View style={styles.insideRow}>
          <GroupLabel>Inside</GroupLabel>
          <View style={styles.level}>
            <DepthDots level={level} />
            <Text style={[type.metaStrong, { color: theme.muted }]}>
              Level {level} of {MAX_FOLDER_DEPTH}
            </Text>
          </View>
        </View>
        <View style={styles.parents}>
          <Chip label="Library" icon="books.vertical.fill" size="md" variant={!parentId ? "accent" : "surface"} onPress={() => setParentId(undefined)} />
          {parents.map((f) => (
            <Chip
              key={f._id}
              label={data.pathFor(f._id)}
              icon="folder.fill"
              size="md"
              variant={parentId === f._id ? "accent" : "surface"}
              onPress={() => setParentId(f._id)}
            />
          ))}
        </View>
        <Text style={[type.meta, styles.foot, { color: theme.muted }]}>Folders nest up to three levels deep.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 16, paddingBottom: 40 },
  name: {
    marginHorizontal: GUTTER,
    height: 58,
    borderRadius: radius.pill,
    borderWidth: 2,
    paddingHorizontal: 22,
    fontFamily: fonts.display,
    fontSize: 20,
  },
  insideRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingRight: GUTTER },
  level: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 },
  parents: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: GUTTER },
  foot: { paddingHorizontal: GUTTER, marginTop: 18 },
});
