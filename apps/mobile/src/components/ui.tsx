import { Host, Picker, Text as SwiftText } from "@expo/ui/swift-ui";
import { pickerStyle, tag, tint } from "@expo/ui/swift-ui/modifiers";
import { MAX_FOLDER_DEPTH } from "@lvv/core";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { fonts, GUTTER, radius, type, useTheme } from "@/lib/theme";

export type SymbolName = SymbolViewProps["name"];

/** Count text; the backend caps per-folder counts at 200. */
export function countLabel(n: number) {
  return n >= 200 ? "200+" : String(n);
}

export function plural(n: number, word: string) {
  return `${countLabel(n)} ${word}${n === 1 ? "" : "s"}`;
}

// ─── Chips ───────────────────────────────────────────────────────────────────

type ChipProps = {
  label: string;
  /** surface: plain tag chip. sage: solid sage (current tags, browse by tag). accent: selected. dashed: add affordance. */
  variant?: "surface" | "sage" | "accent" | "dashed";
  size?: "sm" | "md";
  icon?: SymbolName;
  detail?: string;
  onPress?: () => void;
  onRemove?: () => void;
  accessibilityLabel?: string;
};

export function Chip({ label, variant = "surface", size = "sm", icon, detail, onPress, onRemove, accessibilityLabel }: ChipProps) {
  const theme = useTheme();
  const bg =
    variant === "accent" ? theme.accent : variant === "sage" ? theme.sageChip : variant === "dashed" ? "transparent" : theme.surface;
  const fg = variant === "accent" ? theme.accentText : variant === "sage" ? theme.sageInk : theme.text;
  const md = size === "md";
  const body = (
    <View
      style={[
        styles.chip,
        md && styles.chipMd,
        { backgroundColor: bg },
        variant === "dashed" && { borderWidth: 1.5, borderStyle: "dashed", borderColor: theme.dashed },
      ]}
    >
      {icon && <SymbolView name={icon} size={md ? 13 : 10} weight="bold" tintColor={fg} />}
      <Text style={[md ? styles.chipTextMd : type.chip, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
      {!!detail && <Text style={[md ? styles.chipTextMd : type.chip, { color: fg, opacity: 0.6 }]}>{detail}</Text>}
      {onRemove && (
        <Pressable onPress={onRemove} hitSlop={10} accessibilityLabel={`Remove ${label}`}>
          <SymbolView name="xmark" size={md ? 11 : 9} weight="bold" tintColor={fg} />
        </Pressable>
      )}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      {body}
    </Pressable>
  );
}

// ─── Depth ───────────────────────────────────────────────────────────────────

/** Three dots, filled up to `level` (1-based). */
export function DepthDots({ level }: { level: number }) {
  const theme = useTheme();
  return (
    <View style={styles.dots} accessibilityLabel={`Level ${level} of ${MAX_FOLDER_DEPTH}`}>
      {Array.from({ length: MAX_FOLDER_DEPTH }, (_, i) => (
        <View
          key={i}
          style={[styles.dot, { backgroundColor: i < level ? theme.sage : "transparent", borderColor: theme.sage }]}
        />
      ))}
    </View>
  );
}

// ─── Headers ─────────────────────────────────────────────────────────────────

/** Large Caprasimo title with an optional subtitle node, for screen tops. */
export function ScreenTitle({ title, children }: { title: string; children?: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.screenTitle}>
      <Text style={[type.largeTitle, { color: theme.text }]} numberOfLines={2} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

export function SectionTitle({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[type.section, { color: theme.text }]} accessibilityRole="header">
        {title}
      </Text>
      {action ?? (!!detail && <Text style={[type.meta, { color: theme.muted }]}>{detail}</Text>)}
    </View>
  );
}

/** Small uppercase group label (Settings, sheets). */
export function GroupLabel({ children }: { children: string }) {
  const theme = useTheme();
  return <Text style={[styles.groupLabel, { color: theme.muted }]}>{children.toUpperCase()}</Text>;
}

/** Sheet top: ✕ on the left, title in the centre, primary pill on the right. */
export function SheetHeader({
  title,
  subtitle,
  onClose,
  action,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  action?: { label: string; onPress: () => void; disabled?: boolean };
}) {
  const theme = useTheme();
  return (
    <View style={styles.sheetHeaderWrap}>
      <View style={styles.sheetHeader}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={[styles.closeButton, { backgroundColor: theme.surface }]}
        >
          <SymbolView name="xmark" size={14} weight="bold" tintColor={theme.text} />
        </Pressable>
        <Text style={[type.sheetTitle, styles.sheetTitle, { color: theme.text }]} numberOfLines={1}>
          {title}
        </Text>
        {action ? (
          <PillButton label={action.label} onPress={action.onPress} disabled={action.disabled} />
        ) : (
          <View style={styles.closeButton} />
        )}
      </View>
      {!!subtitle && (
        <Text style={[type.meta, styles.sheetSubtitle, { color: theme.muted }]} numberOfLines={2}>
          {subtitle}
        </Text>
      )}
    </View>
  );
}

// ─── Buttons & rows ──────────────────────────────────────────────────────────

export function PillButton({
  label,
  onPress,
  disabled,
  icon,
  variant = "accent",
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: SymbolName;
  variant?: "accent" | "surface" | "sage";
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const bg = variant === "accent" ? theme.accent : variant === "sage" ? theme.sageChip : theme.surface;
  const fg = variant === "accent" ? theme.accentText : variant === "sage" ? theme.sageInk : theme.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.pill,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {icon && <SymbolView name={icon} size={14} weight="bold" tintColor={fg} />}
      <Text style={[type.button, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

/** Dashed "New folder" style row. */
export function DashedRow({ icon, label, onPress, style }: { icon: SymbolName; label: string; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.dashedRow, { borderColor: theme.dashed, opacity: pressed ? 0.6 : 1 }, style]}
    >
      <SymbolView name={icon} size={18} tintColor={theme.muted} />
      <Text style={[type.label, { color: theme.muted, fontSize: 15 }]}>{label}</Text>
    </Pressable>
  );
}

/** Sage info pill, e.g. "Deepest level — this folder holds videos only." */
export function InfoPill({ icon = "info.circle", children, style }: { icon?: SymbolName; children: string; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return (
    <View style={[styles.infoPill, { backgroundColor: theme.sageSoft }, style]}>
      <SymbolView name={icon} size={15} tintColor={theme.sageInk} />
      <Text style={[type.metaStrong, { color: theme.sageInk, flex: 1 }]}>{children}</Text>
    </View>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <Text style={[type.section, { color: theme.text, textAlign: "center" }]}>{title}</Text>
      {!!body && <Text style={[type.body, { color: theme.muted, textAlign: "center" }]}>{body}</Text>}
    </View>
  );
}

// ─── Segmented control (native SwiftUI) ─────────────────────────────────────

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const theme = useTheme();
  return (
    <Host matchContents={{ vertical: true }} style={{ width: "100%" }} colorScheme={theme.scheme}>
      <Picker
        selection={value}
        onSelectionChange={(v) => onChange(v as T)}
        modifiers={[pickerStyle("segmented"), tint(theme.accent)]}
      >
        {options.map((o) => (
          <SwiftText key={o.value} modifiers={[tag(o.value)]}>
            {o.label}
          </SwiftText>
        ))}
      </Picker>
    </Host>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  chipMd: { paddingHorizontal: 13, paddingVertical: 8, gap: 6 },
  chipTextMd: { fontFamily: fonts.bold, fontSize: 13.5 },
  dots: { flexDirection: "row", gap: 4 },
  dot: { width: 7, height: 7, borderRadius: 4, borderWidth: 1.5 },
  screenTitle: { paddingHorizontal: GUTTER, paddingTop: 4, paddingBottom: 12, gap: 4 },
  section: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: GUTTER,
    marginTop: 24,
    marginBottom: 10,
  },
  groupLabel: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.6, marginHorizontal: GUTTER + 4, marginTop: 22, marginBottom: 8 },
  sheetHeaderWrap: { paddingTop: 18, paddingHorizontal: GUTTER, paddingBottom: 8, gap: 6 },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  sheetTitle: { flex: 1, textAlign: "center" },
  sheetSubtitle: { textAlign: "center" },
  closeButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
  },
  dashedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: radius.card,
    borderWidth: 2,
    borderStyle: "dashed",
  },
  infoPill: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderRadius: radius.pill },
  empty: { alignItems: "center", marginTop: 40, paddingHorizontal: 32, gap: 6 },
});
