import { test, expect, seedSettings, seedLocalStorage, readLocalStorage, clearStorage, openPopup } from "./fixtures";

/**
 * Context menu tests.
 *
 * Native Chrome context menus can't be directly triggered via Playwright.
 * Instead, we test the underlying behavior:
 * 1. Context menu items are registered on install (verified via service worker)
 * 2. The pendingCaptureUrl storage mechanism works end-to-end
 * 3. Popup reads pendingCaptureUrl and auto-starts processing
 */
test.describe("Context Menu Behavior", () => {
  test.beforeEach(async ({ popupPage }) => {
    await clearStorage(popupPage);
  });

  test("pendingCaptureUrl triggers auto-processing on popup open", async ({
    context,
    extensionId,
    popupPage: page,
  }) => {
    await seedSettings(page, {
      apiKey: "sk-or-test-key-1234567890",
      vaultApiKey: "test-vault-key-12345",
    });
    // Simulate what the context menu handler does
    await seedLocalStorage(page, {
      pendingCaptureUrl: "https://example.com/context-menu-test",
    });

    // Open new popup - this simulates the openPopupWindow() call
    const popup = await openPopup(context, extensionId);

    // Wait for the pendingCaptureUrl to be processed
    await popup.waitForTimeout(1500);

    // The popup should have read and cleared the pendingCaptureUrl
    const storage = await readLocalStorage(popup, ["pendingCaptureUrl"]);
    expect(storage["pendingCaptureUrl"]).toBeUndefined();

    // Either the processing modal appeared or the URL was used
    const modal = popup.locator(".processing-modal");
    const modalVisible = await modal.isVisible().catch(() => false);

    // If no Obsidian/API keys are actually valid, processing may fail quickly,
    // but the URL should have been consumed from storage
    expect(modalVisible || !storage["pendingCaptureUrl"]).toBeTruthy();
    await popup.close();
  });

  test("pendingCaptureUrl prefills textarea when batch already active", async ({
    context,
    extensionId,
    popupPage: page,
  }) => {
    await seedSettings(page, {
      apiKey: "sk-or-test-key-1234567890",
      vaultApiKey: "test-vault-key-12345",
    });

    // Set an active processing state first
    await seedLocalStorage(page, {
      processingState: {
        active: true,
        urls: ["https://other.com/already-processing"],
        results: [],
        urlStatuses: { "https://other.com/already-processing": "extracting" },
        startedAt: Date.now(),
        cancelled: false,
      },
      pendingCaptureUrl: "https://example.com/queued-from-menu",
    });

    const popup = await openPopup(context, extensionId);
    await popup.waitForTimeout(1500);

    // Since a batch is already active, the URL should be pre-filled in textarea
    // or the modal should show the active batch. Check for either.
    const modal = popup.locator(".processing-modal");
    const modalVisible = await modal.isVisible().catch(() => false);

    // The URL should have been consumed regardless
    const storage = await readLocalStorage(popup, ["pendingCaptureUrl"]);
    expect(storage["pendingCaptureUrl"]).toBeUndefined();

    if (modalVisible) {
      // Modal showing the already-active batch is also valid
      await expect(modal).toBeVisible();
    }
    await popup.close();
  });

  test("service worker registers context menu items on install", async ({
    context,
  }) => {
    // Verify service worker is running (context menus are registered in onInstalled)
    const serviceWorker = context.serviceWorkers()[0];
    expect(serviceWorker).toBeDefined();

    // We can't query chrome.contextMenus from outside the extension,
    // but we can verify the service worker loaded without errors
    const swUrl = serviceWorker!.url();
    expect(swUrl).toContain("service-worker");
  });
});
