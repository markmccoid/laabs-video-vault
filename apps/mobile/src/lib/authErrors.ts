import { errorMessage } from "./errors";

/**
 * Turn a Convex Auth password-flow error into something a person can act on.
 * Strings come from @convex-dev/auth 0.0.x server code. Production
 * deployments redact non-ConvexError messages, so there the unmatched
 * fallback is what shows.
 */
export function authErrorMessage(err: unknown, flow: "signIn" | "signUp"): string {
  const raw = errorMessage(err);

  if (/already exists/i.test(raw)) return "An account with this email already exists. Try signing in.";
  if (/Invalid password/i.test(raw)) return "Password must be at least 8 characters.";
  if (/InvalidAccountId|InvalidSecret|Invalid credentials/i.test(raw)) return "Wrong email or password.";
  if (/TooManyFailedAttempts/i.test(raw)) return "Too many attempts. Wait a few minutes and try again.";
  if (/network|fetch failed|connection|timed? ?out/i.test(raw)) {
    return "Can't reach the server. Check your connection.";
  }

  const fallback = flow === "signIn" ? "Couldn't sign in." : "Couldn't create the account.";
  // In development, show the underlying error so config problems aren't hidden.
  return __DEV__ ? `${fallback}\n${raw}` : `${fallback} Please try again.`;
}
