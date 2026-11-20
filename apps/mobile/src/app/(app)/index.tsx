import { matchesScope, type SearchScope } from "@lvv/core";
import { useQuery } from "convex/react";
import { router, Stack } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { SearchBarCommands } from "react-native-screens";
import { FolderGrid, FolderTree } from "@/components/FolderViews";
import { Chip, countLabel, EmptyState, GroupLabel, plural, SectionTitle, Segmented } from "@/components/ui";
import { SelectionTitle, SelectionToolbars } from "@/components/VideoListScreen";
import { VideoBrowser } from "@/components/VideoBrowser";
import type { VideoListItem } from "@/components/VideoRow";
import { api } from "@/lib/api";
import { useFolders } from "@/lib/folders";
import { useJustAdded } from "@/lib/justAdded";
import { usePreferences } from "@/lib/preferences";
import { useSelection } from "@/lib/selection";
import { GUTTER, radius, type, useTheme } from "@/lib/theme";

export default function Library() {
  const theme = useTheme();
  const selection = useSelection();
  const searchBar = useRef<SearchBarCommands>(null);
  const [searching, setSearching] = useState(false);
  const [text, setText] = useState("");
  const inbox = useQuery(api.videos.listByFolder, {});
  const prefs = usePreferences();

  const closeSearch = () => {
    setText("");
    setSearching(false);
  };

  return (
    <>
      <SelectionTitle selection={selection} title="Library" largeTitle />
      {selection.selecting ? (
        <SelectionToolbars selection={selection} allIds={(inbox ?? []).map((v) => v._id)} />
      ) : (
        <>
          <Stack.Toolbar placement="left">
            <Stack.Toolbar.Button icon="gearshape" accessibilityLabel="Settings" onPress={() => router.push("/settings")} />
          </Stack.Toolbar>
          <Stack.Toolbar placement="right">
            <Stack.Toolbar.Button disabled={!inbox?.length} onPress={() => selection.start()}>
              Select
            </Stack.Toolbar.Button>
            <Stack.Toolbar.Menu icon="plus" variant="prominent" tintColor={theme.accent} accessibilityLabel="Add">
              <Stack.Toolbar.MenuAction icon="link" onPress={() => router.push("/add")}>
                Add video
              </Stack.Toolbar.MenuAction>
              <Stack.Toolbar.MenuAction icon="folder.badge.plus" onPress={() => router.push("/new-folder")}>
                New folder
              </Stack.Toolbar.MenuAction>
            </Stack.Toolbar.Menu>
          </Stack.Toolbar>
          <Stack.SearchBar
            ref={searchBar}
            placeholder="Search titles, descriptions, tags"
            autoCapitalize="none"
            tintColor={theme.accent}
            onFocus={() => setSearching(true)}
            onChangeText={(e) => setText(e.nativeEvent.text)}
            onSearchButtonPress={(e) => prefs.addRecentSearch(e.nativeEvent.text)}
            onCancelButtonPress={closeSearch}
          />
          <Stack.Toolbar>
            <Stack.Toolbar.SearchBarSlot />
          </Stack.Toolbar>
        </>
      )}
      {searching ? (
        <SearchView
          text={text}
          onPickRecent={(q) => {
            searchBar.current?.setText(q);
            setText(q);
          }}
        />
      ) : (
        <LibraryHome inbox={inbox} selection={selection} />
      )}
    </>
  );
}

// ─── Home (1a / 1c) ─────────────────────────────────────────────────────────

function LibraryHome({
  inbox,
  selection,
}: {
  inbox: VideoListItem[] | undefined;
  selection: ReturnType<typeof useSelection>;
}) {
  const theme = useTheme();
  const data = useFolders();
  const justAdded = useJustAdded();
  const { libraryLayout } = usePreferences();
  const selecting = selection.selecting;

  const filed = data.tree.reduce((sum, f) => sum + data.count(f._id), 0);
  const total = filed + (inbox?.length ?? 0);
  const newFolder = () => router.push("/new-folder");
  const Folders = libraryLayout === "tree" ? FolderTree : FolderGrid;

  const header = (
    <View>
      {!selecting && (
        <>
          <Text style={[styles.subtitle, { color: theme.muted }]}>
            {plural(total, "video")} · {plural(data.folders?.length ?? 0, "folder")}
          </Text>
          {data.folders && <Folders data={data} nodes={data.tree} onNewFolder={newFolder} />}
          {!!justAdded?.length && (
            <Pressable
              onPress={() => router.push("/just-added")}
              accessibilityRole="button"
              style={({ pressed }) => [styles.justAdded, { backgroundColor: theme.sageSoft, opacity: pressed ? 0.7 : 1 }]}
            >
              <SymbolView name="clock" size={16} tintColor={theme.sageInk} />
              <Text style={[type.label, { color: theme.sageInk, flex: 1, fontSize: 15 }]}>Just added</Text>
              <Text style={[type.metaStrong, { color: theme.sageInk }]}>{countLabel(justAdded.length)}</Text>
              <SymbolView name="chevron.right" size={12} weight="bold" tintColor={theme.sageInk} />
            </Pressable>
          )}
        </>
      )}
      <SectionTitle title="Inbox" detail="Not filed yet" />
    </View>
  );

  return (
    <VideoBrowser
      videos={inbox}
      selection={selection}
      header={header}
      emptyTitle="Inbox is clear"
      emptyBody="New videos land here until you file them. Tap + to add one."
    />
  );
}

// ─── Search (2f) ────────────────────────────────────────────────────────────

const SCOPES: { value: SearchScope; label: string }[] = [
  { value: "all", label: "All" },
  { value: "title", label: "Title" },
  { value: "description", label: "Description" },
  { value: "tags", label: "Tags" },
];

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function SearchView({ text, onPickRecent }: { text: string; onPickRecent: (q: string) => void }) {
  const theme = useTheme();
  const prefs = usePreferences();
  const data = useFolders();
  const tags = useQuery(api.tags.list);
  const [scope, setScope] = useState<SearchScope>("all");
  const query = useDebounced(text.trim(), 200);
  const results = useQuery(api.videos.search, query ? { text: query, tagIds: [] } : "skip");
  const filtered = results?.filter((v) => matchesScope(v, query, scope));

  const scopePicker = (
    <View style={styles.scope}>
      <Segmented value={scope} options={SCOPES} onChange={setScope} />
    </View>
  );

  if (!query) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {scopePicker}
        {prefs.recentSearches.length > 0 && (
          <>
            <View style={styles.recentHeader}>
              <GroupLabel>Recent</GroupLabel>
              <Pressable onPress={prefs.clearRecentSearches} hitSlop={8} accessibilityRole="button">
                <Text style={[type.metaStrong, { color: theme.accentInk }]}>Clear</Text>
              </Pressable>
            </View>
            {prefs.recentSearches.map((q) => (
              <Pressable
                key={q}
                onPress={() => onPickRecent(q)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.recentRow, { opacity: pressed ? 0.6 : 1 }]}
              >
                <SymbolView name="clock.arrow.circlepath" size={16} tintColor={theme.muted} />
                <Text style={[type.body, { color: theme.text, flex: 1 }]}>{q}</Text>
                <SymbolView name="arrow.up.left" size={13} tintColor={theme.muted} />
              </Pressable>
            ))}
          </>
        )}
        {!!tags?.length && (
          <>
            <GroupLabel>Browse by tag</GroupLabel>
            <View style={styles.tagCloud}>
              {tags.map((tag) => (
                <Chip
                  key={tag._id}
                  label={tag.name}
                  detail={countLabel(tag.count)}
                  variant="sage"
                  size="md"
                  icon="tag.fill"
                  onPress={() => router.push(`/tag/${tag._id}`)}
                />
              ))}
            </View>
          </>
        )}
        {!prefs.recentSearches.length && !tags?.length && (
          <EmptyState title="Search your library" body="Titles, descriptions, and tags." />
        )}
      </ScrollView>
    );
  }

  return (
    <VideoBrowser
      videos={filtered}
      query={query}
      pathFor={(v) => data.pathFor(v.folderId)}
      onPressVideo={(v) => {
        prefs.addRecentSearch(query);
        router.push(`/video/${v._id}`);
      }}
      header={
        <View>
          {scopePicker}
          {filtered && filtered.length > 0 && (
            <Text style={[styles.resultCount, { color: theme.muted }]}>{plural(filtered.length, "result")}</Text>
          )}
        </View>
      }
      emptyTitle="No matches"
      emptyBody={scope === "all" ? "Try different words." : "Try a different scope, or All."}
    />
  );
}

const styles = StyleSheet.create({
  subtitle: { ...type.body, fontSize: 14, paddingHorizontal: GUTTER, marginTop: -2, marginBottom: 16 },
  justAdded: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: GUTTER,
    marginTop: 16,
    paddingHorizontal: 16,
    minHeight: 48,
    borderRadius: radius.card,
  },
  scope: { paddingHorizontal: GUTTER, paddingTop: 8, paddingBottom: 4 },
  recentHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingRight: GUTTER },
  recentRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44, paddingHorizontal: GUTTER + 4 },
  tagCloud: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: GUTTER },
  resultCount: { ...type.metaStrong, paddingHorizontal: GUTTER, paddingTop: 12, paddingBottom: 4 },
});
