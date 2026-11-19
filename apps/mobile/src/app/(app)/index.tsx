import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { Stack } from "expo-router";
import { ActivityIndicator, FlatList, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { AddVideoBar } from "@/components/AddVideoBar";
import { VideoCard } from "@/components/VideoCard";
import { VideoRow } from "@/components/VideoRow";
import { api } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { useViewMode } from "@/lib/viewMode";

const GUTTER = 16;
const GAP = 12;
/** Grid tiles aim for at least this width: 2 columns on iPhone, more on iPad. */
const MIN_TILE = 160;

export default function Inbox() {
  const theme = useTheme();
  const { signOut } = useAuthActions();
  const videos = useQuery(api.videos.listByFolder, {});
  const [viewMode, setViewMode] = useViewMode();
  const { width } = useWindowDimensions();

  const grid = viewMode === "grid";
  const columns = grid ? Math.max(2, Math.floor((width - GUTTER * 2 + GAP) / (MIN_TILE + GAP))) : 1;
  const tileWidth = (width - GUTTER * 2 - GAP * (columns - 1)) / columns;

  return (
    <>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu icon="ellipsis.circle">
          <Stack.Toolbar.MenuAction icon="list.bullet" isOn={!grid} onPress={() => setViewMode("list")}>
            List
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction icon="square.grid.2x2" isOn={grid} onPress={() => setViewMode("grid")}>
            Grid
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction
            icon="rectangle.portrait.and.arrow.right"
            destructive
            onPress={() => void signOut()}
          >
            Sign out
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
      <FlatList
        // FlatList can't change numColumns in place; remount when it changes.
        key={`cols-${columns}`}
        numColumns={columns}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        data={videos ?? []}
        keyExtractor={(v) => v._id}
        renderItem={({ item }) => (grid ? <VideoCard video={item} width={tileWidth} /> : <VideoRow video={item} />)}
        columnWrapperStyle={grid ? styles.gridRow : undefined}
        ItemSeparatorComponent={() => <View style={{ height: grid ? GAP : 8 }} />}
        contentContainerStyle={{ paddingBottom: 32 }}
        ListHeaderComponent={<AddVideoBar />}
        ListEmptyComponent={
          videos === undefined ? (
            <ActivityIndicator style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Your Inbox is empty</Text>
              <Text style={[styles.emptyBody, { color: theme.muted }]}>
                Copy a link in YouTube, then tap Paste above.
              </Text>
            </View>
          )
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  gridRow: { gap: GAP, paddingHorizontal: GUTTER },
  empty: { alignItems: "center", marginTop: 60, paddingHorizontal: 32, gap: 6 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyBody: { fontSize: 15, textAlign: "center" },
});
