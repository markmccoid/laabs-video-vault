import {
  coreRadius,
  distanceToNorm,
  normRadius,
  orbitRadius,
  orbitVelocity,
  RATE_MAX,
  RATE_MIN,
  rateAtDistance,
  rateToNorm,
  snapRate,
  wellBand,
  wellBandLabel,
  wellRates,
  type WellBand,
} from "@lvv/core";
import * as Haptics from "expo-haptics";
import { memo, useCallback, useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { GestureDetector, GestureHandlerRootView, usePanGesture } from "react-native-gesture-handler";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { fonts, radius, type, useTheme } from "@/lib/theme";

/**
 * Gravity-well speed picker (trial; Settings → Player → Speed picker).
 * Each rate is an orbit: drag outward to slow down, inward to speed up, and
 * the satellite orbits faster the faster the rate. Tap the core for 1.0×.
 *
 * Drawn with plain Views (no SVG) so it needs no extra native module; all
 * motion runs on the UI thread.
 */

/** The well is its own dark "space" in both themes. */
const SPACE = {
  bg: "#0c0c0f",
  rim: "#3f3f46",
  ring: "#52525b",
  core: "#18181b",
  label: "#a1a1aa",
  text: "#f4f4f5",
} as const;

const BAND_COLOR: Record<WellBand, string> = {
  slow: "#38bdf8",
  normal: "#f4f4f5",
  brisk: "#fbbf24",
  turbo: "#ef4444",
};

function bandColor(rate: number): string {
  "worklet";
  return BAND_COLOR[wellBand(rate)];
}

const rateLabel = (rate: number) => `${rate.toFixed(1)}×`;

const TRAIL = 8;
const SNAP = { damping: 16, stiffness: 240, mass: 0.5 };

type WellProps = {
  value: number;
  /** Fires on every 0.1× detent while dragging, so the video follows live. */
  onChange: (rate: number) => void;
  /** The satellite orbits only while the video plays. */
  playing?: boolean;
  size?: number;
  haptics?: boolean;
};

export function GravityWell({ value, onChange, playing = true, size = 280, haptics = true }: WellProps) {
  const c = size / 2;
  const core = coreRadius(size);
  const current = snapRate(value);

  const speed = useSharedValue(current);
  const norm = useSharedValue(rateToNorm(current));
  const angle = useSharedValue(-Math.PI / 2);
  const dragging = useSharedValue(false);
  /** The touch started on the core and hasn't left it: a tap resets to 1.0×. */
  const onCore = useSharedValue(false);
  const playingSV = useSharedValue(playing);
  /** 0 → 1 while a finger holds the satellite (it swells). */
  const grab = useSharedValue(0);

  // Follow outside changes (another picker, the default), but never fight the
  // finger: our own onChange comes back here as `value` mid-drag.
  useEffect(() => {
    if (dragging.value || speed.value === current) return;
    speed.value = current;
    norm.value = withSpring(rateToNorm(current), SNAP);
  }, [current, dragging, speed, norm]);

  useEffect(() => {
    playingSV.value = playing;
  }, [playing, playingSV]);

  const commit = useCallback(
    (next: number) => {
      if (haptics) {
        const done =
          next === 1
            ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            : next === RATE_MIN || next === RATE_MAX
              ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              : Haptics.selectionAsync();
        done.catch(() => {});
      }
      onChange(next);
    },
    [haptics, onChange],
  );

  useFrameCallback((frame) => {
    if (dragging.value || !playingSV.value) return;
    const dt = Math.min(0.05, (frame.timeSincePreviousFrame ?? 16) / 1000);
    angle.value = (angle.value + orbitVelocity(speed.value) * dt) % (Math.PI * 2);
  });

  const track = (x: number, y: number) => {
    "worklet";
    const dx = x - c;
    const dy = y - c;
    const dist = Math.hypot(dx, dy);
    if (onCore.value) {
      if (dist <= core) return;
      onCore.value = false; // slid off the core: now it's a drag
    }
    if (!dragging.value) {
      dragging.value = true;
      grab.value = withSpring(1, SNAP);
    }
    angle.value = Math.atan2(dy, dx);
    norm.value = distanceToNorm(dist, size);
    const next = rateAtDistance(dist, size);
    if (next !== speed.value) {
      speed.value = next;
      scheduleOnRN(commit, next);
    }
  };

  const pan = usePanGesture({
    minDistance: 0,
    shouldCancelWhenOutside: false,
    onBegin: (e) => {
      "worklet";
      onCore.value = Math.hypot(e.x - c, e.y - c) <= core;
      track(e.x, e.y);
    },
    onUpdate: (e) => {
      "worklet";
      track(e.x, e.y);
    },
    onFinalize: () => {
      "worklet";
      // A still tap never activates the pan, so it finalizes as "canceled":
      // don't gate the core reset on success.
      if (onCore.value && speed.value !== 1) {
        speed.value = 1;
        scheduleOnRN(commit, 1);
      }
      onCore.value = false;
      dragging.value = false;
      grab.value = withSpring(0, SNAP);
      // Settle the satellite onto the exact orbit of the chosen rate.
      norm.value = withSpring(rateToNorm(speed.value), SNAP);
    },
  });

  const tetherStyle = useAnimatedStyle(() => ({
    width: normRadius(norm.value, size),
    backgroundColor: bandColor(speed.value),
    transform: [{ rotate: `${angle.value}rad` }],
  }));

  const satelliteStyle = useAnimatedStyle(() => {
    const r = normRadius(norm.value, size);
    return {
      transform: [
        { translateX: c + Math.cos(angle.value) * r - SAT / 2 },
        { translateY: c + Math.sin(angle.value) * r - SAT / 2 },
        { scale: 1 + grab.value * 0.3 },
      ],
    };
  });
  const satelliteColor = useAnimatedStyle(() => ({ backgroundColor: bandColor(speed.value) }));

  // The highlighted orbit glides between rings rather than jumping.
  const activeRing = useAnimatedStyle(() => {
    const r = withSpring(orbitRadius(speed.value, size), SNAP);
    return {
      width: r * 2,
      height: r * 2,
      borderRadius: r,
      left: c - r,
      top: c - r,
      borderColor: bandColor(speed.value),
    };
  });

  const coreRing = useAnimatedStyle(() => ({ borderColor: bandColor(speed.value) }));

  const r1 = orbitRadius(1, size);

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Playback speed"
      accessibilityHint="Drag outward to slow down, inward to speed up. Tap the center for normal speed."
      accessibilityValue={{ min: RATE_MIN, max: RATE_MAX, now: current, text: rateLabel(current) }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => {
        const next = snapRate(current + (e.nativeEvent.actionName === "increment" ? 0.1 : -0.1));
        if (next !== current) commit(next);
      }}
      style={{ alignItems: "center", gap: 12 }}
    >
      <GestureDetector gesture={pan}>
        <View style={[styles.well, { width: size, height: size, borderRadius: size / 2 }]}>
          {wellRates().map((r) => (
            <Ring key={r} rate={r} size={size} />
          ))}
          <Animated.View pointerEvents="none" style={[styles.ring, styles.activeRing, activeRing]} />

          <Mark text={rateLabel(RATE_MIN)} y={c - orbitRadius(RATE_MIN, size) - 15} />
          <Mark text={rateLabel(1)} y={c - r1 - 15} color={SPACE.text} />
          <Mark text={rateLabel(RATE_MAX)} y={c - orbitRadius(RATE_MAX, size) - 15} color={BAND_COLOR.turbo} />

          <Animated.View pointerEvents="none" style={[styles.tether, { left: c, top: c - 0.5 }, tetherStyle]} />
          {Array.from({ length: TRAIL }, (_, i) => (
            <TrailDot key={i} index={i} size={size} angle={angle} norm={norm} speed={speed} />
          ))}

          <Animated.View
            pointerEvents="none"
            style={[styles.core, { width: core * 2, height: core * 2, borderRadius: core, left: c - core, top: c - core }, coreRing]}
          >
            <Text style={styles.coreText}>{rateLabel(current)}</Text>
          </Animated.View>

          <Animated.View pointerEvents="none" style={[styles.satellite, satelliteStyle]}>
            <Animated.View style={[styles.satGlow, satelliteColor]} />
            <Animated.View style={[styles.satBody, satelliteColor]}>
              <View style={styles.satDot} />
            </Animated.View>
          </Animated.View>
        </View>
      </GestureDetector>

      <View style={styles.pill}>
        <View style={[styles.pillDot, { backgroundColor: BAND_COLOR[wellBand(current)] }]} />
        <Text style={styles.pillText}>
          {rateLabel(current)} · {wellBandLabel(current)}
        </Text>
      </View>
    </View>
  );
}

const SAT = 22;

const Ring = memo(function Ring({ rate, size }: { rate: number; size: number }) {
  const r = orbitRadius(rate, size);
  const normal = rate === 1;
  return (
    <View
      pointerEvents="none"
      style={[
        styles.ring,
        {
          width: r * 2,
          height: r * 2,
          borderRadius: r,
          left: size / 2 - r,
          top: size / 2 - r,
          borderColor: normal ? "rgba(255,255,255,0.4)" : "rgba(113,113,122,0.35)",
          borderStyle: normal ? "dashed" : "solid",
        },
      ]}
    />
  );
});

function Mark({ text, y, color = SPACE.label }: { text: string; y: number; color?: string }) {
  return (
    <Text pointerEvents="none" style={[styles.mark, { top: y, color }]}>
      {text}
    </Text>
  );
}

const TrailDot = memo(function TrailDot({
  index,
  size,
  angle,
  norm,
  speed,
}: {
  index: number;
  size: number;
  angle: SharedValue<number>;
  norm: SharedValue<number>;
  speed: SharedValue<number>;
}) {
  const fade = 1 - (index + 1) / (TRAIL + 1);
  const d = Math.max(3, fade * 11);
  const style = useAnimatedStyle(() => {
    const r = normRadius(norm.value, size);
    // Faster rates stretch the comet tail.
    const a = angle.value - (index + 1) * (0.08 + speed.value * 0.045);
    return {
      backgroundColor: bandColor(speed.value),
      transform: [
        { translateX: size / 2 + Math.cos(a) * r - d / 2 },
        { translateY: size / 2 + Math.sin(a) * r - d / 2 },
      ],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", width: d, height: d, borderRadius: d / 2, opacity: fade * 0.55 }, style]}
    />
  );
});

/**
 * The player's speed pill when the gravity well is the chosen picker: shows
 * the rate and opens the well in a sheet.
 */
export function GravityWellButton({ rate, onChange, playing }: { rate: number; onChange: (rate: number) => void; playing: boolean }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Playback speed ${rateLabel(rate)}`}
        style={({ pressed }) => [styles.button, { backgroundColor: theme.surface, opacity: pressed ? 0.7 : 1 }]}
      >
        <Text style={[styles.buttonText, { color: theme.text }]}>{rateLabel(rate)}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        {/* Gestures inside an RN Modal need their own root on iOS. */}
        <GestureHandlerRootView style={{ flex: 1 }}>
          <Pressable style={[styles.backdrop, { backgroundColor: theme.scrim }]} onPress={() => setOpen(false)} accessibilityLabel="Close">
            <Pressable style={[styles.sheet, { backgroundColor: theme.card }]} onPress={() => {}}>
              {/* Title and rate are centred together, above the well where a
                  finger dragging in it doesn't cover them. The rate sits in a
                  slot sized by an invisible "8.8×" (the widest label), so the
                  title never shifts as the rate changes. */}
              <View style={styles.header}>
                <Text style={[type.sheetTitle, styles.headerText, { color: theme.text }]}>Speed</Text>
                <View>
                  <Text style={[styles.headerText, styles.headerRate, { opacity: 0 }]} aria-hidden>
                    8.8×
                  </Text>
                  <Text
                    style={[styles.headerText, styles.headerRate, styles.headerRateValue, { color: theme.accent }]}
                    accessibilityLiveRegion="polite"
                    accessibilityLabel={`${rateLabel(rate)} speed`}
                  >
                    {rateLabel(rate)}
                  </Text>
                </View>
              </View>
              <GravityWell value={rate} onChange={onChange} playing={playing} />
              <Text style={[type.meta, { color: theme.muted, textAlign: "center" }]}>
                Drag outward to slow down, inward to speed up.{"\n"}Tap the center for 1.0×.
              </Text>
              <Pressable
                onPress={() => setOpen(false)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.done, { backgroundColor: theme.accent, opacity: pressed ? 0.8 : 1 }]}
              >
                <Text style={[type.label, { color: theme.accentText, fontSize: 15 }]}>Done</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </GestureHandlerRootView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  well: { backgroundColor: SPACE.bg, borderWidth: 1, borderColor: SPACE.rim, overflow: "hidden" },
  ring: { position: "absolute", borderWidth: StyleSheet.hairlineWidth * 2 },
  activeRing: { borderWidth: 1.75 },
  mark: { position: "absolute", left: 0, right: 0, textAlign: "center", fontFamily: fonts.semibold, fontSize: 10, opacity: 0.8 },
  tether: { position: "absolute", height: 1, opacity: 0.3, transformOrigin: "left center" },
  core: { position: "absolute", backgroundColor: SPACE.core, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  coreText: { color: "#fff", fontFamily: fonts.bold, fontSize: 14, fontVariant: ["tabular-nums"] },
  satellite: { position: "absolute", left: 0, top: 0, width: SAT, height: SAT, alignItems: "center", justifyContent: "center" },
  satGlow: { position: "absolute", width: SAT + 8, height: SAT + 8, borderRadius: (SAT + 8) / 2, opacity: 0.22 },
  satBody: { width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  satDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: SPACE.bg },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: SPACE.bg,
    borderWidth: 1,
    borderColor: "#27272a",
  },
  pillDot: { width: 7, height: 7, borderRadius: 4 },
  pillText: { color: "#e4e4e7", fontFamily: fonts.semibold, fontSize: 12, fontVariant: ["tabular-nums"] },
  button: { width: 64, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  buttonText: { fontFamily: fonts.semibold, fontSize: 15, fontVariant: ["tabular-nums"] },
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  headerText: { fontSize: 28, lineHeight: 34 },
  headerRate: { fontFamily: fonts.bold, fontVariant: ["tabular-nums"] },
  headerRateValue: { position: "absolute", left: 0, top: 0 },
  sheet: { borderRadius: radius.lg, padding: 20, gap: 14, alignItems: "center", width: "100%", maxWidth: 360 },
  done: { alignSelf: "stretch", height: 48, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
});
