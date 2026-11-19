import { canCreateFolderUnder, folderPath } from "@lvv/core";
import { useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AddVideoBar } from "@/components/AddVideoBar";
import { NavRow, RowGroup } from "@/components/NavRow";
import { VideoListScreen } from "@/components/VideoListScreen";
import { api, type Id } from "@/lib/api";
import { useFolderActions } from "@/lib/folderActions";
import { useTheme } from "@/lib/theme";

export default function FolderScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: Id<"folders"> }>();
  const folders = useQuery(api.folders.list);
  const videos = useQuery(api.videos.listByFolder, { folderId: id });
  const actions = useFolderActions();

  const folder = folders?.find((f) => f._id === id);
  const children = (folders ?? [])
    .filter((f) => f.parentId === id)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  const path = folders && folder ? folderPath(folders, folder._id).slice(0, -1) : [];

  // Deleted here or on another device.
  useEffect(() => {
    if (folders && !folder && router.canGoBack()) router.back();
  }, [folders, folder]);

  const header = (
    <View>
      {path.length > 0 && <Text style={[styles.path, { color: theme.muted }]}>{path.join(" › ")}</Text>}
      <AddVideoBar folderId={id} />
      {children.length > 0 && (
        <View style={styles.children}>
          <RowGroup>
            {children.map((child) => (
              <NavRow
                key={child._id}
                icon="folder"
                label={child.name}
                onPress={() => router.push(`/folder/${child._id}`)}
              />
            ))}
          </RowGroup>
        </View>
      )}
    </View>
  );

  return (
    <VideoListScreen
      title={folder?.name ?? ""}
      videos={videos}
      header={header}
      emptyTitle="No videos here yet"
      emptyBody="Paste a link above, or move videos here from the Inbox."
      menuItems={
        folder
          ? [
              {
                label: "New Subfolder",
                icon: "folder.badge.plus",
                onPress: () => void actions.newFolder(folder._id),
                hidden: !canCreateFolderUnder(folder).ok,
              },
              { label: "Rename Folder", icon: "pencil", onPress: () => void actions.rename(folder) },
              { label: "Move Folder", icon: "folder", onPress: () => actions.move(folder) },
              {
                label: "Delete Folder",
                icon: "trash",
                destructive: true,
                onPress: () => void actions.remove(folder),
              },
            ]
          : []
      }
    />
  );
}

const styles = StyleSheet.create({
  path: { marginHorizontal: 20, marginTop: 4, fontSize: 13 },
  children: { marginBottom: 12 },
});
