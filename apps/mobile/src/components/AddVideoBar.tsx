import { parseYouTubeUrl } from "@lvv/core";
import { useMutation } from "convex/react";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { api, type Id } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { useTheme } from "@/lib/theme";

type Props = { folderId?: Id<"folders"> };

/** Paste or type a YouTube link and add it to the library. */
export function AddVideoBar({ folderId }: Props) {
  const theme = useTheme();
  const addVideo = useMutation(api.videos.add);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const valid = parseYouTubeUrl(text) !== null;

  const add = async (input: string) => {
    if (!parseYouTubeUrl(input)) {
      Alert.alert("Not a YouTube link", "Paste a link to a YouTube video.");
      return;
    }
    setBusy(true);
    try {
      const result = await addVideo({ input, folderId });
      setText("");
      if (result.status === "duplicate") {
        Alert.alert("Already saved", "This video is already in your library.", [
          { text: "OK", style: "cancel" },
          { text: "Open", onPress: () => router.push(`/video/${result.videoId}`) },
        ]);
      }
    } catch (err) {
      Alert.alert("Couldn't add video", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const pasteAndAdd = async () => {
    const clip = await Clipboard.getStringAsync();
    if (!clip) return;
    setText(clip);
    await add(clip);
  };

  return (
    <View style={[styles.bar, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <TextInput
        style={[styles.input, { color: theme.text }]}
        placeholder="Paste or type a YouTube link"
        placeholderTextColor={theme.muted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        returnKeyType="done"
        value={text}
        onChangeText={setText}
        onSubmitEditing={() => add(text)}
        editable={!busy}
      />
      {busy ? (
        <ActivityIndicator style={styles.action} />
      ) : text ? (
        <Pressable
          style={[styles.button, { backgroundColor: valid ? theme.accent : theme.border }]}
          disabled={!valid}
          onPress={() => add(text)}
        >
          <Text style={[styles.buttonText, { color: theme.accentText }]}>Add</Text>
        </Pressable>
      ) : (
        <Pressable style={[styles.button, { backgroundColor: theme.accent }]} onPress={pasteAndAdd}>
          <Text style={[styles.buttonText, { color: theme.accentText }]}>Paste</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingLeft: 14,
    paddingRight: 6,
    marginHorizontal: 16,
    marginVertical: 12,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 12 },
  action: { paddingHorizontal: 18 },
  button: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 },
  buttonText: { fontWeight: "700", fontSize: 15 },
});
