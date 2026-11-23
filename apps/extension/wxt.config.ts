import { defineConfig } from "wxt";

// Manifest V3 for Chromium browsers (Chrome, Edge, Brave, Arc). See README.md.
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  // The mobile app hoists a newer react-dom to the root; always use the pinned copy.
  vite: () => ({ resolve: { dedupe: ["react", "react-dom"] } }),
  manifest: {
    name: "LAABS Video Vault",
    description: "Save YouTube videos to your Video Vault, with a folder, a note, and a timestamp.",
    permissions: ["activeTab", "contextMenus", "storage", "scripting"],
    // youtube.com: read the current video's URL and player time, the ✓ badge, and oEmbed titles.
    host_permissions: ["https://*.youtube.com/*"],
    action: { default_title: "Save to Vault" },
    commands: {
      _execute_action: {
        suggested_key: { default: "Alt+Shift+V", mac: "Alt+Shift+V" },
        description: "Open the Video Vault popup",
      },
    },
  },
});
