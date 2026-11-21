import { wordCount } from "@lvv/core";
import { useMutation } from "convex/react";
import { SymbolView } from "expo-symbols";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { api, type Id } from "@/lib/api";
import { fonts, radius, type, useTheme } from "@/lib/theme";

const SAVE_DELAY_MS = 600;

type Status = "idle" | "saving" | "saved" | "error";

type Props = {
  videoId: Id<"videos">;
  /** Server copy of the notes. */
  notes: string;
  /** Called when the field gains focus, so the screen can scroll it above the keyboard. */
  onFocus?: () => void;
};

/** "My notes" (2i): free-form notes that autosave. Timestamps live in TimestampsCard. */
export function NotesCard({ videoId, notes, onFocus }: Props) {
  const theme = useTheme();
  const save = useMutation(api.videos.updateNotes);
  const [text, setText] = useState(notes);
  const [focused, setFocused] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(text);
  latest.current = text;

  // Take edits from other devices while this field isn't being edited.
  useEffect(() => {
    if (!focused && !pending.current) setText(notes);
  }, [notes, focused]);

  const flush = async () => {
    if (pending.current) clearTimeout(pending.current);
    pending.current = null;
    const value = latest.current;
    if (value === notes) {
      setStatus((s) => (s === "saving" ? "saved" : s));
      return;
    }
    setStatus("saving");
    try {
      await save({ videoId, notes: value });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  };

  // Save whatever is pending when leaving the screen.
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => void (pending.current && flushRef.current()), []);

  const change = (value: string) => {
    setText(value);
    setStatus("saving");
    if (pending.current) clearTimeout(pending.current);
    pending.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
  };

  const statusText =
    status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "error" ? "Couldn't save" : "Private to you";
  const words = wordCount(text);

  return (
    <View style={[styles.card, { backgroundColor: theme.sageSoft }]}>
      <View style={styles.header}>
        <SymbolView name="square.and.pencil" size={17} tintColor={theme.sageInk} />
        <Text style={[type.sheetTitle, { color: theme.text, flex: 1, fontSize: 17 }]}>My notes</Text>
        <Text style={[type.metaStrong, { color: status === "error" ? theme.danger : theme.sageInk }]}>{statusText}</Text>
      </View>
      <TextInput
        multiline
        value={text}
        onChangeText={change}
        onFocus={() => {
          setFocused(true);
          onFocus?.();
        }}
        onBlur={() => {
          setFocused(false);
          void flush();
        }}
        placeholder="Jot down ingredients, measurements, ideas…"
        placeholderTextColor={theme.muted}
        style={[
          styles.input,
          { backgroundColor: theme.bg, color: theme.text, borderColor: focused ? theme.sageRing : "transparent" },
        ]}
      />
      <View style={styles.footer}>
        <Text style={[type.meta, { color: theme.muted }]}>
          {words} {words === 1 ? "word" : "words"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: 14, gap: 10 },
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4 },
  input: {
    minHeight: 120,
    // Grows to here, then scrolls inside, so the caret stays above the keyboard.
    maxHeight: 260,
    borderRadius: 20,
    borderWidth: 2,
    padding: 14,
    paddingTop: 12,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 21,
    textAlignVertical: "top",
  },
  footer: { flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 4 },
});
