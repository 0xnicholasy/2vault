import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// Separate Vitest config that intentionally excludes the CRXJS plugin.
// The CRXJS plugin performs heavy manifest processing and service worker
// bundling that is unnecessary during testing and causes slow transform times,
// leading to beforeAll hook timeouts when importing @/background/service-worker.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  test: {
    globals: true,
    include: ["tests/**/*.test.{ts,tsx}"],
    alias: {
      "@": resolve(__dirname, "src"),
    },
    environmentMatchGlobs: [["tests/**/*.test.tsx", "jsdom"]],
    setupFiles: ["tests/setup.ts"],
    // Increase hook timeout to accommodate slow dynamic imports of the
    // service-worker module graph (e.g. beforeAll(() => import(service-worker))).
    // The transform + import phase can take 15-30s on first run.
    hookTimeout: 30000,
  },
});
