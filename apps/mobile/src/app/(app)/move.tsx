import { canMoveFolder } from "@lvv/core";
import { useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { FolderPicker, type PickerValue } from "@/components/FolderPicker";
import { SheetHeader } from "@/components/ui";
import { api, type Id } from "@/lib/api";
import { useFolders } from "@/lib/folders";
import { attempt } from "@/lib/prompt";
import { decodeIds } from "@/lib/selection";
import { useTheme } from "@/lib/theme";

/**
 * Move to folder (2c). Moves either videos (`videoIds`, comma-separated) or
 * one folder (`folderId`); folder moves grey out destinations that would
 * create a cycle or nest too deep.
 */
export default function MoveSheet() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ videoIds?: string; folderId?: Id<"folders"> }>();
  const videoIds = decodeIds<Id<"videos">>(params.videoIds);
  const movingFolderId = params.folderId;
  const data = useFolders();
  const single = useQuery(api.videos.get, videoIds.length === 1 ? { videoId: videoIds[0]! } : "skip");
  const moveVideos = useMutation(api.videos.move);
  const moveFolder = useMutation(api.folders.move);
  const [picked, setPicked] = useState<PickerValue | null>(null);

  const folders = data.folders;
  if (!folders) return <ActivityIndicator style={{ marginTop: 40 }} />;

  const movingFolder = movingFolderId ? data.byId.get(movingFolderId) : undefined;
  const current: PickerValue | undefined = movingFolder
    ? (movingFolder.parentId ?? "root")
    : single
      ? (single.folderId ?? "root")
      : undefined;

  const subtitle = movingFolder
    ? `“${movingFolder.name}” · now in ${movingFolder.parentId ? data.pathFor(movingFolder.parentId) : "Library"}`
    : single
      ? `“${single.title || "Video"}” · now in ${data.pathFor(single.folderId)}`
      : `${videoIds.length} videos`;

  const canMove = picked !== null && picked !== current;

  const move = async () => {
    if (picked === null) return;
    const target = picked === "root" ? undefined : picked;
    const ok = movingFolderId
      ? await attempt("Couldn't move folder", () => moveFolder({ folderId: movingFolderId, parentId: target }))
      : await attempt("Couldn't move videos", () => moveVideos({ videoIds, folderId: target }));
    if (ok) router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <SheetHeader
        title={movingFolder ? "Move folder" : "Move to folder"}
        subtitle={subtitle}
        onClose={() => router.back()}
        action={{ label: "Move", onPress: () => void move(), disabled: !canMove }}
      />
      <ScrollView contentContainerStyle={{ paddingTop: 8, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <FolderPicker
          data={data}
          value={picked}
          onChange={setPicked}
          current={current}
          rootLabel={movingFolder ? "Top level" : "Inbox"}
          rootIcon={movingFolder ? "square.stack.3d.up" : "tray"}
          isDisabled={movingFolderId ? (id) => !canMoveFolder(folders, movingFolderId, id).ok : undefined}
          allowCreate={!movingFolder}
        />
      </ScrollView>
    </View>
  );
}
