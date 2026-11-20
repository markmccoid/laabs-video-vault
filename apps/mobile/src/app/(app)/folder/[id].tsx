import { canCreateFolderUnder, MAX_FOLDER_DEPTH } from "@lvv/core";
import { useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { FolderList } from "@/components/FolderViews";
import { DashedRow, DepthDots, InfoPill, plural, ScreenTitle, SectionTitle } from "@/components/ui";
import { VideoListScreen } from "@/components/VideoListScreen";
import { api, type Id } from "@/lib/api";
import { useFolderActions } from "@/lib/folderActions";
import { useFolders } from "@/lib/folders";
import { GUTTER, radius, type, useTheme } from "@/lib/theme";

/** Folder detail (2a): breadcrumb, depth, subfolders, videos. */
export default function FolderScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: Id<"folders"> }>();
  const data = useFolders();
  const videos = useQuery(api.videos.listByFolder, { folderId: id });
  const actions = useFolderActions();

  const folder = data.byId.get(id);
  const node = findNode(data.tree, id);
  const children = node?.children ?? [];

  // Deleted here or on another device.
  useEffect(() => {
    if (data.folders && !folder && router.canGoBack()) router.back();
  }, [data.folders, folder]);

  // Ancestors, top first.
  const crumbs: { id: Id<"folders">; name: string }[] = [];
  for (let cur = folder?.parentId; cur; cur = data.byId.get(cur)?.parentId) {
    const f = data.byId.get(cur);
    if (!f) break;
    crumbs.unshift({ id: f._id, name: f.name });
  }

  const level = (folder?.depth ?? 0) + 1;
  const canNest = folder ? canCreateFolderUnder(folder).ok : false;
  const newSubfolder = () => router.push({ pathname: "/new-folder", params: { parentId: id } });

  const header = folder ? (
    <View>
      <View style={styles.crumbs}>
        <Crumb label="Library" onPress={() => router.dismissTo("/")} />
        {crumbs.map((c) => (
          <Crumb key={c.id} label={c.name} onPress={() => router.dismissTo(`/folder/${c.id}`)} />
        ))}
      </View>
      <ScreenTitle title={folder.name}>
        <View style={styles.depth}>
          <DepthDots level={level} />
          <Text style={[type.metaStrong, { color: theme.muted }]}>
            Level {level} of {MAX_FOLDER_DEPTH} · {plural(data.count(id), "video")}
          </Text>
        </View>
      </ScreenTitle>
      {children.length > 0 && <FolderList data={data} nodes={children} />}
      <View style={styles.after}>
        {canNest ? (
          <DashedRow icon="folder.badge.plus" label="New subfolder" onPress={newSubfolder} />
        ) : (
          <InfoPill>Deepest level — this folder holds videos only.</InfoPill>
        )}
      </View>
      <SectionTitle title="Videos" detail={videos ? plural(videos.length, "video") : undefined} />
    </View>
  ) : undefined;

  return (
    <VideoListScreen
      title=""
      videos={videos}
      header={header}
      emptyTitle="No videos here yet"
      emptyBody="Add one from the … menu, or move videos here from the Inbox."
      menuItems={
        folder
          ? [
              { label: "Add video", icon: "link", onPress: () => router.push({ pathname: "/add", params: { folderId: id } }) },
              { label: "New subfolder", icon: "folder.badge.plus", onPress: newSubfolder, hidden: !canNest },
              { label: "Rename folder", icon: "pencil", onPress: () => void actions.rename(folder) },
              { label: "Move folder", icon: "folder", onPress: () => actions.move(folder) },
              { label: "Delete folder", icon: "trash", destructive: true, onPress: () => void actions.remove(folder) },
            ]
          : []
      }
    />
  );
}

function findNode<T extends { _id: string; children: T[] }>(nodes: T[], id: string): T | undefined {
  for (const n of nodes) {
    if (n._id === id) return n;
    const hit = findNode(n.children, id);
    if (hit) return hit;
  }
  return undefined;
}

function Crumb({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      style={({ pressed }) => [styles.crumb, { backgroundColor: theme.sageSoft, opacity: pressed ? 0.6 : 1 }]}
    >
      <Text style={[styles.crumbText, { color: theme.sageInk }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  crumbs: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: GUTTER, paddingTop: 4 },
  crumb: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  crumbText: { ...type.metaStrong, fontSize: 13, fontFamily: type.rowTitle.fontFamily },
  depth: { flexDirection: "row", alignItems: "center", gap: 8 },
  after: { paddingHorizontal: GUTTER, marginTop: 12 },
});
