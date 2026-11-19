import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/lib/theme";

type Props = {
  icon: SymbolViewProps["name"];
  label: string;
  detail?: string;
  /** Indent level (folder depth). */
  indent?: number;
  onPress: () => void;
  /** Disclosure toggle shown before the icon (folders with children). */
  expanded?: boolean;
  onToggle?: () => void;
  disabled?: boolean;
  checked?: boolean;
  /** Show a chevron (navigates) — off for pickers. */
  chevron?: boolean;
  tint?: string;
};

/** Count text for a row; the backend caps counts at 200. */
export function countLabel(n: number) {
  return n >= 200 ? "200+" : String(n);
}

/** A grouped-list row: icon, label, optional count, chevron. Used by the Library and pickers. */
export function NavRow({
  icon,
  label,
  detail,
  indent = 0,
  onPress,
  expanded,
  onToggle,
  disabled,
  checked,
  chevron = true,
  tint,
}: Props) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      accessibilityState={{ disabled, checked }}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? theme.border : theme.card, opacity: disabled ? 0.4 : 1 },
      ]}
    >
      <View style={{ width: indent * 20 }} />
      {onToggle ? (
        <Pressable onPress={onToggle} hitSlop={10} style={styles.disclosure} accessibilityLabel="Expand">
          <SymbolView
            name={expanded ? "chevron.down" : "chevron.right"}
            size={12}
            weight="semibold"
            tintColor={theme.muted}
          />
        </Pressable>
      ) : (
        <View style={styles.disclosure} />
      )}
      <SymbolView name={icon} size={20} tintColor={tint ?? theme.accent} style={styles.icon} />
      <Text style={[styles.label, { color: theme.text }]} numberOfLines={1}>
        {label}
      </Text>
      {!!detail && <Text style={{ color: theme.muted }}>{detail}</Text>}
      {checked && <SymbolView name="checkmark" size={16} weight="semibold" tintColor={theme.accent} />}
      {chevron && <SymbolView name="chevron.right" size={13} weight="semibold" tintColor={theme.border} />}
    </Pressable>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: { icon: SymbolViewProps["name"]; label: string; onPress: () => void } }) {
  const theme = useTheme();
  return (
    <View style={styles.header}>
      <Text style={[styles.headerText, { color: theme.text }]}>{title}</Text>
      {action && (
        <Pressable onPress={action.onPress} hitSlop={10} accessibilityLabel={action.label} accessibilityRole="button">
          <SymbolView name={action.icon} size={20} tintColor={theme.accent} />
        </Pressable>
      )}
    </View>
  );
}

/** Rounded group container for rows. */
export function RowGroup({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return <View style={[styles.group, { borderColor: theme.border }]}>{children}</View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12, paddingRight: 14, paddingLeft: 4 },
  disclosure: { width: 18, alignItems: "center" },
  icon: { width: 24, height: 22 },
  label: { flex: 1, fontSize: 16 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 8,
  },
  headerText: { fontSize: 20, fontWeight: "700" },
  group: { marginHorizontal: 16, borderRadius: 14, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth },
});
