import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

export type ViewMode = "list" | "grid";

const KEY = "lvv.viewMode";

/** List/grid preference, remembered on this device. */
export function useViewMode(): [ViewMode, (mode: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>("list");

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((saved) => {
        if (saved === "list" || saved === "grid") setMode(saved);
      })
      .catch(() => {});
  }, []);

  const update = useCallback((next: ViewMode) => {
    setMode(next);
    AsyncStorage.setItem(KEY, next).catch(() => {});
  }, []);

  return [mode, update];
}
