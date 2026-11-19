import type { ReactElement } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { VideoCard } from "@/components/VideoCard";
import { VideoRow, type VideoListItem } from "@/components/VideoRow";
import type { Selection } from "@/lib/selection";
import { useTheme } from "@/lib/theme";
import type { ViewMode } from "@/lib/viewMode";

const GUTTER = 16;
const GAP = 12;
/** Grid tiles aim for at least this width: 2 columns on iPhone, more on iPad. */
const MIN_TILE = 160;

type Props = {
  /** Undefined while loading. */
  videos: VideoListItem[] | undefined;
  viewMode: ViewMode;
  selection?: Selection;
  /** Overrides tapping a video when not selecting (default: open it). */
  onPressVideo?: (video: VideoListItem) => void;
  header?: ReactElement;
  emptyTitle: string;
  emptyBody?: string;
};

/** A list or grid of videos with optional multi-select. */
export function VideoBrowser({ videos, viewMode, selection, onPressVideo, header, emptyTitle, emptyBody }: Props) {
  const theme = useTheme();
  const { width } = useWindowDimensions();

  const grid = viewMode === "grid";
  const columns = grid ? Math.max(2, Math.floor((width - GUTTER * 2 + GAP) / (MIN_TILE + GAP))) : 1;
  const tileWidth = (width - GUTTER * 2 - GAP * (columns - 1)) / columns;
  const selecting = selection?.selecting ?? false;

  return (
    <FlatList
      // FlatList can't change numColumns in place; remount when it changes.
      key={`cols-${columns}`}
      numColumns={columns}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      data={videos ?? []}
      keyExtractor={(v) => v._id}
      extraData={selection?.selected}
      renderItem={({ item }) => {
        const props = {
          video: item,
          selected: selecting ? selection!.selected.has(item._id) : undefined,
          onPress: selecting
            ? () => selection!.toggle(item._id)
            : onPressVideo
              ? () => onPressVideo(item)
              : undefined,
        };
        return grid ? <VideoCard {...props} width={tileWidth} /> : <VideoRow {...props} />;
      }}
      columnWrapperStyle={grid ? styles.gridRow : undefined}
      ItemSeparatorComponent={() => <View style={{ height: grid ? GAP : 8 }} />}
      contentContainerStyle={{ paddingBottom: 32 }}
      ListHeaderComponent={header}
      ListEmptyComponent={
        videos === undefined ? (
          <ActivityIndicator style={{ marginTop: 40 }} />
        ) : (
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>{emptyTitle}</Text>
            {!!emptyBody && <Text style={[styles.emptyBody, { color: theme.muted }]}>{emptyBody}</Text>}
          </View>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  gridRow: { gap: GAP, paddingHorizontal: GUTTER },
  empty: { alignItems: "center", marginTop: 48, paddingHorizontal: 32, gap: 6 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyBody: { fontSize: 15, textAlign: "center" },
});
