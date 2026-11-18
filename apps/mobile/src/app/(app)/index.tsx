import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { Stack } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { AddVideoBar } from "@/components/AddVideoBar";
import { VideoRow } from "@/components/VideoRow";
import { api } from "@/lib/api";
import { useTheme } from "@/lib/theme";

export default function Inbox() {
  const theme = useTheme();
  const { signOut } = useAuthActions();
  const videos = useQuery(api.videos.listByFolder, {});

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => void signOut()} hitSlop={8}>
              <Text style={{ color: theme.accent, fontSize: 16 }}>Sign out</Text>
            </Pressable>
          ),
        }}
      />
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        data={videos ?? []}
        keyExtractor={(v) => v._id}
        renderItem={({ item }) => <VideoRow video={item} />}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        contentContainerStyle={{ paddingBottom: 32 }}
        ListHeaderComponent={<AddVideoBar />}
        ListEmptyComponent={
          videos === undefined ? (
            <ActivityIndicator style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Your Inbox is empty</Text>
              <Text style={[styles.emptyBody, { color: theme.muted }]}>
                Copy a link in YouTube, then tap Paste above.
              </Text>
            </View>
          )
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: "center", marginTop: 60, paddingHorizontal: 32, gap: 6 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyBody: { fontSize: 15, textAlign: "center" },
});
