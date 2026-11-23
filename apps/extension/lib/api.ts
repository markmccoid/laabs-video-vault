/** Single import point for the Convex API + types shared from @lvv/backend. */
import type { FunctionReturnType } from "convex/server";
import { api } from "@lvv/backend/convex/_generated/api";
export { api };
export type { Id } from "@lvv/backend/convex/_generated/dataModel";

export type FolderDoc = FunctionReturnType<typeof api.folders.list>[number];
export type LookupResult = FunctionReturnType<typeof api.videos.lookup>;
