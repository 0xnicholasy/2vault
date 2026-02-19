import { test, expect, seedSettings, seedLocalStorage, clearStorage } from "./fixtures";
import type { ProcessingResult } from "../src/core/types";

test.describe("Status Tab", () => {
  test.beforeEach(async ({ popupPage }) => {
    await clearStorage(popupPage);
  });

  test("shows config guard when API keys not set", async ({ popupPage: page }) => {
    await page.click('button[role="tab"]:has-text("Status")');
    await expect(page.locator(".config-guard-inline")).toContainText("Configure your API keys");
    await expect(page.locator('button:has-text("Go to Settings")')).toBeVisible();
  });

  test("Go to Settings button switches to settings tab", async ({ popupPage: page }) => {
    await page.click('button[role="tab"]:has-text("Status")');
    await page.click('button:has-text("Go to Settings")');

    // Settings tab should now be active
    await expect(page.locator("#apiKey")).toBeVisible();
  });

  test("shows empty state when no processing history", async ({ popupPage: page }) => {
    await seedSettings(page, {
      apiKey: "sk-or-test-key-1234567890",
      vaultApiKey: "test-vault-key-12345",
    });
    await page.reload();
    await page.waitForSelector(".app");

    await page.click('button[role="tab"]:has-text("Status")');
    await expect(page.locator(".empty-state")).toContainText("No processing history");
  });

  test("shows processing history results", async ({ popupPage: page }) => {
    await seedSettings(page, {
      apiKey: "sk-or-test-key-1234567890",
      vaultApiKey: "test-vault-key-12345",
    });
    const history: ProcessingResult[] = [
      { url: "https://example.com/article-1", status: "success", folder: "Resources" },
      { url: "https://example.com/article-2", status: "failed", error: "Network error" },
      { url: "https://example.com/article-3", status: "skipped" },
    ];
    await seedLocalStorage(page, { processingHistory: history });
    await page.reload();
    await page.waitForSelector(".app");

    await page.click('button[role="tab"]:has-text("Status")');

    const rows = page.locator(".results-table tbody tr");
    await expect(rows).toHaveCount(3);
  });

  test("filter buttons work - All / Failures / Skipped", async ({ popupPage: page }) => {
    await seedSettings(page, {
      apiKey: "sk-or-test-key-1234567890",
      vaultApiKey: "test-vault-key-12345",
    });
    const history: ProcessingResult[] = [
      { url: "https://example.com/1", status: "success", folder: "Resources" },
      { url: "https://example.com/2", status: "failed", error: "Error" },
      { url: "https://example.com/3", status: "skipped" },
    ];
    await seedLocalStorage(page, { processingHistory: history });
    await page.reload();
    await page.waitForSelector(".app");
    await page.click('button[role="tab"]:has-text("Status")');

    // All filter (default)
    await expect(page.locator(".results-table tbody tr")).toHaveCount(3);

    // Failures filter
    await page.click('.filter-btn:has-text("Failures")');
    await expect(page.locator(".results-table tbody tr")).toHaveCount(1);

    // Skipped filter
    await page.click('.filter-btn:has-text("Skipped")');
    await expect(page.locator(".results-table tbody tr")).toHaveCount(1);

    // Back to All
    await page.click('.filter-btn:has-text("All")');
    await expect(page.locator(".results-table tbody tr")).toHaveCount(3);
  });

  test("failed row expands to show error details", async ({ popupPage: page }) => {
    await seedSettings(page, {
      apiKey: "sk-or-test-key-1234567890",
      vaultApiKey: "test-vault-key-12345",
    });
    const history: ProcessingResult[] = [
      {
        url: "https://example.com/fail",
        status: "failed",
        error: "LLM call timed out after 30s",
        errorCategory: "llm",
      },
    ];
    await seedLocalStorage(page, { processingHistory: history });
    await page.reload();
    await page.waitForSelector(".app");
    await page.click('button[role="tab"]:has-text("Status")');

    // Click the failed row to expand
    await page.click(".error-row-expandable");
    await expect(page.locator(".error-expanded-details")).toBeVisible();
    // New error display shows category label "API Error" and technical details in .error-message
    await expect(page.locator(".error-message")).toContainText("LLM call timed out");

    // Click again to collapse
    await page.click(".error-row-expandable");
    await expect(page.locator(".error-expanded-details")).not.toBeVisible();
  });

  test("Copy URL button in expanded error row", async ({ popupPage: page }) => {
    await seedSettings(page, {
      apiKey: "sk-or-test-key-1234567890",
      vaultApiKey: "test-vault-key-12345",
    });
    const history: ProcessingResult[] = [
      {
        url: "https://example.com/copy-me",
        status: "failed",
        error: "Some error",
        errorCategory: "network",
      },
    ];
    await seedLocalStorage(page, { processingHistory: history });
    await page.reload();
    await page.waitForSelector(".app");
    await page.click('button[role="tab"]:has-text("Status")');

    await page.click(".error-row-expandable");
    const copyBtn = page.locator('.copy-url-btn:has-text("Copy URL")');
    await expect(copyBtn).toBeVisible();
    // We can't easily assert clipboard in headful mode, but verify button is clickable
    await copyBtn.click();
    // Row should stay expanded after clicking copy
    await expect(page.locator(".error-expanded-details")).toBeVisible();
  });

  test("all-failed banner with Retry All button", async ({ popupPage: page }) => {
    await seedSettings(page, {
      apiKey: "sk-or-test-key-1234567890",
      vaultApiKey: "test-vault-key-12345",
    });
    const history: ProcessingResult[] = [
      { url: "https://example.com/1", status: "failed", error: "Error 1", errorCategory: "network" },
      { url: "https://example.com/2", status: "failed", error: "Error 2", errorCategory: "timeout" },
    ];
    await seedLocalStorage(page, { processingHistory: history });
    await page.reload();
    await page.waitForSelector(".app");
    await page.click('button[role="tab"]:has-text("Status")');

    await expect(page.locator(".all-failed-banner")).toBeVisible();
    await expect(page.locator(".all-failed-banner")).toContainText("All URLs failed");
    await expect(page.locator('button:has-text("Retry All")')).toBeVisible();
  });

  test("Retry Failed button for partial failures", async ({ popupPage: page }) => {
    await seedSettings(page, {
      apiKey: "sk-or-test-key-1234567890",
      vaultApiKey: "test-vault-key-12345",
    });
    const history: ProcessingResult[] = [
      { url: "https://example.com/1", status: "success", folder: "Inbox" },
      { url: "https://example.com/2", status: "failed", error: "Error", errorCategory: "llm" },
    ];
    await seedLocalStorage(page, { processingHistory: history });
    await page.reload();
    await page.waitForSelector(".app");
    await page.click('button[role="tab"]:has-text("Status")');

    await expect(page.locator('button:has-text("Retry Failed")')).toBeVisible();
    // "Retry All" banner should NOT appear since not all failed
    await expect(page.locator(".all-failed-banner")).not.toBeVisible();
  });

  test("Process More button switches to bookmarks tab", async ({ popupPage: page }) => {
    await seedSettings(page, {
      apiKey: "sk-or-test-key-1234567890",
      vaultApiKey: "test-vault-key-12345",
    });
    const history: ProcessingResult[] = [
      { url: "https://example.com/1", status: "success", folder: "Inbox" },
    ];
    await seedLocalStorage(page, { processingHistory: history });
    await page.reload();
    await page.waitForSelector(".app");
    await page.click('button[role="tab"]:has-text("Status")');

    await page.click('button:has-text("Process More")');
    // Should switch to bookmarks tab
    await expect(page.locator(".bookmark-browser").or(page.locator(".config-guard"))).toBeVisible();
  });

  test("Clear History removes all results", async ({ popupPage: page }) => {
    await seedSettings(page, {
      apiKey: "sk-or-test-key-1234567890",
      vaultApiKey: "test-vault-key-12345",
    });
    const history: ProcessingResult[] = [
      { url: "https://example.com/1", status: "success", folder: "Inbox" },
    ];
    await seedLocalStorage(page, { processingHistory: history });
    await page.reload();
    await page.waitForSelector(".app");
    await page.click('button[role="tab"]:has-text("Status")');

    await expect(page.locator(".results-table")).toBeVisible();
    await page.click('button:has-text("Clear History")');
    await expect(page.locator(".empty-state")).toContainText("No processing history");
  });

  test("Skipped filter button only appears when skipped results exist", async ({
    popupPage: page,
  }) => {
    await seedSettings(page, {
      apiKey: "sk-or-test-key-1234567890",
      vaultApiKey: "test-vault-key-12345",
    });
    // No skipped results
    const history: ProcessingResult[] = [
      { url: "https://example.com/1", status: "success", folder: "Inbox" },
    ];
    await seedLocalStorage(page, { processingHistory: history });
    await page.reload();
    await page.waitForSelector(".app");
    await page.click('button[role="tab"]:has-text("Status")');

    await expect(page.locator('.filter-btn:has-text("Skipped")')).not.toBeVisible();
  });

  test("network error shows correct category badge and retry button", async ({ popupPage: page }) => {
    await seedSettings(page, {
      apiKey: "sk-or-test-key-1234567890",
      vaultApiKey: "test-vault-key-12345",
    });
    const history: ProcessingResult[] = [
      {
        url: "https://example.com/network-fail",
        status: "failed",
        error: "Failed to fetch",
        errorCategory: "network",
      },
    ];
    await seedLocalStorage(page, { processingHistory: history });
    await page.reload();
    await page.waitForSelector(".app");
    await page.click('button[role="tab"]:has-text("Status")');

    // Expand error row
    await page.click(".error-row-expandable");
    await expect(page.locator(".error-expanded-details")).toBeVisible();

    // Verify category-specific elements
    await expect(page.locator('button:has-text("Retry")')).toBeVisible();
    await expect(page.locator('button:has-text("Copy URL")')).toBeVisible();
  });

  test("login-required error shows no retry button", async ({ popupPage: page }) => {
    await seedSettings(page, {
      apiKey: "sk-or-test-key-1234567890",
      vaultApiKey: "test-vault-key-12345",
    });
    const history: ProcessingResult[] = [
      {
        url: "https://example.com/login-wall",
        status: "failed",
        error: "Content requires authentication",
        errorCategory: "login-required",
      },
    ];
    await seedLocalStorage(page, { processingHistory: history });
    await page.reload();
    await page.waitForSelector(".app");
    await page.click('button[role="tab"]:has-text("Status")');

    // Expand error row
    await page.click(".error-row-expandable");
    await expect(page.locator(".error-expanded-details")).toBeVisible();

    // Login-required errors should NOT show retry button (not retryable)
    await expect(page.locator('button:has-text("Retry")')).not.toBeVisible();
    await expect(page.locator('button:has-text("Open")')).toBeVisible();
    await expect(page.locator('button:has-text("Copy URL")')).toBeVisible();
  });

  test("vault error shows settings button", async ({ popupPage: page }) => {
    await seedSettings(page, {
      apiKey: "sk-or-test-key-1234567890",
      vaultApiKey: "test-vault-key-12345",
    });
    const history: ProcessingResult[] = [
      {
        url: "https://example.com/vault-fail",
        status: "failed",
        error: "Connection refused",
        errorCategory: "vault",
      },
    ];
    await seedLocalStorage(page, { processingHistory: history });
    await page.reload();
    await page.waitForSelector(".app");
    await page.click('button[role="tab"]:has-text("Status")');

    // Expand error row
    await page.click(".error-row-expandable");
    await expect(page.locator(".error-expanded-details")).toBeVisible();

    // Vault errors should show Settings button
    await expect(page.locator('button:has-text("Settings")')).toBeVisible();
    await expect(page.locator('button:has-text("Retry")')).toBeVisible();
  });

  test("timeout error shows retry button", async ({ popupPage: page }) => {
    await seedSettings(page, {
      apiKey: "sk-or-test-key-1234567890",
      vaultApiKey: "test-vault-key-12345",
    });
    const history: ProcessingResult[] = [
      {
        url: "https://example.com/timeout",
        status: "timeout",
        error: "Timed out after 30 seconds",
        errorCategory: "timeout",
      },
    ];
    await seedLocalStorage(page, { processingHistory: history });
    await page.reload();
    await page.waitForSelector(".app");
    await page.click('button[role="tab"]:has-text("Status")');

    // Expand error row
    await page.click(".error-row-expandable");
    await expect(page.locator(".error-expanded-details")).toBeVisible();

    // Timeout errors are retryable
    await expect(page.locator('button:has-text("Retry")')).toBeVisible();
  });

  test("multiple different error categories display correctly", async ({ popupPage: page }) => {
    await seedSettings(page, {
      apiKey: "sk-or-test-key-1234567890",
      vaultApiKey: "test-vault-key-12345",
    });
    const history: ProcessingResult[] = [
      {
        url: "https://example.com/network",
        status: "failed",
        error: "Network error",
        errorCategory: "network",
      },
      {
        url: "https://example.com/llm",
        status: "failed",
        error: "API error",
        errorCategory: "llm",
      },
      {
        url: "https://example.com/vault",
        status: "failed",
        error: "Vault error",
        errorCategory: "vault",
      },
    ];
    await seedLocalStorage(page, { processingHistory: history });
    await page.reload();
    await page.waitForSelector(".app");
    await page.click('button[role="tab"]:has-text("Status")');

    // All three errors should be visible in table
    const rows = page.locator(".results-table tbody tr");
    await expect(rows).toHaveCount(3);

    // Filter to failures only
    await page.click('.filter-btn:has-text("Failures")');
    await expect(rows).toHaveCount(3);
  });

  test("skipped row with skipReason is expandable and shows reason", async ({ popupPage: page }) => {
    await seedSettings(page, {
      apiKey: "sk-or-test-key-1234567890",
      vaultApiKey: "test-vault-key-12345",
    });
    const history: ProcessingResult[] = [
      {
        url: "https://example.com/duplicate",
        status: "skipped",
        skipReason: "Duplicate - note already exists in vault",
      },
    ];
    await seedLocalStorage(page, { processingHistory: history });
    await page.reload();
    await page.waitForSelector(".app");
    await page.click('button[role="tab"]:has-text("Status")');

    // Verify row is expandable
    const row = page.locator(".results-table tbody tr").first();
    await expect(row).toHaveClass(/error-row-expandable/);

    // Expand the row
    await row.click();
    await expect(page.locator(".skip-expanded-details")).toBeVisible();

    // Verify skip reason is displayed
    await expect(page.locator(".skip-reason-text")).toContainText("Duplicate - note already exists in vault");

    // Verify Remove button is available
    await expect(page.locator('.skip-expanded-details button:has-text("Remove")')).toBeVisible();
  });

  test("skipped row without skipReason is not expandable", async ({ popupPage: page }) => {
    await seedSettings(page, {
      apiKey: "sk-or-test-key-1234567890",
      vaultApiKey: "test-vault-key-12345",
    });
    const history: ProcessingResult[] = [
      {
        url: "https://example.com/skipped",
        status: "skipped",
        // No skipReason provided
      },
    ];
    await seedLocalStorage(page, { processingHistory: history });
    await page.reload();
    await page.waitForSelector(".app");
    await page.click('button[role="tab"]:has-text("Status")');

    // Verify row is NOT expandable (no error-row-expandable class)
    const row = page.locator(".results-table tbody tr").first();
    await expect(row).not.toHaveClass(/error-row-expandable/);

    // Verify no chevron icon appears
    await expect(page.locator(".error-toggle-icon")).not.toBeVisible();
  });
});
