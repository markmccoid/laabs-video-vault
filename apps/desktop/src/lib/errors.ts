import { ConvexError } from "convex/values";

/** A message a person can read: the ConvexError payload when there is one. */
export function errorMessage(err: unknown): string {
  if (err instanceof ConvexError) return typeof err.data === "string" ? err.data : JSON.stringify(err.data);
  if (err instanceof Error) return err.message;
  return String(err);
}

/** Convex Auth password-flow errors, in plain words (strings from @convex-dev/auth 0.0.x). */
export function authErrorMessage(err: unknown, flow: "signIn" | "signUp"): string {
  const raw = errorMessage(err);
  if (/already exists/i.test(raw)) return "An account with this email already exists. Try signing in.";
  if (/Invalid password/i.test(raw)) return "Password must be at least 8 characters.";
  if (/InvalidAccountId|InvalidSecret|Invalid credentials/i.test(raw)) return "Wrong email or password.";
  if (/TooManyFailedAttempts/i.test(raw)) return "Too many attempts. Wait a few minutes and try again.";
  if (/network|fetch failed|connection|timed? ?out/i.test(raw)) return "Can't reach the server. Check your connection.";
  const fallback = flow === "signIn" ? "Couldn't sign in." : "Couldn't create the account.";
  return import.meta.env.DEV ? `${fallback} ${raw}` : `${fallback} Please try again.`;
}
