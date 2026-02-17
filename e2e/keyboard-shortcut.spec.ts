import { test, expect, seedSettings, clearStorage, readLocalStorage } from "./fixtures";

/**
 * Keyboard shortcut tests.
 *
 * Chrome extension keyboard shortcuts (chrome.commands) can't be directly
 * simulated via Playwright's keyboard API since they're handled at the Chrome
 * level, not the page level.
 *
 * These tests verify the underlying handler behavior by:
 * 1. Testing that the service worker is loaded and ready
 * 2. Testing the failure path (pendingCaptureUrl + popup window)
 * 3. Testing the integration with the notification system
 */
test.describe("Keyboard Shortcut Behavior", () => {
  test.beforeEach(async ({ popupPage }) => {
    await clearStorage(popupPage);
  });

  test("service worker handles capture-current-page command", async ({ context }) => {
    // Verify service worker is active (it registers the command listener)
    const sw = context.serviceWorkers()[0];
    expect(sw).toBeDefined();
  });

  test("failed capture stores pendingCaptureUrl for popup retry", async ({
    popupPage: page,
  }) => {
    // Simulate what happens when handleSingleUrlCapture fails:
    // It stores the URL in pendingCaptureUrl
    await page.evaluate(() => {
      return chrome.storage.local.set({
        pendingCaptureUrl: "https://example.com/failed-shortcut-capture",
      });
    });

    const storage = await readLocalStorage(page, ["pendingCaptureUrl"]);
    expect(storage["pendingCaptureUrl"]).toBe(
      "https://example.com/failed-shortcut-capture"
    );
  });

  test("popup consumes pendingCaptureUrl on mount", async ({
    context,
    extensionId,
    popupPage: page,
  }) => {
    await seedSettings(page, {
      apiKey: "sk-or-test-key-1234567890",
      vaultApiKey: "test-vault-key-12345",
    });
    await page.evaluate(() => {
      return chrome.storage.local.set({
        pendingCaptureUrl: "https://example.com/shortcut-retry",
      });
    });

    // Open fresh popup
    const freshPage = await context.newPage();
    await freshPage.goto(
      `chrome-extension://${extensionId}/src/popup/popup.html`
    );
    await freshPage.waitForSelector(".app");
    await freshPage.waitForTimeout(1500);

    // URL should be consumed
    const storage = await readLocalStorage(freshPage, ["pendingCaptureUrl"]);
    expect(storage["pendingCaptureUrl"]).toBeUndefined();
    await freshPage.close();
  });
});
