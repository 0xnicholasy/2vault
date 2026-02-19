import { test, expect, seedSettings, seedLocalStorage, clearStorage } from "./fixtures";
import type { ProcessingState } from "../src/background/messages";

test.describe("Processing Modal", () => {
  test.beforeEach(async ({ popupPage }) => {
    await clearStorage(popupPage);
  });

  test("modal appears when popup opens during active processing", async ({
    context,
    extensionId,
    popupPage: page,
  }) => {
    // Seed an active processing state
    const activeState: ProcessingState = {
      active: true,
      urls: ["https://example.com/1", "https://example.com/2"],
      results: [],
      urlStatuses: {
        "https://example.com/1": "extracting",
        "https://example.com/2": "queued",
      },
      startedAt: Date.now(),
      cancelled: false,
    };
    await seedLocalStorage(page, { processingState: activeState });

    // Open fresh popup
    const freshPage = await context.newPage();
    await freshPage.goto(
      `chrome-extension://${extensionId}/src/popup/popup.html`
    );
    await freshPage.waitForSelector(".app");

    await expect(freshPage.locator(".processing-modal")).toBeVisible();
    await expect(freshPage.locator(".progress-text")).toContainText("/ 2 URLs");
    await freshPage.close();
  });

  test("modal shows per-URL status rows", async ({
    context,
    extensionId,
    popupPage: page,
  }) => {
    const state: ProcessingState = {
      active: true,
      urls: [
        "https://example.com/a",
        "https://example.com/b",
        "https://example.com/c",
      ],
      results: [],
      urlStatuses: {
        "https://example.com/a": "done",
        "https://example.com/b": "processing",
        "https://example.com/c": "queued",
      },
      startedAt: Date.now(),
      cancelled: false,
    };
    await seedLocalStorage(page, { processingState: state });

    const freshPage = await context.newPage();
    await freshPage.goto(
      `chrome-extension://${extensionId}/src/popup/popup.html`
    );
    await freshPage.waitForSelector(".app");

    const rows = freshPage.locator(".url-status-row");
    await expect(rows).toHaveCount(3);

    // Check status labels
    await expect(rows.nth(0).locator(".url-status-label")).toContainText("Done");
    await expect(rows.nth(1).locator(".url-status-label")).toContainText("Summarizing");
    await expect(rows.nth(2).locator(".url-status-label")).toContainText("Queued");
    await freshPage.close();
  });

  test("modal shows progress bar", async ({
    context,
    extensionId,
    popupPage: page,
  }) => {
    const state: ProcessingState = {
      active: true,
      urls: ["https://example.com/1", "https://example.com/2"],
      results: [{ url: "https://example.com/1", status: "success" }],
      urlStatuses: {
        "https://example.com/1": "done",
        "https://example.com/2": "extracting",
      },
      startedAt: Date.now(),
      cancelled: false,
    };
    await seedLocalStorage(page, { processingState: state });

    const freshPage = await context.newPage();
    await freshPage.goto(
      `chrome-extension://${extensionId}/src/popup/popup.html`
    );
    await freshPage.waitForSelector(".app");

    await expect(freshPage.locator(".progress-fill")).toBeVisible();
    await expect(freshPage.locator(".progress-text")).toContainText("1 / 2");
    await freshPage.close();
  });

  test("modal shows error details for failed URLs", async ({
    context,
    extensionId,
    popupPage: page,
  }) => {
    await seedSettings(page, {
      apiKey: "sk-or-test-key-1234567890",
      vaultApiKey: "test-vault-key-12345",
    });

    const state: ProcessingState = {
      active: false,
      urls: ["https://example.com/fail"],
      results: [
        {
          url: "https://example.com/fail",
          status: "failed",
          error: "LLM rate limit exceeded",
          errorCategory: "llm",
        },
      ],
      urlStatuses: { "https://example.com/fail": "failed" },
      startedAt: Date.now(),
      cancelled: false,
      error: "LLM rate limit exceeded",
    };
    await seedLocalStorage(page, {
      processingState: state,
      processingHistory: state.results,
    });

    const freshPage = await context.newPage();
    await freshPage.goto(
      `chrome-extension://${extensionId}/src/popup/popup.html`
    );
    await freshPage.waitForSelector(".app");

    // Completed state with errors shows on the Status tab
    await freshPage.click('button[role="tab"]:has-text("Status")');
    await expect(freshPage.locator(".processing-status")).toBeVisible();
    await expect(freshPage.locator(".batch-error-banner")).toContainText("LLM rate limit");
    await freshPage.close();
  });

  test("Cancel button visible during active processing", async ({
    context,
    extensionId,
    popupPage: page,
  }) => {
    const state: ProcessingState = {
      active: true,
      urls: ["https://example.com/1"],
      results: [],
      urlStatuses: { "https://example.com/1": "extracting" },
      startedAt: Date.now(),
      cancelled: false,
    };
    await seedLocalStorage(page, { processingState: state });

    const freshPage = await context.newPage();
    await freshPage.goto(
      `chrome-extension://${extensionId}/src/popup/popup.html`
    );
    await freshPage.waitForSelector(".app");

    await expect(
      freshPage.locator('.processing-modal button:has-text("Cancel")')
    ).toBeVisible();
    await freshPage.close();
  });

  test("Close button visible after processing completes", async ({
    context,
    extensionId,
    popupPage: page,
  }) => {
    // First seed active state so modal opens
    const activeState: ProcessingState = {
      active: true,
      urls: ["https://example.com/1"],
      results: [],
      urlStatuses: { "https://example.com/1": "extracting" },
      startedAt: Date.now(),
      cancelled: false,
    };
    await seedLocalStorage(page, { processingState: activeState });

    const freshPage = await context.newPage();
    await freshPage.goto(
      `chrome-extension://${extensionId}/src/popup/popup.html`
    );
    await freshPage.waitForSelector(".app");

    // Now update to completed state
    const doneState: ProcessingState = {
      active: false,
      urls: ["https://example.com/1"],
      results: [{ url: "https://example.com/1", status: "success" }],
      urlStatuses: { "https://example.com/1": "done" },
      startedAt: Date.now(),
      cancelled: false,
    };
    await freshPage.evaluate((s) => chrome.storage.local.set({ processingState: s }), doneState);

    await expect(
      freshPage.locator('.processing-modal button:has-text("Close")')
    ).toBeVisible({ timeout: 5000 });
    await freshPage.close();
  });

  test("Close button dismisses modal", async ({
    context,
    extensionId,
    popupPage: page,
  }) => {
    // Seed active -> completed transition
    const activeState: ProcessingState = {
      active: true,
      urls: ["https://example.com/1"],
      results: [],
      urlStatuses: { "https://example.com/1": "creating" },
      startedAt: Date.now(),
      cancelled: false,
    };
    await seedLocalStorage(page, { processingState: activeState });

    const freshPage = await context.newPage();
    await freshPage.goto(
      `chrome-extension://${extensionId}/src/popup/popup.html`
    );
    await freshPage.waitForSelector(".app");

    // Transition to done
    const doneState: ProcessingState = {
      active: false,
      urls: ["https://example.com/1"],
      results: [{ url: "https://example.com/1", status: "success" }],
      urlStatuses: { "https://example.com/1": "done" },
      startedAt: Date.now(),
      cancelled: false,
    };
    await freshPage.evaluate((s) => chrome.storage.local.set({ processingState: s }), doneState);

    const closeBtn = freshPage.locator('.processing-modal button:has-text("Close")');
    await closeBtn.waitFor({ state: "visible", timeout: 5000 });
    await closeBtn.click();

    await expect(freshPage.locator(".processing-modal")).not.toBeVisible();
    await freshPage.close();
  });

  test("batch error banner shows when state has error", async ({
    context,
    extensionId,
    popupPage: page,
  }) => {
    await seedSettings(page, {
      apiKey: "sk-or-test-key-1234567890",
      vaultApiKey: "test-vault-key-12345",
    });

    const state: ProcessingState = {
      active: false,
      urls: ["https://example.com/1"],
      results: [{ url: "https://example.com/1", status: "failed", error: "Config error", errorCategory: "llm" }],
      urlStatuses: { "https://example.com/1": "failed" },
      startedAt: Date.now(),
      cancelled: false,
      error: "Missing API key",
    };
    await seedLocalStorage(page, { processingState: state });

    // Check in Status tab where completed batches with errors are shown
    const freshPage = await context.newPage();
    await freshPage.goto(
      `chrome-extension://${extensionId}/src/popup/popup.html`
    );
    await freshPage.waitForSelector(".app");
    await freshPage.click('button[role="tab"]:has-text("Status")');

    await expect(freshPage.locator(".batch-error-banner")).toContainText("Missing API key");
    await freshPage.close();
  });
});
