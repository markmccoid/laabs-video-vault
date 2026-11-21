import type { ReactElement } from "react";
import { ActivityIndicator, FlatList } from "react-native";
import { EmptyState } from "@/components/ui";
import { VideoRow, type VideoListItem } from "@/components/VideoRow";
import type { Selection } from "@/lib/selection";

type Props = {
  /** Undefined while loading. */
  videos: VideoListItem[] | undefined;
  selection?: Selection;
  /** Overrides tapping a video when not selecting (default: open it). */
  onPressVideo?: (video: VideoListItem) => void;
  header?: ReactElement;
  emptyTitle: string;
  emptyBody?: string;
  query?: string;
  pathFor?: (video: VideoListItem) => string | undefined;
  menu?: boolean;
};

/** A list of video rows with optional multi-select. */
export function VideoBrowser({ videos, selection, onPressVideo, header, emptyTitle, emptyBody, query, pathFor, menu }: Props) {
  const selecting = selection?.selecting ?? false;

  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      data={videos ?? []}
      keyExtractor={(v) => v._id}
      extraData={[selection?.selected, query]}
      renderItem={({ item }) => (
        <VideoRow
          video={item}
          query={query}
          path={pathFor?.(item)}
          menu={menu}
          selected={selecting ? selection!.selected.has(item._id) : undefined}
          onStartSelect={selection ? () => selection.start(item._id) : undefined}
          onPress={
            selecting ? () => selection!.toggle(item._id) : onPressVideo ? () => onPressVideo(item) : undefined
          }
        />
      )}
      contentContainerStyle={{ paddingBottom: 120 }}
      ListHeaderComponent={header}
      ListEmptyComponent={
        videos === undefined ? (
          <ActivityIndicator style={{ marginTop: 40 }} />
        ) : (
          <EmptyState title={emptyTitle} body={emptyBody} />
        )
      }
    />
  );
}
