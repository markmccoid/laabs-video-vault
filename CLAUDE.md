# LAABS Video Vault: agent notes

See README.md for setup, layout, decisions, and the phase plan. Mobile-specific Expo guidance: apps/mobile/AGENTS.md.

## Rules

- **Package manager:** npm workspaces. In `apps/mobile`, add packages with `npx expo install <pkg>`, never `npm install <pkg>`.
- **Single React version:** the root `overrides.react` must match the version Expo pins in `apps/mobile/package.json`. Bump both together when upgrading the SDK, then run `npx expo-doctor` in `apps/mobile`.
- **Convex auth:** every public function gets the user from `requireUserId` / `requireOwnedVideo` (`convex/lib/auth.ts`). Never accept a `userId` argument from the client.
- **Search text:** any mutation that changes a video's title, channel, description, notes, or tags must call `rebuildSearchText` (`convex/lib/search.ts`).
- **Shared logic:** pure logic shared by backend, mobile, and desktop goes in `packages/core` with vitest tests. Folder depth rules live in `packages/core/src/folders.ts` (`MAX_FOLDER_DEPTH = 3`).
- **Generated code:** `convex/_generated` is committed. Regenerate it with `npx convex dev` (in `packages/backend`) after changing Convex functions.
- **Before calling work done:** run `npm test` and `npm run typecheck` from the root.
- **Testing Convex without the user's cloud deployment:** `CONVEX_AGENT_MODE=anonymous npx convex dev` (in `packages/backend`) runs a local backend that only lives while the command runs. Delete the `.env.local` it writes afterward, so the user's own `npx convex dev` prompts for their project.
