/** iOS Share Extension. See CONTEXT.md ("Share Extension") and docs/adr/0001. */
/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: "share",
  name: "ShareExtension",
  displayName: "Video Vault",
  bundleIdentifier: ".share",
  deploymentTarget: "18.0",
  entitlements: {
    // Same App Group as the app: shared UserDefaults (folders, queue) and the share-token Keychain item.
    "com.apple.security.application-groups": config.ios.entitlements["com.apple.security.application-groups"],
  },
});
