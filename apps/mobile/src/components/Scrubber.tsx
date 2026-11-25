import { formatDuration } from "@lvv/core";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { GestureDetector, useExclusiveGestures, usePanGesture, useTapGesture } from "react-native-gesture-handler";
import { type, useTheme } from "@/lib/theme";

type Props = {
  /** Current playback position in seconds. */
  position: number;
  /** Video length in seconds; 0 when unknown (the bar is then inert). */
  duration: number;
  onSeek: (seconds: number) => void;
  /** Drawn over the video (full screen): light track and times. */
  onVideo?: boolean;
};

/**
 * The player's progress bar. Tap anywhere on it to jump there, or drag to
 * scrub (the time label follows your finger and the seek happens on release).
 * Horizontal drags only, so vertical swipes still scroll the screen.
 */
export function Scrubber({ position, duration, onSeek, onVideo = false }: Props) {
  const theme = useTheme();
  const trackColor = onVideo ? "rgba(255,255,255,0.3)" : theme.surface;
  const timeColor = onVideo ? "rgba(255,255,255,0.85)" : theme.muted;
  const [width, setWidth] = useState(0);
  // Where the finger is while dragging.
  const [drag, setDrag] = useState<number | null>(null);
  // Where we last seeked to, shown until the player reports a nearby time, so
  // the bar doesn't snap back for the second before the next time update.
  const [held, setHeld] = useState<number | null>(null);

  useEffect(() => {
    if (held === null) return;
    if (Math.abs(position - held) < 2) return setHeld(null);
    const timer = setTimeout(() => setHeld(null), 2500);
    return () => clearTimeout(timer);
  }, [position, held]);

  const enabled = duration > 0 && width > 0;
  const toSeconds = (x: number) => Math.max(0, Math.min(duration, (x / width) * duration));
  const commit = (seconds: number) => {
    setHeld(seconds);
    onSeek(seconds);
  };

  const pan = usePanGesture({
    runOnJS: true,
    enabled,
    activeOffsetX: [-6, 6],
    failOffsetY: [-12, 12],
    hitSlop: { top: 16, bottom: 16 },
    onActivate: (e) => setDrag(toSeconds(e.x)),
    onUpdate: (e) => setDrag(toSeconds(e.x)),
    onDeactivate: (e) => {
      setDrag(null);
      if (!e.canceled) commit(toSeconds(e.x));
    },
    onFinalize: () => setDrag(null),
  });

  const tap = useTapGesture({
    runOnJS: true,
    enabled,
    hitSlop: { top: 16, bottom: 16 },
    onDeactivate: (e) => {
      if (!e.canceled) commit(toSeconds(e.x));
    },
  });

  const gesture = useExclusiveGestures(pan, tap);

  const shown = drag ?? held ?? position;
  const pct = duration ? Math.min(100, (shown / duration) * 100) : 0;
  const scrubbing = drag !== null;

  return (
    <View style={styles.wrap}>
      <GestureDetector gesture={gesture}>
        <View
          style={styles.hit}
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Playback position"
          accessibilityValue={{ text: `${formatDuration(shown)} of ${duration ? formatDuration(duration) : "unknown"}` }}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(e) => {
            if (!duration) return;
            const step = e.nativeEvent.actionName === "increment" ? 10 : -10;
            commit(Math.max(0, Math.min(duration, shown + step)));
          }}
        >
          <View style={[styles.track, scrubbing && styles.trackActive, { backgroundColor: trackColor }]}>
            <View style={[styles.fill, { backgroundColor: theme.accent, width: `${pct}%` }]} />
          </View>
          {enabled && (
            <View
              pointerEvents="none"
              style={[
                styles.thumb,
                scrubbing && styles.thumbActive,
                { backgroundColor: theme.accent, left: `${pct}%` },
              ]}
            />
          )}
        </View>
      </GestureDetector>
      <View style={styles.times}>
        <Text style={[type.metaStrong, { color: scrubbing ? theme.accent : timeColor }]}>{formatDuration(shown)}</Text>
        <Text style={[type.metaStrong, { color: timeColor }]}>{duration ? formatDuration(duration) : "–:––"}</Text>
      </View>
    </View>
  );
}

const THUMB = 12;
const THUMB_ACTIVE = 18;

const styles = StyleSheet.create({
  wrap: { gap: 2, marginTop: -6 },
  // Taller than the track so it's easy to grab; the track sits centred inside.
  hit: { height: 20, justifyContent: "center" },
  track: { height: 4, borderRadius: 2, overflow: "hidden" },
  trackActive: { height: 6, borderRadius: 3 },
  fill: { height: "100%", borderRadius: 2 },
  thumb: {
    position: "absolute",
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    marginLeft: -THUMB / 2,
    top: (20 - THUMB) / 2,
  },
  thumbActive: {
    width: THUMB_ACTIVE,
    height: THUMB_ACTIVE,
    borderRadius: THUMB_ACTIVE / 2,
    marginLeft: -THUMB_ACTIVE / 2,
    top: (20 - THUMB_ACTIVE) / 2,
  },
  times: { flexDirection: "row", justifyContent: "space-between" },
});
