import { JUST_ADDED_STEP_MS, justAddedSince } from "@lvv/core";
import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

/** Videos captured in the last 12 hours. Re-queries as the window moves. */
export function useJustAdded() {
  const [since, setSince] = useState(() => justAddedSince(Date.now()));
  useEffect(() => {
    const t = setInterval(() => setSince(justAddedSince(Date.now())), JUST_ADDED_STEP_MS / 5);
    return () => clearInterval(t);
  }, []);
  return useQuery(api.videos.listJustAdded, { since });
}
