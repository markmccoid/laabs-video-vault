import { Stack } from "expo-router";
import { useToast } from "@/components/Toast";
import { useShareBridge } from "@/lib/shareBridge";
import { useTheme } from "@/lib/theme";

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export default function AppLayout() {
  const theme = useTheme();
  const toast = useToast();
  useShareBridge(({ added, dropped }) => {
    const parts = [added && `Added ${plural(added, "shared video")}`, dropped && `${plural(dropped, "link")} couldn't be added`];
    toast.show(parts.filter(Boolean).join(" · "));
  });
  return (
    <>
    <Stack
      screenOptions={{
        headerTintColor: theme.text,
        contentStyle: { backgroundColor: theme.bg },
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <Stack.Screen name="index" options={{ title: "Library", headerLargeTitle: true }} />
      <Stack.Screen name="inbox" options={{ title: "Inbox" }} />
      <Stack.Screen name="just-added" options={{ title: "Just Added" }} />
      <Stack.Screen name="folder/[id]" options={{ title: "" }} />
      <Stack.Screen name="tag/[id]" options={{ title: "" }} />
      <Stack.Screen name="trash" options={{ title: "Trash" }} />
      <Stack.Screen name="video/[id]" options={{ title: "" }} />
      <Stack.Screen
        name="move"
        options={{ presentation: "formSheet", sheetAllowedDetents: [0.6, 1], sheetGrabberVisible: true, title: "Move to" }}
      />
      <Stack.Screen
        name="tag-picker"
        options={{ presentation: "formSheet", sheetAllowedDetents: [0.6, 1], sheetGrabberVisible: true, title: "Tags" }}
      />
    </Stack>
    {toast.element}
    </>
  );
}
