import { test, expect, clearStorage } from "./fixtures";

test.describe("Popup Navigation & Layout", () => {
  test.beforeEach(async ({ popupPage }) => {
    await clearStorage(popupPage);
  });

  test("popup renders with header and tabs", async ({ popupPage: page }) => {
    await expect(page.locator(".app-header h1")).toContainText("2Vault");
    await expect(page.locator('.tab-btn:has-text("Settings")')).toBeVisible();
    await expect(page.locator('.tab-btn:has-text("Bookmarks")')).toBeVisible();
    await expect(page.locator('.tab-btn:has-text("Status")')).toBeVisible();
  });

  test("Bookmarks tab is active by default", async ({ popupPage: page }) => {
    const bookmarksBtn = page.locator('.tab-btn:has-text("Bookmarks")');
    await expect(bookmarksBtn).toHaveAttribute("aria-selected", "true");
  });

  test("clicking tabs switches content", async ({ popupPage: page }) => {
    // Switch to Settings
    await page.click('.tab-btn:has-text("Settings")');
    await expect(page.locator('.tab-btn:has-text("Settings")')).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(page.locator("#apiKey")).toBeVisible();

    // Switch to Status
    await page.click('.tab-btn:has-text("Status")');
    await expect(page.locator('.tab-btn:has-text("Status")')).toHaveAttribute(
      "aria-selected",
      "true"
    );
    // Status tab shows either config guard or results
    await expect(
      page.locator(".status-tab").or(page.locator(".config-guard-inline"))
    ).toBeVisible();

    // Switch back to Bookmarks
    await page.click('.tab-btn:has-text("Bookmarks")');
    await expect(page.locator('.tab-btn:has-text("Bookmarks")')).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  test("all three tabs render without errors", async ({ popupPage: page }) => {
    // No console errors during tab switching
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.click('.tab-btn:has-text("Settings")');
    await page.waitForTimeout(300);
    await page.click('.tab-btn:has-text("Status")');
    await page.waitForTimeout(300);
    await page.click('.tab-btn:has-text("Bookmarks")');
    await page.waitForTimeout(300);

    expect(errors).toHaveLength(0);
  });
});
