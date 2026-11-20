import { useMutation } from "convex/react";
import { router, Stack } from "expo-router";
import type { ComponentProps, ReactElement } from "react";
import { VideoBrowser } from "@/components/VideoBrowser";
import type { VideoListItem } from "@/components/VideoRow";
import { api, type Id } from "@/lib/api";
import { attempt, confirmDestructive } from "@/lib/prompt";
import { encodeIds, useSelection, type Selection } from "@/lib/selection";
import { fonts, useTheme } from "@/lib/theme";

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
  /** "trash" swaps the select actions for Restore / Delete and hides the row menus. */
  mode?: "library" | "trash";
  header?: ReactElement;
  emptyTitle: string;
  emptyBody?: string;
  /** Items for the header … menu. */
  menuItems?: MenuItem[];
  onPressVideo?: (video: VideoListItem) => void;
  largeTitle?: boolean;
  pathFor?: (video: VideoListItem) => string | undefined;
};

/**
 * A screen of video rows: Select + … menu in the header, and in select mode
 * a bottom toolbar acting on the selection.
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
  pathFor,
}: Props) {
  const selection = useSelection();
  const allIds = (videos ?? []).map((v) => v._id);
  const visibleItems = menuItems.filter((item) => !item.hidden);

  return (
    <>
      <SelectionTitle selection={selection} title={title} largeTitle={largeTitle} />
      {selection.selecting ? (
        <SelectionToolbars selection={selection} allIds={allIds} mode={mode} />
      ) : (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button disabled={allIds.length === 0} onPress={() => selection.start()}>
            Select
          </Stack.Toolbar.Button>
          {visibleItems.length > 0 && (
            <Stack.Toolbar.Menu icon="ellipsis">
              {visibleItems.map((item) => (
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
          )}
        </Stack.Toolbar>
      )}

      <VideoBrowser
        videos={videos}
        selection={selection}
        menu={mode === "library"}
        pathFor={pathFor}
        onPressVideo={onPressVideo}
        header={selection.selecting ? undefined : header}
        emptyTitle={emptyTitle}
        emptyBody={emptyBody}
      />
    </>
  );
}

/** Screen title that becomes "N selected" in select mode. */
export function SelectionTitle({ selection, title, largeTitle }: { selection: Selection; title: string; largeTitle?: boolean }) {
  const n = selection.ids.length;
  return (
    <Stack.Screen
      options={{
        title: selection.selecting ? (n === 0 ? "Select videos" : `${n} selected`) : title,
        headerLargeTitle: !!largeTitle && !selection.selecting,
        headerTitleStyle: { fontFamily: fonts.bold },
      }}
    />
  );
}

/** Select all / Done in the header and Move · Tag · Delete (or Restore · Delete) at the bottom. */
export function SelectionToolbars({
  selection,
  allIds,
  mode = "library",
}: {
  selection: Selection;
  allIds: Id<"videos">[];
  mode?: "library" | "trash";
}) {
  const theme = useTheme();
  const trashMany = useMutation(api.videos.trashMany);
  const restoreMany = useMutation(api.videos.restoreMany);
  const deleteForever = useMutation(api.videos.deleteForever);
  const ids = selection.ids;
  const none = ids.length === 0;
  const allSelected = !none && ids.length === allIds.length;

  const openPicker = (pathname: "/move" | "/tag-picker") => {
    router.push({ pathname, params: { videoIds: encodeIds(ids) } });
    selection.finish();
  };

  const run = async (title: string, fn: () => Promise<unknown>) => {
    if (await attempt(title, fn)) selection.finish();
  };

  const deleteSelected = async () => {
    const n = ids.length;
    const ok = await confirmDestructive(
      `Delete ${n} ${n === 1 ? "video" : "videos"} forever?`,
      "This can't be undone.",
      "Delete",
    );
    if (ok) await run("Couldn't delete", () => deleteForever({ videoIds: ids }));
  };

  return (
    <>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button onPress={() => selection.selectAll(allSelected ? [] : allIds)}>
          {allSelected ? "Deselect all" : "Select all"}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button variant="done" tintColor={theme.accent} onPress={selection.finish}>
          Done
        </Stack.Toolbar.Button>
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
          <Stack.Toolbar.Button
            icon="trash"
            disabled={none}
            onPress={() => void run("Couldn't move to Trash", () => trashMany({ videoIds: ids }))}
          >
            Delete
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      ) : (
        <Stack.Toolbar>
          <Stack.Toolbar.Button
            icon="arrow.uturn.backward"
            disabled={none}
            onPress={() => void run("Couldn't restore", () => restoreMany({ videoIds: ids }))}
          >
            Restore
          </Stack.Toolbar.Button>
          <Stack.Toolbar.Spacer />
          <Stack.Toolbar.Button icon="trash.slash" disabled={none} onPress={deleteSelected}>
            Delete
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      )}
    </>
  );
}
