import { Stack } from "expo-router";
import { useTheme } from "@/lib/theme";

export default function AppLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerTintColor: theme.text,
        contentStyle: { backgroundColor: theme.bg },
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <Stack.Screen name="index" options={{ title: "Library", headerLargeTitle: true }} />
      <Stack.Screen name="inbox" options={{ title: "Inbox" }} />
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
  );
}
