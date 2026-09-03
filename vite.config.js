import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Plain Vite + React config. PWA installability is handled by hand-written
// public/manifest.json + public/sw.js (registered in src/main.jsx) rather
// than vite-plugin-pwa, so there's one less dependency to install and
// nothing "magic" generated at build time that's hard to audit.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
