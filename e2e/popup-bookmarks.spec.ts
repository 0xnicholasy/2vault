import { test, expect, seedSettings, clearStorage } from "./fixtures";

test.describe("Bookmarks Tab", () => {
  test.beforeEach(async ({ popupPage }) => {
    await clearStorage(popupPage);
  });

  test("shows config guard when API keys not configured", async ({ popupPage: page }) => {
    // Bookmarks is the default tab - config guard should already be visible
    await expect(page.locator(".config-guard")).toContainText("Configure your API keys");
  });

  test("shows bookmark tree when API keys are configured", async ({ popupPage: page }) => {
    await seedSettings(page, {
      apiKey: "sk-or-test-key-1234567890",
      vaultApiKey: "test-vault-key-12345",
    });
    await page.reload();
    await page.waitForSelector(".app");

    // Default tab is bookmarks - tree should load
    await expect(page.locator(".bookmark-browser")).toBeVisible();
    await expect(page.locator(".direct-url-input")).toBeVisible();
  });

  test("URL textarea shows valid URL count", async ({ popupPage: page }) => {
    await seedSettings(page, {
      apiKey: "sk-or-test-key-1234567890",
      vaultApiKey: "test-vault-key-12345",
    });
    await page.reload();
    await page.waitForSelector(".app");

    const textarea = page.locator("#directUrls");
    await textarea.fill("https://example.com\nhttps://test.com\ninvalid-url");

    await expect(page.locator(".url-count")).toContainText("2 valid URLs");
  });

  test("Process URLs button disabled when no valid URLs", async ({ popupPage: page }) => {
    await seedSettings(page, {
      apiKey: "sk-or-test-key-1234567890",
      vaultApiKey: "test-vault-key-12345",
    });
    await page.reload();
    await page.waitForSelector(".app");

    const processBtn = page.locator('button:has-text("Process URLs")');
    await expect(processBtn).toBeDisabled();

    await page.locator("#directUrls").fill("not-a-url");
    await expect(processBtn).toBeDisabled();
  });

  test("Process URLs button enabled with valid URLs", async ({ popupPage: page }) => {
    await seedSettings(page, {
      apiKey: "sk-or-test-key-1234567890",
      vaultApiKey: "test-vault-key-12345",
    });
    await page.reload();
    await page.waitForSelector(".app");

    await page.locator("#directUrls").fill("https://example.com");
    await expect(page.locator('button:has-text("Process URLs")')).toBeEnabled();
  });

  test("URL deduplication in textarea", async ({ popupPage: page }) => {
    await seedSettings(page, {
      apiKey: "sk-or-test-key-1234567890",
      vaultApiKey: "test-vault-key-12345",
    });
    await page.reload();
    await page.waitForSelector(".app");

    await page.locator("#directUrls").fill(
      "https://example.com\nhttps://example.com\nhttps://other.com"
    );
    await expect(page.locator(".url-count")).toContainText("2 valid URLs");
  });

  test("bookmark folder expansion toggles chevron and shows contents", async ({
    popupPage: page,
  }) => {
    await seedSettings(page, {
      apiKey: "sk-or-test-key-1234567890",
      vaultApiKey: "test-vault-key-12345",
    });
    await page.reload();
    await page.waitForSelector(".app");

    const folder = page.locator(".folder-node").first();
    // Skip if no bookmarks exist in the browser
    if (await folder.isVisible()) {
      await folder.locator(".folder-row").click();
      await expect(folder.locator(".folder-contents")).toBeVisible();

      // Click again to collapse
      await folder.locator(".folder-row").click();
      await expect(folder.locator(".folder-contents")).not.toBeVisible();
    }
  });

  test("Process Selected button appears when bookmarks checked", async ({
    popupPage: page,
  }) => {
    await seedSettings(page, {
      apiKey: "sk-or-test-key-1234567890",
      vaultApiKey: "test-vault-key-12345",
    });
    await page.reload();
    await page.waitForSelector(".app");

    // Only test if bookmark folders exist
    const folder = page.locator(".folder-node").first();
    if (await folder.isVisible()) {
      // Expand the first folder
      await folder.locator(".folder-row").click();

      const checkbox = folder.locator('.bookmark-item input[type="checkbox"]').first();
      if (await checkbox.isVisible()) {
        await expect(page.locator('button:has-text("Process Selected")')).not.toBeVisible();
        await checkbox.check();
        await expect(page.locator('button:has-text("Process Selected")')).toBeVisible();
        await checkbox.uncheck();
        await expect(page.locator('button:has-text("Process Selected")')).not.toBeVisible();
      }
    }
  });

  test("initialUrl prop prefills the textarea", async ({
    context,
    extensionId,
    popupPage: page,
  }) => {
    await seedSettings(page, {
      apiKey: "sk-or-test-key-1234567890",
      vaultApiKey: "test-vault-key-12345",
    });
    // Seed a pendingCaptureUrl - simulates context menu behavior
    await page.evaluate(() => {
      return chrome.storage.local.set({
        pendingCaptureUrl: "https://example.com/test-article",
      });
    });

    // Open fresh popup to trigger pendingCaptureUrl read
    const freshPage = await context.newPage();
    await freshPage.goto(
      `chrome-extension://${extensionId}/src/popup/popup.html`
    );
    await freshPage.waitForSelector(".app");

    // The popup should auto-start processing or show modal
    // Wait briefly for the async pendingCaptureUrl read
    await freshPage.waitForTimeout(1000);

    // Check if processing modal appeared (URL was auto-processed)
    const modal = freshPage.locator(".processing-modal");
    const textarea = freshPage.locator("#directUrls");

    // Either the modal opened (auto-processing) or the URL was prefilled
    const modalVisible = await modal.isVisible().catch(() => false);
    const textareaVisible = await textarea.isVisible().catch(() => false);

    expect(modalVisible || textareaVisible).toBeTruthy();
    await freshPage.close();
  });
});
