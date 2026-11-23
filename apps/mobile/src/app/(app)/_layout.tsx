import { Stack } from "expo-router";
import { useToast } from "@/components/Toast";
import { useShareBridge } from "@/lib/shareBridge";
import { fonts, radius, useTheme } from "@/lib/theme";
import { useProgressSync } from "@/lib/watchProgress";

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export default function AppLayout() {
  const theme = useTheme();
  const toast = useToast();
  useProgressSync();
  useShareBridge(({ added, dropped }) => {
    const parts = [added && `Added ${plural(added, "shared video")}`, dropped && `${plural(dropped, "link")} couldn't be added`];
    toast.show(parts.filter(Boolean).join(" · "));
  });

  // Bottom sheets: no native header (each draws ✕ · title · action), large corners.
  const sheet = {
    presentation: "formSheet",
    headerShown: false,
    sheetGrabberVisible: true,
    sheetCornerRadius: radius.sheet,
    contentStyle: { backgroundColor: theme.bg },
  } as const;

  return (
    <>
      <Stack
        screenOptions={{
          headerTintColor: theme.text,
          contentStyle: { backgroundColor: theme.bg },
          headerStyle: { backgroundColor: theme.bg },
          headerShadowVisible: false,
          headerLargeTitleShadowVisible: false,
          headerTitleStyle: { fontFamily: fonts.bold, color: theme.text },
          headerLargeTitleStyle: { fontFamily: fonts.display, color: theme.text },
          headerBackButtonDisplayMode: "minimal",
        }}
      >
        <Stack.Screen name="index" options={{ title: "Library", headerLargeTitle: true }} />
        <Stack.Screen name="inbox" options={{ title: "Inbox" }} />
        <Stack.Screen name="just-added" options={{ title: "Just added" }} />
        <Stack.Screen name="folder/[id]" options={{ title: "" }} />
        <Stack.Screen name="tag/[id]" options={{ title: "" }} />
        <Stack.Screen name="trash" options={{ title: "Trash" }} />
        <Stack.Screen name="settings" options={{ title: "Settings", headerLargeTitle: true }} />
        <Stack.Screen
          name="video/[id]"
          options={{ presentation: "fullScreenModal", headerShown: false, contentStyle: { backgroundColor: theme.bg } }}
        />
        <Stack.Screen name="move" options={{ ...sheet, sheetAllowedDetents: [0.75, 1] }} />
        <Stack.Screen name="tag-picker" options={{ ...sheet, sheetAllowedDetents: [0.6, 1] }} />
        <Stack.Screen name="new-folder" options={{ ...sheet, sheetAllowedDetents: [0.6, 1] }} />
        <Stack.Screen name="add" options={{ ...sheet, sheetAllowedDetents: [1] }} />
      </Stack>
      {toast.element}
    </>
  );
}
