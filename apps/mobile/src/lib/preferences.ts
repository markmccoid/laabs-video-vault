import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import { Appearance } from "react-native";

export type LibraryLayout = "grid" | "list" | "tree" | "columns";
export type ThemePreference = "system" | "light" | "dark";
/** How the player picks a speed: the native menu, or the gravity well (trial). */
export type RatePicker = "menu" | "well";

type Prefs = {
  libraryLayout: LibraryLayout;
  theme: ThemePreference;
  recentSearches: string[];
  /** Whether the player's Timestamps section is expanded. */
  timestampsOpen: boolean;
  /** Also show YouTube's own controls over the video (ours stay below it). */
  youtubeControls: boolean;
  /** Captions on or off for every video (the player's CC button). */
  captions: boolean;
  /** Speed every video starts at. */
  defaultRate: number;
  ratePicker: RatePicker;
  /** Seconds the player's skip back / skip forward buttons jump. */
  jumpBack: number;
  jumpForward: number;
};

const KEY = "lvv.prefs";
const DEFAULTS: Prefs = { libraryLayout: "grid", theme: "system", recentSearches: [], timestampsOpen: true, youtubeControls: false, captions: false, defaultRate: 1, ratePicker: "menu", jumpBack: 10, jumpForward: 10 };

/** Layouts the Library renders today; the others fall back to Grid. */
export const SUPPORTED_LAYOUTS: LibraryLayout[] = ["grid", "tree"];

let prefs: Prefs = DEFAULTS;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function applyTheme(theme: ThemePreference) {
  Appearance.setColorScheme(theme === "system" ? "unspecified" : theme);
}

/** Load saved preferences once at startup. */
export async function loadPreferences() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) prefs = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    // Keep defaults.
  }
  applyTheme(prefs.theme);
  emit();
}

function update(patch: Partial<Prefs>) {
  prefs = { ...prefs, ...patch };
  AsyncStorage.setItem(KEY, JSON.stringify(prefs)).catch(() => {});
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function usePrefs(): Prefs {
  return useSyncExternalStore(subscribe, () => prefs);
}

/** Per-device preferences: Library layout, theme, recent searches, the Timestamps section state, and player settings. */
export function usePreferences() {
  const current = usePrefs();
  return {
    ...current,
    setLibraryLayout: (libraryLayout: LibraryLayout) => update({ libraryLayout }),
    setTheme: (theme: ThemePreference) => {
      applyTheme(theme);
      update({ theme });
    },
    /** Keep the 4 most recent distinct searches. */
    addRecentSearch: (query: string) => {
      const q = query.trim();
      if (!q) return;
      const rest = prefs.recentSearches.filter((s) => s.toLowerCase() !== q.toLowerCase());
      update({ recentSearches: [q, ...rest].slice(0, 4) });
    },
    clearRecentSearches: () => update({ recentSearches: [] }),
    setTimestampsOpen: (timestampsOpen: boolean) => update({ timestampsOpen }),
    setYoutubeControls: (youtubeControls: boolean) => update({ youtubeControls }),
    setCaptions: (captions: boolean) => update({ captions }),
    setDefaultRate: (defaultRate: number) => update({ defaultRate }),
    setRatePicker: (ratePicker: RatePicker) => update({ ratePicker }),
    setJumpBack: (jumpBack: number) => update({ jumpBack }),
    setJumpForward: (jumpForward: number) => update({ jumpForward }),
  };
}
