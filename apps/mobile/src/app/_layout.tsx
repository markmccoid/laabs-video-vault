import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { authStorage, convex } from "@/lib/convex";
import { useTheme } from "@/lib/theme";

export default function RootLayout() {
  return (
    <ConvexAuthProvider client={convex} storage={authStorage}>
      <StatusBar style="auto" />
      <RootNavigator />
    </ConvexAuthProvider>
  );
}

function RootNavigator() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const theme = useTheme();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.bg }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
