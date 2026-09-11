import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // GitHub Pages serves a project site (not a custom domain) under
  // /<repo-name>/ — only matters for asset URLs since routing itself is
  // HashRouter (main.tsx), which doesn't care about the base path at all.
  base: command === "build" ? "/netcapital-docconformance/" : "/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
  },
}));
