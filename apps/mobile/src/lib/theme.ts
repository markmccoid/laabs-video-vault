import { StyleSheet, useColorScheme } from "react-native";

/** Organic design tokens (design_handoff_shelf/README.md). */
export const palette = {
  accent: {
    100: "#fff2eb",
    200: "#ffe1d0",
    300: "#ffc6a5",
    400: "#f6a06b",
    500: "#d67f48",
    600: "#b2622d",
    700: "#8c491a",
    800: "#643312",
    900: "#402310",
    base: "#c67139",
  },
  sage: {
    100: "#f0fae1",
    200: "#e1eecc",
    300: "#ccdbb2",
    400: "#aebf92",
    500: "#8fa073",
    600: "#728157",
    700: "#56633f",
    800: "#3d472b",
    900: "#272e1b",
    base: "#7a8a5e",
  },
  neutral: {
    100: "#f9f4ed",
    200: "#eee7db",
    300: "#dcd3c4",
    400: "#c0b6a5",
    500: "#a19786",
    600: "#82796a",
    700: "#645c50",
    800: "#474238",
    900: "#2e2b25",
  },
} as const;

/** PostScript names of the fonts embedded by the expo-font config plugin (app.json). */
export const fonts = {
  display: "Caprasimo-Regular",
  body: "Figtree-Regular",
  semibold: "Figtree-SemiBold",
  bold: "Figtree-Bold",
} as const;

export const radius = { sm: 8, md: 16, lg: 28, card: 22, sheet: 48, pill: 999 } as const;
export const GUTTER = 20;

export type Tone = "accent" | "sage" | "neutral";

type ToneColors = {
  /** Card fill. */
  fill: string;
  /** Decorative circle on folder cards. */
  circle: string;
  /** Folder icon tint. */
  icon: string;
  /** Icon badge background in list rows. */
  badge: string;
};

const p = palette;

export type Theme = {
  scheme: "light" | "dark";
  bg: string;
  surface: string;
  text: string;
  muted: string;
  divider: string;
  accent: string;
  /** Small accent-coloured text (contrast). */
  accentInk: string;
  accentText: string;
  accentSoft: string;
  accentRing: string;
  highlight: string;
  sage: string;
  sageInk: string;
  sageSoft: string;
  sageChip: string;
  sageRing: string;
  dashed: string;
  danger: string;
  scrim: string;
  tones: Record<Tone, ToneColors>;
  /** Older names still used by a few screens. */
  card: string;
  border: string;
};

const light: Theme = {
  scheme: "light",
  bg: "#f5ead8",
  surface: "#ebddc5",
  text: "#201e1d",
  muted: p.neutral[700],
  divider: "rgba(32,30,29,0.16)",
  accent: p.accent.base,
  accentInk: p.accent[700],
  accentText: "#f5ead8",
  accentSoft: p.accent[100],
  accentRing: p.accent[300],
  highlight: p.accent[200],
  sage: p.sage[600],
  sageInk: p.sage[700],
  sageSoft: p.sage[100],
  sageChip: p.sage[200],
  sageRing: p.sage[400],
  dashed: p.neutral[400],
  danger: p.accent[700],
  scrim: "rgba(46,43,37,0.32)",
  tones: {
    accent: { fill: p.accent[200], circle: p.accent[300], icon: p.accent[600], badge: p.accent[200] },
    sage: { fill: p.sage[200], circle: p.sage[300], icon: p.sage[600], badge: p.sage[200] },
    neutral: { fill: p.neutral[200], circle: p.neutral[300], icon: p.neutral[600], badge: p.neutral[200] },
  },
  card: "#ebddc5",
  border: "rgba(32,30,29,0.16)",
};

const dark: Theme = {
  scheme: "dark",
  bg: "#1d1a16",
  surface: "#2b2620",
  text: "#f5ead8",
  muted: p.neutral[400],
  divider: "rgba(245,234,216,0.16)",
  accent: p.accent[500],
  accentInk: p.accent[400],
  accentText: "#1d1a16",
  accentSoft: "#3a2416",
  accentRing: p.accent[600],
  highlight: "#5a3418",
  sage: p.sage[400],
  sageInk: p.sage[300],
  sageSoft: "#242a1b",
  sageChip: p.sage[800],
  sageRing: p.sage[600],
  dashed: p.neutral[600],
  danger: p.accent[400],
  scrim: "rgba(0,0,0,0.5)",
  tones: {
    accent: { fill: "#3d2618", circle: "#57341d", icon: p.accent[400], badge: "#4a2d1b" },
    sage: { fill: "#2a3020", circle: "#3a432b", icon: p.sage[400], badge: "#353d28" },
    neutral: { fill: "#302b25", circle: "#423b33", icon: p.neutral[400], badge: "#3b352e" },
  },
  card: "#2b2620",
  border: "rgba(245,234,216,0.16)",
};

/**
 * The active palette. Follows the system scheme, which Settings → Theme can
 * pin to light or dark (see `lib/preferences.ts`).
 */
export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}

/** Text styles. Combine with a colour from the theme. */
export const type = StyleSheet.create({
  largeTitle: { fontFamily: fonts.display, fontSize: 36, lineHeight: 42 },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30 },
  sheetTitle: { fontFamily: fonts.display, fontSize: 19 },
  section: { fontFamily: fonts.display, fontSize: 20 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21 },
  rowTitle: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20 },
  label: { fontFamily: fonts.bold, fontSize: 16 },
  meta: { fontFamily: fonts.body, fontSize: 12.5 },
  metaStrong: { fontFamily: fonts.semibold, fontSize: 12.5 },
  chip: { fontFamily: fonts.bold, fontSize: 11 },
  button: { fontFamily: fonts.bold, fontSize: 15 },
});

export const shadow = {
  sm: { shadowColor: "#2e2b25", shadowOpacity: 0.14, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  md: { shadowColor: "#2e2b25", shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
  lg: { shadowColor: "#2e2b25", shadowOpacity: 0.22, shadowRadius: 32, shadowOffset: { width: 0, height: 12 } },
} as const;
