import { ConvexError } from "convex/values";

/** Human-readable message from a Convex/auth/network error. */
export function errorMessage(err: unknown): string {
  if (err instanceof ConvexError) return typeof err.data === "string" ? err.data : "Something went wrong.";
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}
