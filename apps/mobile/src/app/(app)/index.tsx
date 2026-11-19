import { useAuthActions } from "@convex-dev/auth/react";
import { buildFolderTree, type FolderNode } from "@lvv/core";
import { useQuery } from "convex/react";
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AddVideoBar } from "@/components/AddVideoBar";
import { countLabel, NavRow, RowGroup, SectionHeader } from "@/components/NavRow";
import { VideoBrowser } from "@/components/VideoBrowser";
import { api, type Doc, type Id } from "@/lib/api";
import { useFolderActions } from "@/lib/folderActions";
import { useTheme } from "@/lib/theme";
import { useViewMode } from "@/lib/viewMode";

type Shorts = "only" | "hide" | undefined;

export default function Library() {
  const { signOut } = useAuthActions();
  const folderActions = useFolderActions();
  const [searching, setSearching] = useState(false);
  const [text, setText] = useState("");

  return (
    <>
      <Stack.SearchBar
        placeholder="Search videos"
        autoCapitalize="none"
        onFocus={() => setSearching(true)}
        onChangeText={(e) => setText(e.nativeEvent.text)}
        onCancelButtonPress={() => {
          setText("");
          setSearching(false);
        }}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu icon="ellipsis.circle">
          <Stack.Toolbar.MenuAction icon="folder.badge.plus" onPress={() => void folderActions.newFolder()}>
            New Folder
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
      {searching ? <SearchResults text={text} /> : <LibraryHome onNewFolder={() => void folderActions.newFolder()} />}
    </>
  );
}

// ─── Home ───────────────────────────────────────────────────────────────────

function LibraryHome({ onNewFolder }: { onNewFolder: () => void }) {
  const theme = useTheme();
  const inbox = useQuery(api.videos.listByFolder, {});
  const folders = useQuery(api.folders.list);
  const folderCounts = useQuery(api.folders.counts);
  const tags = useQuery(api.tags.list);
  const trash = useQuery(api.videos.listTrash);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const renderFolders = (nodes: FolderNode<Doc<"folders">>[]): React.ReactNode[] =>
    nodes.flatMap((node) => [
      <NavRow
        key={node._id}
        icon="folder"
        label={node.name}
        indent={node.depth}
        detail={folderCounts ? countLabel(folderCounts[node._id] ?? 0) : undefined}
        onPress={() => router.push(`/folder/${node._id}`)}
        expanded={expanded.has(node._id)}
        onToggle={node.children.length > 0 ? () => toggle(node._id) : undefined}
      />,
      ...(expanded.has(node._id) ? renderFolders(node.children) : []),
    ]);

  const tree = folders ? buildFolderTree(folders) : [];

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled">
      <AddVideoBar />

      <RowGroup>
        <NavRow
          icon="tray"
          label="Inbox"
          detail={inbox ? countLabel(inbox.length) : undefined}
          onPress={() => router.push("/inbox")}
        />
      </RowGroup>

      <SectionHeader title="Folders" action={{ icon: "folder.badge.plus", label: "New Folder", onPress: onNewFolder }} />
      {folders && tree.length === 0 ? (
        <Pressable onPress={onNewFolder} style={styles.emptyHint}>
          <Text style={{ color: theme.muted }}>No folders yet. Tap here to create one.</Text>
        </Pressable>
      ) : (
        <RowGroup>{renderFolders(tree)}</RowGroup>
      )}

      {!!tags?.length && (
        <>
          <SectionHeader title="Tags" />
          <RowGroup>
            {tags.map((tag) => (
              <NavRow
                key={tag._id}
                icon="number"
                label={tag.name}
                detail={countLabel(tag.count)}
                onPress={() => router.push(`/tag/${tag._id}`)}
              />
            ))}
          </RowGroup>
        </>
      )}

      <View style={styles.trash}>
        <RowGroup>
          <NavRow
            icon="trash"
            label="Trash"
            tint={theme.muted}
            detail={trash?.length ? countLabel(trash.length) : undefined}
            onPress={() => router.push("/trash")}
          />
        </RowGroup>
      </View>
    </ScrollView>
  );
}

// ─── Search ─────────────────────────────────────────────────────────────────

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function SearchResults({ text }: { text: string }) {
  const [viewMode] = useViewMode();
  const tags = useQuery(api.tags.list);
  const [tagIds, setTagIds] = useState<Id<"tags">[]>([]);
  const [shorts, setShorts] = useState<Shorts>(undefined);
  const query = useDebounced(text.trim(), 200);

  const active = query.length > 0 || tagIds.length > 0 || shorts === "only";
  const results = useQuery(api.videos.search, active ? { text: query, tagIds, shorts } : "skip");

  const toggleTag = (id: Id<"tags">) =>
    setTagIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));

  const chips = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      <Chip label="Shorts only" on={shorts === "only"} onPress={() => setShorts(shorts === "only" ? undefined : "only")} />
      <Chip label="No Shorts" on={shorts === "hide"} onPress={() => setShorts(shorts === "hide" ? undefined : "hide")} />
      {(tags ?? []).map((tag) => (
        <Chip key={tag._id} label={`#${tag.name}`} on={tagIds.includes(tag._id)} onPress={() => toggleTag(tag._id)} />
      ))}
    </ScrollView>
  );

  return (
    <VideoBrowser
      videos={active ? results : []}
      viewMode={viewMode}
      header={chips}
      emptyTitle={active ? "No matches" : "Search your library"}
      emptyBody={
        active
          ? "Try different words or fewer filters."
          : "Titles, channels, tags, notes, and descriptions. Tap a chip to filter."
      }
    />
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={[
        styles.chip,
        { backgroundColor: on ? theme.accent : theme.card, borderColor: on ? theme.accent : theme.border },
      ]}
    >
      <Text style={{ color: on ? theme.accentText : theme.text, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  emptyHint: { marginHorizontal: 20, paddingVertical: 6 },
  trash: { marginTop: 28, marginBottom: 40 },
  chips: { gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  chip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7 },
});
