import { Stack } from "expo-router";
import { useTheme } from "@/lib/theme";

export default function AppLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerTintColor: theme.text,
        contentStyle: { backgroundColor: theme.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Inbox", headerLargeTitle: true }} />
      <Stack.Screen name="video/[id]" options={{ title: "", headerBackButtonDisplayMode: "minimal" }} />
    </Stack>
  );
}
