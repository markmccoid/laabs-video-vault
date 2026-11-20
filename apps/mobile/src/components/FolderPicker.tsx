import { canCreateFolderUnder, flattenFolderTree } from "@lvv/core";
import { useMutation } from "convex/react";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { DashedRow, InfoPill, PillButton } from "@/components/ui";
import { api, type Id } from "@/lib/api";
import type { useFolders } from "@/lib/folders";
import { attempt } from "@/lib/prompt";
import { fonts, GUTTER, radius, type, useTheme } from "@/lib/theme";

/** "root" = Inbox (for videos) or Top level (for folders). */
export type PickerValue = Id<"folders"> | "root";

type Props = {
  data: ReturnType<typeof useFolders>;
  value: PickerValue | null;
  onChange: (value: PickerValue) => void;
  /** Gets the "Current" badge. */
  current?: PickerValue;
  rootLabel?: string;
  rootIcon?: "tray" | "square.stack.3d.up";
  isDisabled?: (id: Id<"folders">) => boolean;
  /** Offer "New folder in {selected}" with an inline field. */
  allowCreate?: boolean;
};

const INDENT = 22;

/** The full folder tree as a radio list (Move sheet, Add sheet). */
export function FolderPicker({
  data,
  value,
  onChange,
  current,
  rootLabel = "Inbox",
  rootIcon = "tray",
  isDisabled,
  allowCreate = true,
}: Props) {
  const theme = useTheme();
  const rows = flattenFolderTree(data.tree);
  const selectedFolder = value && value !== "root" ? data.byId.get(value) : undefined;

  return (
    <View>
      <PickerRow
        label={rootLabel}
        icon={rootIcon}
        iconColor={theme.muted}
        level={0}
        selected={value === "root"}
        current={current === "root"}
        onPress={() => onChange("root")}
      />
      {rows.map((f) => (
        <PickerRow
          key={f._id}
          label={f.name}
          icon="folder.fill"
          iconColor={data.tone(f._id).icon}
          level={f.depth}
          selected={value === f._id}
          current={current === f._id}
          disabled={isDisabled?.(f._id)}
          onPress={() => onChange(f._id)}
        />
      ))}
      {allowCreate && (
        <NewFolderInline
          key={value ?? "none"}
          parent={selectedFolder}
          onCreated={(id) => onChange(id)}
        />
      )}
    </View>
  );
}

function PickerRow({
  label,
  icon,
  iconColor,
  level,
  selected,
  current,
  disabled,
  onPress,
}: {
  label: string;
  icon: "tray" | "folder.fill" | "square.stack.3d.up";
  iconColor: string;
  level: number;
  selected: boolean;
  current: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={current ? `${label}, current` : label}
      style={[
        styles.row,
        { backgroundColor: selected ? theme.accentSoft : "transparent", opacity: disabled ? 0.35 : 1 },
      ]}
    >
      {Array.from({ length: level }, (_, i) => (
        <View key={i} style={styles.guideCell}>
          <View style={[styles.guide, { backgroundColor: theme.divider }]} />
        </View>
      ))}
      <SymbolView name={icon} size={17} tintColor={iconColor} />
      <Text style={[type.label, styles.label, { color: theme.text }]} numberOfLines={1}>
        {label}
      </Text>
      {current && (
        <View style={[styles.badge, { backgroundColor: theme.surface }]}>
          <Text style={[type.chip, { color: theme.muted }]}>Current</Text>
        </View>
      )}
      <View
        style={[
          styles.radio,
          selected ? { backgroundColor: theme.accent, borderColor: theme.accent } : { borderColor: theme.dashed },
        ]}
      >
        {selected && <SymbolView name="checkmark" size={11} weight="heavy" tintColor={theme.accentText} />}
      </View>
    </Pressable>
  );
}

/** Dashed button that turns into a name field; creating a folder selects it. */
function NewFolderInline({
  parent,
  onCreated,
}: {
  parent: { _id: Id<"folders">; name: string; depth: number } | undefined;
  onCreated: (id: Id<"folders">) => void;
}) {
  const theme = useTheme();
  const create = useMutation(api.folders.create);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");

  if (!canCreateFolderUnder(parent).ok) {
    return (
      <InfoPill style={styles.below}>{`“${parent?.name}” is at the deepest level, so it can't hold folders.`}</InfoPill>
    );
  }

  const where = parent ? `New folder in ${parent.name}` : "New folder";

  if (!editing) {
    return <DashedRow icon="folder.badge.plus" label={where} onPress={() => setEditing(true)} style={styles.below} />;
  }

  const add = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    let id: Id<"folders"> | undefined;
    const ok = await attempt("Couldn't create folder", async () => {
      id = await create({ name: trimmed, parentId: parent?._id });
    });
    if (ok && id) {
      setName("");
      setEditing(false);
      onCreated(id);
    }
  };

  return (
    <View style={[styles.inline, styles.below, { borderColor: theme.accentRing, backgroundColor: theme.bg }]}>
      <SymbolView name="folder.badge.plus" size={18} tintColor={theme.accent} />
      <TextInput
        autoFocus
        value={name}
        onChangeText={setName}
        onSubmitEditing={add}
        returnKeyType="done"
        placeholder={where}
        placeholderTextColor={theme.muted}
        style={[styles.input, { color: theme.text }]}
      />
      <PillButton label="Add" onPress={add} disabled={!name.trim()} style={{ minHeight: 34, paddingHorizontal: 14 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    marginHorizontal: GUTTER - 8,
    paddingHorizontal: 10,
    borderRadius: radius.md,
  },
  guideCell: { width: INDENT - 10, alignSelf: "stretch", justifyContent: "center", alignItems: "center" },
  guide: { width: 2, alignSelf: "stretch", marginLeft: -6 },
  label: { flex: 1, fontSize: 15 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  below: { marginHorizontal: GUTTER, marginTop: 12 },
  inline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 52,
    paddingLeft: 16,
    paddingRight: 8,
    borderRadius: radius.pill,
    borderWidth: 2,
  },
  input: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, paddingVertical: 10 },
});
