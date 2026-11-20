import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import Constants from "expo-constants";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import type { ReactNode } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { countLabel, GroupLabel, plural, Segmented, type SymbolName } from "@/components/ui";
import { api } from "@/lib/api";
import { useFolders } from "@/lib/folders";
import { useJustAdded } from "@/lib/justAdded";
import { usePreferences, type LibraryLayout, type ThemePreference } from "@/lib/preferences";
import { useShareSignOut } from "@/lib/shareBridge";
import { GUTTER, type, useTheme } from "@/lib/theme";

/** Settings (2j). */
export default function Settings() {
  const theme = useTheme();
  const prefs = usePreferences();
  const data = useFolders();
  const inbox = useQuery(api.videos.listByFolder, {});
  const trash = useQuery(api.videos.listTrash);
  const justAdded = useJustAdded();
  const signOut = useSignOut();

  const filed = data.tree.reduce((sum, f) => sum + data.count(f._id), 0);
  const total = filed + (inbox?.length ?? 0);
  const appName = Constants.expoConfig?.name ?? "LAABS Video Vault";
  const version = Constants.expoConfig?.version ?? "1.0";

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingBottom: 48 }}>
      <GroupLabel>Appearance</GroupLabel>
      <Group>
        <View style={styles.control}>
          <Text style={[type.label, { color: theme.text, fontSize: 15 }]}>Theme</Text>
          <Segmented<ThemePreference>
            value={prefs.theme}
            onChange={prefs.setTheme}
            options={[
              { value: "system", label: "System" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
        </View>
        <Divider />
        <View style={styles.control}>
          <Text style={[type.label, { color: theme.text, fontSize: 15 }]}>Library layout</Text>
          <Segmented<LibraryLayout>
            value={prefs.libraryLayout === "tree" ? "tree" : "grid"}
            onChange={prefs.setLibraryLayout}
            options={[
              { value: "grid", label: "Grid" },
              { value: "tree", label: "Tree" },
            ]}
          />
        </View>
      </Group>

      <GroupLabel>Library</GroupLabel>
      <Group>
        <Row icon="clock" label="Just added" detail={justAdded ? countLabel(justAdded.length) : undefined} onPress={() => router.push("/just-added")} />
        <Divider />
        <Row icon="trash" label="Trash" detail={trash ? countLabel(trash.length) : undefined} onPress={() => router.push("/trash")} />
      </Group>

      <GroupLabel>Export & import</GroupLabel>
      <Group>
        <Row icon="square.and.arrow.up" label="Export library" detail="JSON · soon" />
        <Divider />
        <Row icon="square.and.arrow.down" label="Import library" detail="From Files · soon" />
      </Group>
      <Text style={[type.meta, styles.note, { color: theme.muted }]}>
        Exports hold folders, tags, links and notes, not the video files.
      </Text>

      <GroupLabel>Adding videos</GroupLabel>
      <Group>
        <View style={styles.explainer}>
          <View style={[styles.iconBadge, { backgroundColor: theme.accentSoft }]}>
            <SymbolView name="square.and.arrow.up" size={18} tintColor={theme.accent} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[type.label, { color: theme.text, fontSize: 15 }]}>Save from YouTube</Text>
            <Text style={[type.meta, { color: theme.muted }]}>
              In YouTube, tap Share, then {appName}. Pick a folder and it's saved without leaving the app.
            </Text>
          </View>
        </View>
      </Group>

      <GroupLabel>Account</GroupLabel>
      <Group>
        <Row icon="rectangle.portrait.and.arrow.right" label="Sign out" destructive onPress={() => void signOut()} chevron={false} />
      </Group>

      <Text style={[type.meta, styles.footer, { color: theme.muted }]}>
        {appName} {version} · {plural(total, "video")} in {plural(data.folders?.length ?? 0, "folder")}
      </Text>
    </ScrollView>
  );
}

function Group({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <View style={[styles.group, { backgroundColor: theme.surface }]}>{children}</View>;
}

function Divider() {
  const theme = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.divider }]} />;
}

function Row({
  icon,
  label,
  detail,
  onPress,
  destructive,
  chevron = true,
}: {
  icon: SymbolName;
  label: string;
  detail?: string;
  onPress?: () => void;
  destructive?: boolean;
  chevron?: boolean;
}) {
  const theme = useTheme();
  const color = destructive ? theme.danger : theme.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: !onPress }}
      style={({ pressed }) => [styles.row, { opacity: !onPress ? 0.5 : pressed ? 0.6 : 1 }]}
    >
      <SymbolView name={icon} size={18} tintColor={destructive ? theme.danger : theme.accent} />
      <Text style={[type.label, { color, flex: 1, fontSize: 15 }]}>{label}</Text>
      {!!detail && <Text style={[type.meta, { color: theme.muted }]}>{detail}</Text>}
      {chevron && onPress && <SymbolView name="chevron.right" size={12} weight="bold" tintColor={theme.muted} />}
    </Pressable>
  );
}

/** Sign out, first sending (or, after a warning, discarding) the Share Queue. */
function useSignOut() {
  const { signOut } = useAuthActions();
  const share = useShareSignOut();
  return async () => {
    const pending = await share.pendingAfterSend();
    if (pending > 0) {
      const ok = await new Promise<boolean>((resolve) =>
        Alert.alert(
          "Shared videos not added yet",
          `${pending} video${pending === 1 ? "" : "s"} you shared couldn't be added (are you offline?). Signing out discards ${pending === 1 ? "it" : "them"}.`,
          [
            { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
            { text: "Sign Out", style: "destructive", onPress: () => resolve(true) },
          ],
        ),
      );
      if (!ok) return;
    }
    await share.teardown();
    await signOut();
  };
}

const styles = StyleSheet.create({
  group: { marginHorizontal: GUTTER, borderRadius: 26, overflow: "hidden" },
  control: { padding: 16, gap: 10 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingHorizontal: 16 },
  note: { marginHorizontal: GUTTER + 4, marginTop: 8 },
  explainer: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  iconBadge: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  footer: { textAlign: "center", marginTop: 28 },
});
