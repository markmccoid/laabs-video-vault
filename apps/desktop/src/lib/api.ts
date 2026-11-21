/** Single import point for the Convex API + types shared from @lvv/backend. */
import type { FunctionReturnType } from "convex/server";
import { api } from "@lvv/backend/convex/_generated/api";
export { api };
export type { Doc, Id } from "@lvv/backend/convex/_generated/dataModel";

/** A video as list queries return it: the row plus its thumbnail URL and tag names. */
export type ListVideo = FunctionReturnType<typeof api.videos.listByFolder>[number];
export type VideoDetail = NonNullable<FunctionReturnType<typeof api.videos.get>>;
export type FolderDoc = FunctionReturnType<typeof api.folders.list>[number];
export type TagWithCount = FunctionReturnType<typeof api.tags.list>[number];
