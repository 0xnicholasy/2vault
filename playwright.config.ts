import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 0,
  workers: 1, // Extensions require serial execution (single browser context)
  use: {
    headless: false, // Chrome extensions require headed mode
    viewport: { width: 420, height: 600 },
  },
  projects: [
    {
      name: "extension",
      use: {
        browserName: "chromium",
      },
    },
  ],
});
