import { useMutation } from "convex/react";
import { router, Stack } from "expo-router";
import type { ComponentProps, ReactElement } from "react";
import { VideoBrowser } from "@/components/VideoBrowser";
import type { VideoListItem } from "@/components/VideoRow";
import { api, type Id } from "@/lib/api";
import { attempt, confirmDestructive } from "@/lib/prompt";
import { encodeIds, useSelection } from "@/lib/selection";
import { useViewMode } from "@/lib/viewMode";

export type MenuItem = {
  label: string;
  /** SF Symbol name. */
  icon: ComponentProps<typeof Stack.Toolbar.MenuAction>["icon"];
  onPress: () => void;
  destructive?: boolean;
  hidden?: boolean;
};

type Props = {
  title: string;
  videos: VideoListItem[] | undefined;
  /** "trash" swaps the select actions for Restore / Delete and tap opens an action sheet. */
  mode?: "library" | "trash";
  header?: ReactElement;
  emptyTitle: string;
  emptyBody?: string;
  /** Extra items for the header ⋯ menu (after List/Grid and Select). */
  menuItems?: MenuItem[];
  onPressVideo?: (video: VideoListItem) => void;
  largeTitle?: boolean;
};

/**
 * A screen of videos: header ⋯ menu (List/Grid, Select, extras), and in
 * select mode a bottom toolbar acting on the selection.
 */
export function VideoListScreen({
  title,
  videos,
  mode = "library",
  header,
  emptyTitle,
  emptyBody,
  menuItems = [],
  onPressVideo,
  largeTitle = false,
}: Props) {
  const [viewMode, setViewMode] = useViewMode();
  const selection = useSelection();
  const trashMany = useMutation(api.videos.trashMany);
  const restoreMany = useMutation(api.videos.restoreMany);
  const deleteForever = useMutation(api.videos.deleteForever);

  const { selecting, ids } = selection;
  const none = ids.length === 0;
  const allIds = (videos ?? []).map((v) => v._id);
  const allSelected = !none && ids.length === allIds.length;

  const openPicker = (pathname: "/move" | "/tag-picker") => {
    router.push({ pathname, params: { videoIds: encodeIds(ids) } });
    selection.finish();
  };

  const trashSelected = async () => {
    if (await attempt("Couldn't move to Trash", () => trashMany({ videoIds: ids as Id<"videos">[] }))) {
      selection.finish();
    }
  };

  const restoreSelected = async () => {
    if (await attempt("Couldn't restore", () => restoreMany({ videoIds: ids as Id<"videos">[] }))) {
      selection.finish();
    }
  };

  const deleteSelected = async () => {
    const n = ids.length;
    const ok = await confirmDestructive(
      `Delete ${n} ${n === 1 ? "video" : "videos"} forever?`,
      "This can't be undone.",
      "Delete",
    );
    if (ok && (await attempt("Couldn't delete", () => deleteForever({ videoIds: ids as Id<"videos">[] })))) {
      selection.finish();
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: selecting ? (none ? "Select Videos" : `${ids.length} Selected`) : title,
          headerLargeTitle: largeTitle && !selecting,
        }}
      />

      {selecting ? (
        <>
          <Stack.Toolbar placement="left">
            <Stack.Toolbar.Button onPress={() => selection.selectAll(allSelected ? [] : allIds)}>
              {allSelected ? "Deselect All" : "Select All"}
            </Stack.Toolbar.Button>
          </Stack.Toolbar>
          <Stack.Toolbar placement="right">
            <Stack.Toolbar.Button onPress={selection.finish}>Done</Stack.Toolbar.Button>
          </Stack.Toolbar>
          {mode === "library" ? (
            <Stack.Toolbar>
              <Stack.Toolbar.Button icon="folder" disabled={none} onPress={() => openPicker("/move")}>
                Move
              </Stack.Toolbar.Button>
              <Stack.Toolbar.Spacer />
              <Stack.Toolbar.Button icon="tag" disabled={none} onPress={() => openPicker("/tag-picker")}>
                Tag
              </Stack.Toolbar.Button>
              <Stack.Toolbar.Spacer />
              <Stack.Toolbar.Button icon="trash" disabled={none} onPress={trashSelected}>
                Trash
              </Stack.Toolbar.Button>
            </Stack.Toolbar>
          ) : (
            <Stack.Toolbar>
              <Stack.Toolbar.Button icon="arrow.uturn.backward" disabled={none} onPress={restoreSelected}>
                Restore
              </Stack.Toolbar.Button>
              <Stack.Toolbar.Spacer />
              <Stack.Toolbar.Button icon="trash.slash" disabled={none} onPress={deleteSelected}>
                Delete
              </Stack.Toolbar.Button>
            </Stack.Toolbar>
          )}
        </>
      ) : (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Menu icon="ellipsis.circle">
            <Stack.Toolbar.MenuAction icon="checkmark.circle" disabled={allIds.length === 0} onPress={selection.start}>
              Select
            </Stack.Toolbar.MenuAction>
            <Stack.Toolbar.MenuAction icon="list.bullet" isOn={viewMode === "list"} onPress={() => setViewMode("list")}>
              List
            </Stack.Toolbar.MenuAction>
            <Stack.Toolbar.MenuAction
              icon="square.grid.2x2"
              isOn={viewMode === "grid"}
              onPress={() => setViewMode("grid")}
            >
              Grid
            </Stack.Toolbar.MenuAction>
            {menuItems
              .filter((item) => !item.hidden)
              .map((item) => (
                <Stack.Toolbar.MenuAction
                  key={item.label}
                  icon={item.icon}
                  destructive={item.destructive}
                  onPress={item.onPress}
                >
                  {item.label}
                </Stack.Toolbar.MenuAction>
              ))}
          </Stack.Toolbar.Menu>
        </Stack.Toolbar>
      )}

      <VideoBrowser
        videos={videos}
        viewMode={viewMode}
        selection={selection}
        onPressVideo={onPressVideo}
        header={selecting ? undefined : header}
        emptyTitle={emptyTitle}
        emptyBody={emptyBody}
      />
    </>
  );
}
