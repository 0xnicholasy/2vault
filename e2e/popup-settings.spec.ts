import { test, expect, seedSettings, readSyncStorage, clearStorage } from "./fixtures";

test.describe("Settings Tab", () => {
  test.beforeEach(async ({ popupPage }) => {
    await clearStorage(popupPage);
  });

  test("navigates to Settings tab and shows form fields", async ({ popupPage: page }) => {
    await page.click('button[role="tab"]:has-text("Settings")');
    await expect(page.locator("#apiKey")).toBeVisible();
    await expect(page.locator("#vaultUrlPreset")).toBeVisible();
    await expect(page.locator("#vaultApiKey")).toBeVisible();
    await expect(page.locator("#vaultName")).toBeVisible();
  });

  test("loads saved settings from storage on mount", async ({ popupPage: page }) => {
    await seedSettings(page, {
      apiKey: "sk-or-test-key-1234567890",
      vaultApiKey: "my-vault-key-12345",
      vaultName: "TestVault",
    });
    // Reload to pick up seeded values
    await page.reload();
    await page.waitForSelector(".app");
    await page.click('button[role="tab"]:has-text("Settings")');

    await expect(page.locator("#vaultName")).toHaveValue("TestVault");
  });

  test("shows inline error for invalid OpenRouter key format", async ({ popupPage: page }) => {
    await page.click('button[role="tab"]:has-text("Settings")');
    await page.fill("#apiKey", "bad-key");
    await expect(page.locator(".form-error")).toContainText("Must start with 'sk-or-'");
  });

  test("shows inline error for short vault API key", async ({ popupPage: page }) => {
    await page.click('button[role="tab"]:has-text("Settings")');
    await page.fill("#vaultApiKey", "ab");
    await expect(page.locator(".form-error")).toContainText("too short");
  });

  test("no error shown for valid OpenRouter key", async ({ popupPage: page }) => {
    await page.click('button[role="tab"]:has-text("Settings")');
    await page.fill("#apiKey", "sk-or-valid-key-1234567890");
    await expect(page.locator(".form-error")).not.toBeVisible();
  });

  test("toggles API key visibility", async ({ popupPage: page }) => {
    await page.click('button[role="tab"]:has-text("Settings")');
    const input = page.locator("#apiKey");
    await expect(input).toHaveAttribute("type", "password");

    await page.click('button[aria-label="Show API key"]');
    await expect(input).toHaveAttribute("type", "text");

    await page.click('button[aria-label="Hide API key"]');
    await expect(input).toHaveAttribute("type", "password");
  });

  test("toggles vault API key visibility", async ({ popupPage: page }) => {
    await page.click('button[role="tab"]:has-text("Settings")');
    const input = page.locator("#vaultApiKey");
    await expect(input).toHaveAttribute("type", "password");

    await page.click('button[aria-label="Show vault API key"]');
    await expect(input).toHaveAttribute("type", "text");

    await page.click('button[aria-label="Hide vault API key"]');
    await expect(input).toHaveAttribute("type", "password");
  });

  test("vault URL preset dropdown changes URL", async ({ popupPage: page }) => {
    await page.click('button[role="tab"]:has-text("Settings")');
    await page.selectOption("#vaultUrlPreset", "http://localhost:27123");
    // Custom input should NOT be visible for non-custom presets
    await expect(page.locator("#vaultUrl")).not.toBeVisible();
  });

  test("selecting custom vault URL shows freeform input", async ({ popupPage: page }) => {
    await page.click('button[role="tab"]:has-text("Settings")');
    await page.selectOption("#vaultUrlPreset", "custom");
    await expect(page.locator("#vaultUrl")).toBeVisible();
    await page.fill("#vaultUrl", "https://my-server:9999");
  });

  test("PARA organization mode shows folder descriptions", async ({ popupPage: page }) => {
    await page.click('button[role="tab"]:has-text("Settings")');
    // PARA is default
    await expect(page.locator('input[name="vaultOrganization"][value="para"]')).toBeChecked();
    await expect(page.locator(".para-description")).toBeVisible();
    await expect(page.locator(".para-description")).toContainText("Projects");
    await expect(page.locator(".para-description")).toContainText("Archive");
  });

  test("switching to Custom hides PARA descriptions", async ({ popupPage: page }) => {
    await page.click('button[role="tab"]:has-text("Settings")');
    await page.click('input[name="vaultOrganization"][value="custom"]');
    await expect(page.locator(".para-description")).not.toBeVisible();
  });

  test("Save Settings button disabled until changes made", async ({ popupPage: page }) => {
    await page.click('button[role="tab"]:has-text("Settings")');
    const saveBtn = page.locator('button:has-text("Save Settings")');
    await expect(saveBtn).toBeDisabled();

    // Make a change
    await page.fill("#vaultName", "NewVault");
    await expect(saveBtn).toBeEnabled();
  });

  test("Save Settings persists to chrome.storage.sync", async ({ popupPage: page }) => {
    await page.click('button[role="tab"]:has-text("Settings")');
    await page.fill("#apiKey", "sk-or-my-test-key-12345678");
    await page.fill("#vaultApiKey", "vault-key-12345");
    await page.fill("#vaultName", "MyVault");

    await page.click('button:has-text("Save Settings")');
    await expect(page.locator(".status-success")).toContainText("Saved");

    const stored = await readSyncStorage(page, [
      "apiKey",
      "vaultApiKey",
      "vaultName",
    ]);
    expect(stored["apiKey"]).toBe("sk-or-my-test-key-12345678");
    expect(stored["vaultApiKey"]).toBe("vault-key-12345");
    expect(stored["vaultName"]).toBe("MyVault");
  });

  test("Save Settings disabled when validation errors exist", async ({ popupPage: page }) => {
    await page.click('button[role="tab"]:has-text("Settings")');
    await page.fill("#apiKey", "bad"); // Invalid format
    await expect(page.locator('button:has-text("Save Settings")')).toBeDisabled();
  });

  test("Test Connections button shows testing state", async ({ popupPage: page }) => {
    await page.click('button[role="tab"]:has-text("Settings")');
    await page.click('button:has-text("Test Connections")');

    // Should show testing... or results
    await expect(
      page.locator(".connection-results").or(page.locator('button:has-text("Testing...")'))
    ).toBeVisible();
  });

  test("Test Connections shows error when no keys configured", async ({ popupPage: page }) => {
    await page.click('button[role="tab"]:has-text("Settings")');
    await page.click('button:has-text("Test Connections")');

    // Wait for results
    await expect(page.locator(".connection-results")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".status-error").first()).toBeVisible();
  });
});

test.describe("Tag Group Editor", () => {
  test.beforeEach(async ({ popupPage }) => {
    await clearStorage(popupPage);
  });

  test("Add Group creates empty tag group", async ({ popupPage: page }) => {
    await page.click('button[role="tab"]:has-text("Settings")');
    await page.click('button:has-text("Add Group")');
    await expect(page.locator(".tag-group-item")).toHaveCount(1);
    await expect(page.locator('.tag-group-item input[placeholder="Group name"]')).toBeVisible();
  });

  test("editing tag group name updates in real time", async ({ popupPage: page }) => {
    await page.click('button[role="tab"]:has-text("Settings")');
    await page.click('button:has-text("Add Group")');
    const nameInput = page.locator('.tag-group-item input[placeholder="Group name"]');
    await nameInput.fill("Technology");
    await expect(nameInput).toHaveValue("Technology");
  });

  test("adding tags via Enter key", async ({ popupPage: page }) => {
    await page.click('button[role="tab"]:has-text("Settings")');
    await page.click('button:has-text("Add Group")');

    const tagInput = page.locator('.tag-input[placeholder="Add tag..."]');
    await tagInput.fill("typescript");
    await tagInput.press("Enter");
    await expect(page.locator(".tag-chip")).toContainText("typescript");

    // Input should be cleared after adding
    await expect(tagInput).toHaveValue("");
  });

  test("adding tags via comma key", async ({ popupPage: page }) => {
    await page.click('button[role="tab"]:has-text("Settings")');
    await page.click('button:has-text("Add Group")');

    const tagInput = page.locator('.tag-input[placeholder="Add tag..."]');
    await tagInput.fill("react");
    await tagInput.press(",");
    await expect(page.locator(".tag-chip")).toContainText("react");
  });

  test("duplicate tags are rejected silently", async ({ popupPage: page }) => {
    await page.click('button[role="tab"]:has-text("Settings")');
    await page.click('button:has-text("Add Group")');

    const tagInput = page.locator('.tag-input[placeholder="Add tag..."]');
    await tagInput.fill("test");
    await tagInput.press("Enter");
    await tagInput.fill("test");
    await tagInput.press("Enter");

    await expect(page.locator(".tag-chip")).toHaveCount(1);
  });

  test("removing a tag from group", async ({ popupPage: page }) => {
    await page.click('button[role="tab"]:has-text("Settings")');
    await page.click('button:has-text("Add Group")');

    const tagInput = page.locator('.tag-input[placeholder="Add tag..."]');
    await tagInput.fill("remove-me");
    await tagInput.press("Enter");
    await expect(page.locator(".tag-chip")).toHaveCount(1);

    await page.click('button[aria-label="Remove tag remove-me"]');
    await expect(page.locator(".tag-chip")).toHaveCount(0);
  });

  test("removing entire tag group", async ({ popupPage: page }) => {
    await page.click('button[role="tab"]:has-text("Settings")');
    await page.click('button:has-text("Add Group")');
    await expect(page.locator(".tag-group-item")).toHaveCount(1);

    await page.click('button[aria-label="Remove group"]');
    await expect(page.locator(".tag-group-item")).toHaveCount(0);
  });
});
