import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, LogBox, View } from "react-native";
import { authStorage, convex } from "@/lib/convex";
import { useTheme } from "@/lib/theme";

// The Convex client console.errors every failed server call. Wrong-password /
// unknown-email / duplicate-account failures are expected and already shown on
// the sign-in screen, so keep them out of the dev LogBox. Other errors still show.
LogBox.ignoreLogs([
  /\[CONVEX A\(auth:signIn\)\][\s\S]*(InvalidAccountId|InvalidSecret|TooManyFailedAttempts|Invalid password|already exists)/,
]);

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
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}
