import { useEffect, useState } from "react";

export type ThemeChoice = "system" | "light" | "dark";
const KEY = "lvv.theme";

function read(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

/** System / Light / Dark, a per-device preference. "system" follows macOS Appearance. */
export function useThemeChoice() {
  const [choice, setChoice] = useState<ThemeChoice>(read);
  useEffect(() => {
    const root = document.documentElement;
    if (choice === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", choice);
    try {
      localStorage.setItem(KEY, choice);
    } catch {
      // Storage can be unavailable; the choice still applies for this run.
    }
  }, [choice]);
  return [choice, setChoice] as const;
}
