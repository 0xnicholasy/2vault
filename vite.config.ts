import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import { resolve } from "path";
import manifest from "./manifest.json";

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        onboarding: resolve(__dirname, "src/onboarding/onboarding.html"),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
    cors: true,
  },
  test: {
    globals: true,
    include: ["tests/**/*.test.{ts,tsx}"],
    alias: {
      "@": resolve(__dirname, "src"),
    },
    environmentMatchGlobs: [
      ["tests/**/*.test.tsx", "jsdom"],
    ],
    setupFiles: ["tests/setup.ts"],
  },
});
