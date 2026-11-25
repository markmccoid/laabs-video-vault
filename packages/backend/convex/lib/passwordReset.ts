import type { ConvexCredentialsConfig } from "@convex-dev/auth/server";
import { internal } from "../_generated/api";

/**
 * Wrap a Password provider so a completed password reset also revokes every
 * share token the user holds. Convex Auth already signs out the user's other
 * sessions on reset, but share tokens live in our own table, so a stolen
 * device's Share Extension would keep working without this.
 *
 * Password reset isn't enabled yet (no `reset` email provider). This hook is
 * in place so it applies as soon as it is.
 */
export function revokeShareTokensOnReset(provider: ConvexCredentialsConfig): ConvexCredentialsConfig {
  const authorize = provider.authorize;
  return {
    ...provider,
    authorize: async (params, ctx) => {
      const result = await authorize(params, ctx);
      if (result !== null && params.flow === "reset-verification") {
        await ctx.runMutation(internal.shareTokens.revokeAllForUser, { userId: result.userId });
      }
      return result;
    },
  };
}
