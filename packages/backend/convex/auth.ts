import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

/**
 * Phase 0: email + password (no external services needed).
 * Planned: email OTP (Resend) and optional Sign in with Apple. App Store rules
 * only require Apple sign-in if a third-party social login is offered.
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password],
});
