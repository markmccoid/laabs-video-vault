import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { countLabel, plural } from "@/components/ui";
import type { Id } from "@/lib/api";
import type { Folder, FolderTreeNode, useFolders } from "@/lib/folders";
import { fonts, GUTTER, radius, type, useTheme } from "@/lib/theme";

type FolderData = ReturnType<typeof useFolders>;

type Props = {
  data: FolderData;
  /** Folders to show (top level, or a folder's children). */
  nodes: FolderTreeNode[];
  onNewFolder: () => void;
  newLabel?: string;
};

const GAP = 12;

function openFolder(id: Id<"folders">) {
  router.push(`/folder/${id}`);
}

function folderMeta(data: FolderData, f: Folder) {
  const inside = data.childCount(f._id);
  return [plural(data.count(f._id), "video"), inside ? `${inside} inside` : null].filter(Boolean).join(" · ");
}

// ─── Grid (1a) ───────────────────────────────────────────────────────────────

export function FolderGrid({ data, nodes, onNewFolder, newLabel = "New folder" }: Props) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const columns = width >= 700 ? 4 : 2;
  const cardWidth = (width - GUTTER * 2 - GAP * (columns - 1)) / columns;

  return (
    <View style={styles.grid}>
      {nodes.map((f) => {
        const tone = data.tone(f._id);
        return (
          <Pressable
            key={f._id}
            onPress={() => openFolder(f._id)}
            accessibilityRole="button"
            accessibilityLabel={`${f.name}, ${folderMeta(data, f)}`}
            style={({ pressed }) => [
              styles.card,
              { width: cardWidth, backgroundColor: tone.fill, transform: [{ scale: pressed ? 0.98 : 1 }] },
            ]}
          >
            <View style={[styles.circle, { backgroundColor: tone.circle }]} />
            <SymbolView name="folder.fill" size={26} tintColor={tone.icon} />
            <View style={styles.cardText}>
              <Text style={[styles.cardName, { color: theme.text }]} numberOfLines={2}>
                {f.name}
              </Text>
              <Text style={[type.metaStrong, { color: theme.muted }]} numberOfLines={1}>
                {folderMeta(data, f)}
              </Text>
            </View>
          </Pressable>
        );
      })}
      <Pressable
        onPress={onNewFolder}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.card,
          styles.newCard,
          { width: cardWidth, borderColor: theme.dashed, opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <SymbolView name="folder.badge.plus" size={26} tintColor={theme.muted} />
        <Text style={[styles.cardName, { color: theme.muted, fontSize: 17 }]}>{newLabel}</Text>
      </Pressable>
    </View>
  );
}

// ─── Tree (1c) ───────────────────────────────────────────────────────────────

export function FolderTree({ data, nodes, onNewFolder, newLabel = "New folder" }: Props) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const rows: React.ReactNode[] = [];
  const walk = (list: FolderTreeNode[], level: number) => {
    for (const node of list) {
      const open = expanded.has(node._id);
      const tone = data.tone(node._id);
      const hasChildren = node.children.length > 0;
      rows.push(
        <Pressable
          key={node._id}
          onPress={() => openFolder(node._id)}
          accessibilityRole="button"
          accessibilityLabel={`${node.name}, ${plural(data.count(node._id), "video")}`}
          style={({ pressed }) => [styles.treeRow, { backgroundColor: pressed ? theme.divider : "transparent" }]}
        >
          <View style={{ width: level * 22 }} />
          {hasChildren ? (
            <Pressable
              onPress={() => toggle(node._id)}
              hitSlop={12}
              style={styles.chevron}
              accessibilityRole="button"
              accessibilityLabel={open ? `Collapse ${node.name}` : `Expand ${node.name}`}
            >
              <SymbolView
                name="chevron.right"
                size={12}
                weight="bold"
                tintColor={theme.muted}
                style={{ transform: [{ rotate: open ? "90deg" : "0deg" }] }}
              />
            </Pressable>
          ) : (
            <View style={styles.chevron} />
          )}
          <SymbolView name="folder.fill" size={18} tintColor={tone.icon} />
          <Text style={[type.label, styles.treeName, { color: theme.text }]} numberOfLines={1}>
            {node.name}
          </Text>
          <Text style={[type.metaStrong, { color: theme.muted }]}>{countLabel(data.count(node._id))}</Text>
        </Pressable>,
      );
      if (open) walk(node.children, level + 1);
    }
  };
  walk(nodes, 0);

  return (
    <View style={[styles.tree, { backgroundColor: theme.surface }]}>
      {rows}
      <Pressable
        onPress={onNewFolder}
        accessibilityRole="button"
        style={({ pressed }) => [styles.treeRow, { opacity: pressed ? 0.6 : 1 }]}
      >
        <View style={styles.chevron} />
        <SymbolView name="folder.badge.plus" size={18} tintColor={theme.muted} />
        <Text style={[type.label, styles.treeName, { color: theme.muted }]}>{newLabel}</Text>
      </Pressable>
    </View>
  );
}

// ─── List rows (1b; folder detail subfolders) ───────────────────────────────

export function FolderList({ data, nodes }: { data: FolderData; nodes: FolderTreeNode[] }) {
  const theme = useTheme();
  return (
    <View style={styles.list}>
      {nodes.map((f) => {
        const tone = data.tone(f._id);
        return (
          <Pressable
            key={f._id}
            onPress={() => openFolder(f._id)}
            accessibilityRole="button"
            accessibilityLabel={`${f.name}, ${folderMeta(data, f)}`}
            style={({ pressed }) => [styles.listRow, { backgroundColor: theme.surface, opacity: pressed ? 0.75 : 1 }]}
          >
            <View style={[styles.badge, { backgroundColor: tone.badge }]}>
              <SymbolView name="folder.fill" size={20} tintColor={tone.icon} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[type.label, { color: theme.text }]} numberOfLines={1}>
                {f.name}
              </Text>
              <Text style={[type.meta, { color: theme.muted }]}>{folderMeta(data, f)}</Text>
            </View>
            <SymbolView name="chevron.right" size={13} weight="bold" tintColor={theme.muted} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8, paddingHorizontal: GUTTER },
  listRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingHorizontal: 12, borderRadius: radius.card },
  badge: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP, paddingHorizontal: GUTTER },
  card: {
    minHeight: 124,
    padding: 16,
    borderRadius: radius.lg,
    overflow: "hidden",
    justifyContent: "space-between",
    gap: 12,
  },
  circle: { position: "absolute", width: 110, height: 110, borderRadius: 55, right: -34, top: -38, opacity: 0.5 },
  cardText: { gap: 3 },
  cardName: { fontFamily: fonts.display, fontSize: 19, lineHeight: 23 },
  newCard: { borderWidth: 2, borderStyle: "dashed", justifyContent: "center", alignItems: "center" },
  tree: { marginHorizontal: GUTTER, borderRadius: radius.lg, paddingVertical: 6, overflow: "hidden" },
  treeRow: { flexDirection: "row", alignItems: "center", minHeight: 48, paddingHorizontal: 14, gap: 8 },
  chevron: { width: 16, alignItems: "center" },
  treeName: { flex: 1, fontSize: 15 },
});
