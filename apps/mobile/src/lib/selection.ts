import { useCallback, useMemo, useState } from "react";
import type { Id } from "@/lib/api";

type VideoId = Id<"videos">;

/** Multi-select state for a video list. */
export function useSelection() {
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<VideoId>>(new Set());

  const toggle = useCallback((id: VideoId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const start = useCallback(() => setSelecting(true), []);
  const finish = useCallback(() => {
    setSelecting(false);
    setSelected(new Set());
  }, []);
  const selectAll = useCallback((ids: VideoId[]) => setSelected(new Set(ids)), []);

  return useMemo(
    () => ({ selecting, selected, ids: [...selected], toggle, start, finish, selectAll }),
    [selecting, selected, toggle, start, finish, selectAll],
  );
}

export type Selection = ReturnType<typeof useSelection>;

/** Route params can't carry arrays, so selected IDs travel comma-separated. */
export function encodeIds(ids: readonly string[]): string {
  return ids.join(",");
}

export function decodeIds<T extends string>(param: string | string[] | undefined): T[] {
  const raw = Array.isArray(param) ? param.join(",") : (param ?? "");
  return raw.split(",").filter(Boolean) as T[];
}
