import { useColorScheme } from "react-native";

const light = {
  bg: "#F4F4F6",
  card: "#FFFFFF",
  text: "#111114",
  muted: "#6B6B76",
  border: "#E2E2E8",
  accent: "#D7263D",
  accentText: "#FFFFFF",
  danger: "#C62828",
};

const dark: typeof light = {
  bg: "#0E0E11",
  card: "#1A1A1F",
  text: "#F2F2F5",
  muted: "#9A9AA6",
  border: "#2A2A31",
  accent: "#FF4757",
  accentText: "#FFFFFF",
  danger: "#FF6B6B",
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}
