import path from "path";
import { fileURLToPath } from "url";
import { test as base, chromium, type BrowserContext, type Page } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dirname, "../dist");

/**
 * Custom fixture that launches Chromium with the 2Vault extension loaded.
 * The browser window is moved off-screen so tests run without interrupting.
 *
 * Provides:
 * - `context`: BrowserContext with the extension
 * - `extensionId`: The extension's unique ID
 * - `popupPage`: A Page object navigated to the extension popup
 */
export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
  popupPage: Page;
}>({
  // eslint-disable-next-line no-empty-pattern -- Playwright fixture pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext("", {
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        "--no-first-run",
        "--disable-default-apps",
        // New headless mode supports extensions (Chrome 112+)
        "--headless=new",
      ],
    });
    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    // MV3 extensions register a service worker. Wait for it and extract the ID.
    let serviceWorker = context.serviceWorkers()[0];
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent("serviceworker", {
        timeout: 10_000,
      });
    }
    const swUrl = serviceWorker.url();
    // URL format: chrome-extension://<id>/service-worker-loader.js
    const id = swUrl.split("/")[2];
    if (!id) throw new Error("Could not extract extension ID from service worker URL");
    await use(id);
  },

  popupPage: async ({ context, extensionId }, use) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
    // Wait for React to mount
    await page.waitForSelector(".app");
    await use(page);
  },
});

export { expect } from "@playwright/test";

/**
 * Helper: seed chrome.storage.sync with settings via the popup page's JS context.
 */
export async function seedSettings(
  page: Page,
  settings: Record<string, string | string[] | Record<string, unknown>[]>
): Promise<void> {
  await page.evaluate((s) => {
    return chrome.storage.sync.set(s);
  }, settings);
}

/**
 * Helper: seed chrome.storage.local with data via the popup page's JS context.
 */
export async function seedLocalStorage(
  page: Page,
  data: Record<string, unknown>
): Promise<void> {
  await page.evaluate((d) => {
    return chrome.storage.local.set(d);
  }, data);
}

/**
 * Helper: read chrome.storage.sync for assertions.
 */
export async function readSyncStorage(
  page: Page,
  keys: string[]
): Promise<Record<string, unknown>> {
  return page.evaluate((k) => chrome.storage.sync.get(k), keys);
}

/**
 * Helper: read chrome.storage.local for assertions.
 */
export async function readLocalStorage(
  page: Page,
  keys: string[]
): Promise<Record<string, unknown>> {
  return page.evaluate((k) => chrome.storage.local.get(k), keys);
}

/**
 * Helper: clear all extension storage.
 */
export async function clearStorage(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await chrome.storage.sync.clear();
    await chrome.storage.local.clear();
  });
}

/**
 * Helper: navigate to popup and wait for React mount.
 */
export async function openPopup(
  context: BrowserContext,
  extensionId: string
): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
  await page.waitForSelector(".app");
  return page;
}
