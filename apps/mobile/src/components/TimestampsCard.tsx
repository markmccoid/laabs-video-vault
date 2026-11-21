import { formatDuration, timestampSeconds, watchUrl } from "@lvv/core";
import { useMutation } from "convex/react";
import { SymbolView } from "expo-symbols";
import { useRef } from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import ReanimatedSwipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import { PillButton } from "@/components/ui";
import { api, type Doc, type Id } from "@/lib/api";
import { attempt } from "@/lib/prompt";
import { usePreferences } from "@/lib/preferences";
import { radius, type, useTheme } from "@/lib/theme";

type Props = {
  videoId: Id<"videos">;
  youtubeId: string;
  /** The video's bookmarks, sorted by time; only the user's own are shown. */
  bookmarks: Doc<"bookmarks">[];
  /** Current player position, for "Add m:ss". */
  currentTime: number;
  onSeek: (seconds: number) => void;
};

/** Ask for a short description. Resolves to null when cancelled. */
function askLabel(title: string, defaultValue = ""): Promise<string | null> {
  return new Promise((resolve) => {
    Alert.prompt(
      title,
      "Add a short description.",
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
        { text: "Save", isPreferred: true, onPress: (value?: string) => resolve(value ?? "") },
      ],
      "plain-text",
      defaultValue,
    );
  });
}

/** Timestamps: the user's own marks on the video, collapsible, above My notes. */
export function TimestampsCard({ videoId, youtubeId, bookmarks, currentTime, onSeek }: Props) {
  const theme = useTheme();
  const { timestampsOpen: open, setTimestampsOpen } = usePreferences();
  const add = useMutation(api.timestamps.add);
  const update = useMutation(api.timestamps.update);
  const remove = useMutation(api.timestamps.remove);
  const stamps = bookmarks.filter((b) => b.source === "user");
  const now = timestampSeconds(currentTime);

  const addStamp = async () => {
    // Keep the moment of the tap; the video plays on while you type.
    const at = now;
    const label = await askLabel(`Timestamp at ${formatDuration(at)}`);
    if (label === null) return;
    if (!open) setTimestampsOpen(true);
    await attempt("Couldn't add timestamp", () => add({ videoId, seconds: at, label }));
  };

  const edit = async (stamp: Doc<"bookmarks">) => {
    const label = await askLabel(`Timestamp at ${formatDuration(stamp.seconds)}`, stamp.label);
    if (label === null || label === stamp.label) return;
    await attempt("Couldn't save timestamp", () => update({ timestampId: stamp._id, label }));
  };

  const del = (stamp: Doc<"bookmarks">) =>
    void attempt("Couldn't delete timestamp", () => remove({ timestampId: stamp._id }));

  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => setTimestampsOpen(!open)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={`Timestamps, ${stamps.length}`}
          style={styles.toggle}
          hitSlop={8}
        >
          <SymbolView name="clock" size={17} tintColor={theme.accentInk} />
          <Text style={[type.sheetTitle, { color: theme.text, fontSize: 17 }]}>Timestamps</Text>
          {stamps.length > 0 && (
            <Text style={[type.metaStrong, { color: theme.muted }]}>{stamps.length}</Text>
          )}
          <SymbolView name={open ? "chevron.up" : "chevron.down"} size={13} weight="semibold" tintColor={theme.muted} />
        </Pressable>
        <PillButton
          label={`Add ${formatDuration(now)}`}
          icon="plus"
          variant="accent"
          onPress={() => void addStamp()}
          style={styles.addPill}
        />
      </View>

      {open &&
        (stamps.length === 0 ? (
          <Text style={[type.meta, { color: theme.muted, paddingHorizontal: 4 }]}>
            Tap Add to mark the current moment with a short description.
          </Text>
        ) : (
          <View style={[styles.list, { backgroundColor: theme.bg }]}>
            {stamps.map((s, i) => (
              <TimestampRow
                key={s._id}
                stamp={s}
                first={i === 0}
                onSeek={() => onSeek(s.seconds)}
                onOpenYouTube={() => void Linking.openURL(watchUrl(youtubeId, s.seconds))}
                onEdit={() => void edit(s)}
                onDelete={() => del(s)}
              />
            ))}
          </View>
        ))}
    </View>
  );
}

const ACTION_WIDTH = 76;

function TimestampRow({
  stamp,
  first,
  onSeek,
  onOpenYouTube,
  onEdit,
  onDelete,
}: {
  stamp: Doc<"bookmarks">;
  first: boolean;
  onSeek: () => void;
  onOpenYouTube: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  const swipe = useRef<SwipeableMethods>(null);
  const time = formatDuration(stamp.seconds);

  const actions = () => (
    <View style={styles.actions}>
      <SwipeAction
        label="Edit"
        icon="pencil"
        color={theme.sage}
        ink={theme.accentText}
        onPress={() => {
          swipe.current?.close();
          onEdit();
        }}
      />
      <SwipeAction
        label="Delete"
        icon="trash"
        color={theme.danger}
        ink="#fff"
        onPress={() => {
          swipe.current?.close();
          onDelete();
        }}
      />
    </View>
  );

  return (
    <ReanimatedSwipeable
      ref={swipe}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={actions}
      containerStyle={[{ backgroundColor: theme.bg }, !first && { borderTopColor: theme.divider, borderTopWidth: StyleSheet.hairlineWidth }]}
    >
      <View style={[styles.row, { backgroundColor: theme.bg }]}>
        <Pressable
          onPress={onSeek}
          accessibilityRole="button"
          accessibilityLabel={`Play from ${time}: ${stamp.label}`}
          accessibilityHint="Swipe left to edit or delete"
          style={({ pressed }) => [styles.seek, { opacity: pressed ? 0.6 : 1 }]}
        >
          <View style={[styles.time, { backgroundColor: theme.accentSoft }]}>
            <SymbolView name="play.fill" size={10} tintColor={theme.accentInk} />
            <Text style={[type.metaStrong, styles.timeText, { color: theme.accentInk }]}>{time}</Text>
          </View>
          <Text style={[type.body, { color: theme.text, flex: 1 }]} numberOfLines={2}>
            {stamp.label}
          </Text>
        </Pressable>
        <Pressable
          onPress={onOpenYouTube}
          accessibilityRole="link"
          accessibilityLabel={`Open in YouTube at ${time}`}
          hitSlop={6}
          style={({ pressed }) => [styles.yt, { opacity: pressed ? 0.5 : 1 }]}
        >
          <SymbolView name="arrow.up.right.square" size={20} tintColor={theme.muted} />
        </Pressable>
      </View>
    </ReanimatedSwipeable>
  );
}

function SwipeAction({
  label,
  icon,
  color,
  ink,
  onPress,
}: {
  label: string;
  icon: "pencil" | "trash";
  color: string;
  ink: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.action, { backgroundColor: color, opacity: pressed ? 0.8 : 1 }]}
    >
      <SymbolView name={icon} size={17} tintColor={ink} />
      <Text style={[type.metaStrong, { color: ink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: 14, gap: 12 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingHorizontal: 4 },
  toggle: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  addPill: { minHeight: 34, paddingHorizontal: 14 },
  list: { borderRadius: 20, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", paddingLeft: 12, paddingRight: 6, minHeight: 52 },
  seek: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  time: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill, minWidth: 64 },
  timeText: { fontVariant: ["tabular-nums"] },
  yt: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  actions: { flexDirection: "row" },
  action: { width: ACTION_WIDTH, alignItems: "center", justifyContent: "center", gap: 3 },
});
