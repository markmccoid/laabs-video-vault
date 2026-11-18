import { ConvexReactClient } from "convex/react";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const url = process.env.EXPO_PUBLIC_CONVEX_URL;
if (!url) {
  throw new Error(
    "EXPO_PUBLIC_CONVEX_URL is not set. Copy apps/mobile/.env.example to apps/mobile/.env.local (see README).",
  );
}

export const convex = new ConvexReactClient(url, { unsavedChangesWarning: false });

/** Auth tokens live in the iOS Keychain. Convex Auth strips non-alphanumerics from keys. */
export const authStorage =
  Platform.OS === "web"
    ? undefined
    : {
        getItem: SecureStore.getItemAsync,
        setItem: SecureStore.setItemAsync,
        removeItem: SecureStore.deleteItemAsync,
      };
