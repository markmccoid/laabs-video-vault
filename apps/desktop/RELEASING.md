# Releasing the Mac app

How to ship a new version of LAABS Video Vault for the Mac as a signed, notarized DMG on GitHub Releases. Run commands from the repo root unless a step says otherwise.

The first release was `v0.1.0` (November 2026).

## One-time setup

This is all done on Mark's Mac already. Redo it on a new machine.

- [ ] **Developer ID certificate** in the login keychain: `Developer ID Application: Mark Mccoid (SQZHZU59ZE)`. Check with `security find-identity -v -p codesigning`. `bundle.macOS.signingIdentity` in `src-tauri/tauri.conf.json` names it.
- [ ] **Notary profile** `laabs-notary` in the keychain. It's shared with LAABS Audio Align (same team). Check it with `xcrun notarytool history --keychain-profile laabs-notary`. To create it:
  ```bash
  xcrun notarytool store-credentials laabs-notary --apple-id <apple-id> --team-id SQZHZU59ZE
  ```
- [ ] **Rust**, with both Mac targets for a universal build:
  ```bash
  rustup target add aarch64-apple-darwin x86_64-apple-darwin
  ```
- [ ] **`apps/desktop/.env.production.local`** (not committed) pointing the build at production Convex:
  ```
  VITE_CONVEX_URL=https://acoustic-rhinoceros-246.convex.cloud
  ```
  `vite build` reads it; `npm run dev` keeps using `.env.local` (dev deployment).
- [ ] **Production Convex auth keys** (`JWT_PRIVATE_KEY`, `JWKS`). They're already set. Don't overwrite them: everyone would be signed out.

## Each release

### 1. Backend first

The app talks to production Convex, so backend changes must be live before the new app is.

- [ ] If anything in `packages/backend/convex` changed since the last release, deploy it:
  ```bash
  cd packages/backend && npx convex deploy
  ```
- [ ] Run any one-off migrations the PRs call for, with `--prod`. For example:
  ```bash
  cd packages/backend && npx convex run tags:lowercaseExistingNames --prod
  ```
- [ ] Remember the iOS app shares this backend: don't deploy changes it isn't ready for.

### 2. Version and checks

- [ ] Merge the release work to `main` and build from `main`, so the tag matches the code. (`v0.1.0` was built from `phase-5-multi-select` before merging.)
- [ ] Raise the version in all three files. Use the same number in each:
  - `apps/desktop/package.json`
  - `apps/desktop/src-tauri/tauri.conf.json`
  - `apps/desktop/src-tauri/Cargo.toml`
- [ ] Run the tests and typecheck:
  ```bash
  npm test && npm run typecheck
  ```

### 3. Build

```bash
npm run tauri -w @lvv/desktop -- build --target universal-apple-darwin
```

If `cargo` isn't found, add `~/.cargo/bin` to your PATH. The output goes to `apps/desktop/src-tauri/target/universal-apple-darwin/release/bundle/`, in `macos/` (the `.app`) and `dmg/`.

Tauri prints `skipping app notarization`. That's expected: it can't read keychain profiles, so you notarize in the next step.

### 4. Notarize and staple

```bash
DMG="apps/desktop/src-tauri/target/universal-apple-darwin/release/bundle/dmg/LAABS Video Vault_<version>_universal.dmg"
```

```bash
xcrun notarytool submit "$DMG" --keychain-profile laabs-notary --wait
```

```bash
xcrun stapler staple "$DMG"
```

Apple usually takes 2–10 minutes. If the status is `Invalid`, read why with:

```bash
xcrun notarytool log <submission-id> --keychain-profile laabs-notary
```

### 5. Check it

- [ ] Gatekeeper accepts the DMG:
  ```bash
  spctl -a -vvv -t open --context context:primary-signature "$DMG"
  ```
  The output should say `accepted` and `source=Notarized Developer ID`.
- [ ] Quit any running copy, open the DMG, drag the app to Applications, and launch it:
  - [ ] Sign-in works. You stay signed in from the last version, as long as the port didn't change.
  - [ ] A video plays (no "Error 153").
  - [ ] The menu bar works (for example View › Command Palette…).

### 6. Publish

- [ ] Commit any version bumps and push.
- [ ] Create the release. `--target` sets the commit the new tag points at:
  ```bash
  gh release create v<version> "$DMG" --target main --title "LAABS Video Vault <version>" --notes "<what's new>"
  ```
- [ ] There's no auto-update yet. Tell people a new version is out; they replace the app in Applications.

## Don't change

- **Port `41420`** (`PORT` in `src-tauri/src/lib.rs`, and `remote.urls` in `src-tauri/capabilities/default.json`). Release builds serve the app from `http://localhost:41420`. A new port is a new origin, so the sign-in saved in localStorage is lost and everyone has to sign in again. Change both places together, or neither.
- **The bundle identifier** `com.markmccoid.laabs-video-vault.desktop`. macOS would treat a new identifier as a different app.

## If something breaks

| Symptom | Cause and fix |
|---|---|
| YouTube shows "Video player configuration error", Error 153 | The page has no `Referer`. That happens when the window loads from `tauri://localhost` instead of the localhost server. Check that `tauri-plugin-localhost` is still registered in release builds (`src-tauri/src/lib.rs`) and that the main window is `"create": false` in `tauri.conf.json`. |
| Menus, window dragging, or other Tauri calls do nothing in the release build only | The localhost URL isn't allowed by the capability. `remote.urls` in `capabilities/default.json` must match the port. |
| Blank window in the release build | Something else is using port 41420 on that Mac. Check with `lsof -nP -iTCP:41420`. |
| `tauri.conf.json` error: `'signingIdentity' was unexpected` | `signingIdentity` has to be under `bundle.macOS`, not at the top level. |
| App signs in against the dev backend | `.env.production.local` is missing. Check what was built in: `grep -rhoE '[a-z]+-[a-z]+-[0-9]+\.convex\.cloud' apps/desktop/dist`. It should show `acoustic-rhinoceros-246`. The other example names come from the Convex library itself. |

## Later

- Auto-update (Tauri updater plugin, with a signed update manifest on GitHub Releases).
- A `tools/make-release.sh` like LAABS Audio Align's that runs steps 3–5 in one go.
