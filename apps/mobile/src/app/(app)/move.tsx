import { buildFolderTree, canMoveFolder, flattenFolderTree } from "@lvv/core";
import { useMutation, useQuery } from "convex/react";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, ScrollView, StyleSheet, Text } from "react-native";
import { NavRow, RowGroup } from "@/components/NavRow";
import { api, type Id } from "@/lib/api";
import { attempt } from "@/lib/prompt";
import { decodeIds } from "@/lib/selection";
import { useTheme } from "@/lib/theme";

/**
 * Pick a destination. Moves either videos (`videoIds`, comma-separated) or
 * one folder (`folderId`); folder moves grey out destinations that would
 * create a cycle or nest too deep.
 */
export default function MoveSheet() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ videoIds?: string; folderId?: Id<"folders"> }>();
  const videoIds = decodeIds<Id<"videos">>(params.videoIds);
  const movingFolderId = params.folderId;
  const folders = useQuery(api.folders.list);
  const moveVideos = useMutation(api.videos.move);
  const moveFolder = useMutation(api.folders.move);

  if (!folders) return <ActivityIndicator style={{ marginTop: 40 }} />;

  const movingFolder = folders.find((f) => f._id === movingFolderId);
  const rows = flattenFolderTree(buildFolderTree(folders));

  const choose = async (target: Id<"folders"> | undefined) => {
    const ok = movingFolderId
      ? await attempt("Couldn't move folder", () => moveFolder({ folderId: movingFolderId, parentId: target }))
      : await attempt("Couldn't move videos", () => moveVideos({ videoIds, folderId: target }));
    if (ok) router.back();
  };

  const subtitle = movingFolder
    ? `Move "${movingFolder.name}" into…`
    : `Move ${videoIds.length} ${videoIds.length === 1 ? "video" : "videos"} to…`;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: movingFolder ? "Move Folder" : "Move to" }} />
      <Text style={[styles.subtitle, { color: theme.muted }]}>{subtitle}</Text>
      <RowGroup>
        <NavRow
          icon={movingFolder ? "square.stack.3d.up" : "tray"}
          label={movingFolder ? "Top level" : "Inbox"}
          chevron={false}
          checked={movingFolder ? movingFolder.parentId === undefined : undefined}
          onPress={() => void choose(undefined)}
        />
        {rows.map((folder) => {
          const blocked = movingFolderId ? !canMoveFolder(folders, movingFolderId, folder._id).ok : false;
          return (
            <NavRow
              key={folder._id}
              icon="folder"
              label={folder.name}
              indent={folder.depth}
              chevron={false}
              disabled={blocked}
              checked={movingFolder ? movingFolder.parentId === folder._id : undefined}
              onPress={() => void choose(folder._id)}
            />
          );
        })}
      </RowGroup>
      {rows.length === 0 && (
        <Text style={[styles.subtitle, { color: theme.muted }]}>Create folders from the Library to organize videos.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: 16, gap: 12 },
  subtitle: { marginHorizontal: 20, fontSize: 14 },
});
