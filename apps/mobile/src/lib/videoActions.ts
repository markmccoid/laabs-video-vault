import { useMutation } from "convex/react";
import { router } from "expo-router";
import { api, type Id } from "@/lib/api";
import { attempt } from "@/lib/prompt";
import { encodeIds } from "@/lib/selection";

/** Open the player / Move sheet / Tags sheet; move videos to Trash. */
export function useVideoActions() {
  const trashMany = useMutation(api.videos.trashMany);
  return {
    play: (videoId: Id<"videos">) => router.push(`/video/${videoId}`),
    move: (videoIds: readonly Id<"videos">[]) =>
      router.push({ pathname: "/move", params: { videoIds: encodeIds(videoIds) } }),
    editTags: (videoIds: readonly Id<"videos">[]) =>
      router.push({ pathname: "/tag-picker", params: { videoIds: encodeIds(videoIds) } }),
    trash: (videoIds: readonly Id<"videos">[]) =>
      attempt("Couldn't move to Trash", () => trashMany({ videoIds: [...videoIds] })),
  };
}
