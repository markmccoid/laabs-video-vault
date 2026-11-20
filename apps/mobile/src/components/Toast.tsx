import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";

/** A brief message pinned above the bottom of the screen. Fades out by itself. */
export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const [key, setKey] = useState(0);
  const show = (text: string) => {
    setMessage(text);
    setKey((k) => k + 1);
  };
  const element = message ? <Toast key={key} message={message} onHidden={() => setMessage(null)} /> : null;
  return { show, element };
}

function Toast({ message, onHidden }: { message: string; onHidden: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(2600),
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]);
    anim.start(({ finished }) => finished && onHidden());
    return () => anim.stop();
  }, [opacity, onHidden]);

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[styles.toast, { opacity, bottom: insets.bottom + 24, backgroundColor: theme.text }]}
    >
      <Text style={[styles.text, { color: theme.bg }]}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    alignSelf: "center",
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
    maxWidth: "90%",
  },
  text: { fontWeight: "600", textAlign: "center" },
});
