import { Button, Host, Menu, Text as SwiftText } from "@expo/ui/swift-ui";
import { backgroundOverlay, clipShape, font, foregroundStyle, frame, monospacedDigit } from "@expo/ui/swift-ui/modifiers";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, View } from "react-native";
import { PillButton, type SymbolName } from "@/components/ui";
import { useTheme } from "@/lib/theme";

/** 0.7× to 2.0× in 0.1 steps. */
export const PLAYBACK_RATES = Array.from({ length: 14 }, (_, i) => Math.round((0.7 + i * 0.1) * 10) / 10);

/** Skip lengths offered in Settings; each has a matching numbered SF Symbol. */
export const JUMP_SECONDS = [5, 10, 15, 30, 60];

export const rateLabel = (rate: number) => `${rate.toFixed(1)}×`;

/** Numbered skip icon (e.g. gobackward.15) when SF Symbols has one, else the plain arrow. */
const SYMBOL_JUMPS = new Set([5, 10, 15, 30, 45, 60, 75, 90]);
function jumpSymbol(direction: "back" | "forward", seconds: number): SymbolName {
  const base = direction === "back" ? "gobackward" : "goforward";
  return (SYMBOL_JUMPS.has(seconds) ? `${base}.${seconds}` : base) as SymbolName;
}

/**
 * Speed picker: a native menu of PLAYBACK_RATES. `pill` draws the player's
 * rounded button; `plain` is just the value, for a Settings row.
 */
export function RateMenu({ rate, onChange, variant = "pill" }: { rate: number; onChange: (rate: number) => void; variant?: "pill" | "plain" }) {
  const theme = useTheme();
  // The pill is drawn by SwiftUI so the label stays centred in it (an RN
  // wrapper around the Host lets the text drift when the menu re-renders).
  const look =
    variant === "pill"
      ? [frame({ width: 64, height: 44 }), backgroundOverlay({ color: theme.surface }), clipShape("capsule" as const)]
      : [frame({ height: 44 })];
  return (
    <Host matchContents colorScheme={theme.scheme}>
      <Menu
        label={
          <SwiftText
            modifiers={[
              font({ size: 15, weight: "semibold" }),
              monospacedDigit(),
              foregroundStyle(variant === "pill" ? theme.text : theme.accent),
              ...look,
            ]}
          >
            {rateLabel(rate)}
          </SwiftText>
        }
      >
        {[...PLAYBACK_RATES].reverse().map((r) => (
          <Button key={r} label={rateLabel(r)} systemImage={r === rate ? "checkmark" : undefined} onPress={() => onChange(r)} />
        ))}
      </Menu>
    </Host>
  );
}

type Props = {
  playing: boolean;
  onTogglePlay: () => void;
  rate: number;
  onRateChange: (rate: number) => void;
  jumpBack: number;
  jumpForward: number;
  /** Seek by a signed number of seconds. */
  onJump: (delta: number) => void;
  onOpenInYouTube: () => void;
};

/**
 * Our controls under the player, used when YouTube's own controls are hidden
 * (Settings → Player). Seeking to a point is the Scrubber above.
 */
export function PlayerControls({ playing, onTogglePlay, rate, onRateChange, jumpBack, jumpForward, onJump, onOpenInYouTube }: Props) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.transport}>
        <JumpButton symbol={jumpSymbol("back", jumpBack)} label={`Back ${jumpBack} seconds`} onPress={() => onJump(-jumpBack)} />
        <Pressable
          onPress={onTogglePlay}
          accessibilityRole="button"
          accessibilityLabel={playing ? "Pause" : "Play"}
          style={({ pressed }) => [styles.play, { backgroundColor: theme.accent, opacity: pressed ? 0.8 : 1 }]}
        >
          <SymbolView name={playing ? "pause.fill" : "play.fill"} size={20} tintColor={theme.accentText} />
        </Pressable>
        <JumpButton symbol={jumpSymbol("forward", jumpForward)} label={`Forward ${jumpForward} seconds`} onPress={() => onJump(jumpForward)} />
      </View>

      <RateMenu rate={rate} onChange={onRateChange} />

      <View style={{ flex: 1 }} />

      <PillButton label="YouTube" icon="arrow.up.right.square" variant="surface" onPress={onOpenInYouTube} />
    </View>
  );
}

function JumpButton({ symbol, label, onPress }: { symbol: SymbolName; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => [styles.jump, { opacity: pressed ? 0.5 : 1 }]}
    >
      <SymbolView name={symbol} size={24} tintColor={theme.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: -6 },
  transport: { flexDirection: "row", alignItems: "center", gap: 2 },
  play: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  jump: { width: 40, height: 44, alignItems: "center", justifyContent: "center" },
});
