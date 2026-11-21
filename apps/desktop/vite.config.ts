import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Tauri expects a fixed port and fails if it's taken.
export default defineConfig({
  plugins: [react()],
  // The mobile app hoists a newer react-dom to the root; always use this app's pinned copy
  // (react-dom must match the root's React override exactly).
  resolve: { dedupe: ["react", "react-dom"] },
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  envPrefix: ["VITE_", "TAURI_ENV_"],
  build: { target: "safari16", sourcemap: true },
});
