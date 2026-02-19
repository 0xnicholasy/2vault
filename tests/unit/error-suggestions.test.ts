import { describe, it, expect } from "vitest";
import { ERROR_SUGGESTIONS, QUALITY_SUGGESTIONS } from "@/utils/error-suggestions";
import type { ErrorCategory, ContentQualityReason } from "@/core/types";

const ALL_ERROR_CATEGORIES: ErrorCategory[] = [
  "network",
  "extraction",
  "llm",
  "vault",
  "timeout",
  "unknown",
];

const ALL_QUALITY_REASONS: ContentQualityReason[] = [
  "login-wall",
  "bot-protection",
  "soft-404",
  "deleted-content",
  "insufficient-content",
  "error-page",
];

describe("ERROR_SUGGESTIONS", () => {
  it("has entries for all ErrorCategory values", () => {
    for (const category of ALL_ERROR_CATEGORIES) {
      expect(
        ERROR_SUGGESTIONS[category],
        `Missing ERROR_SUGGESTIONS entry for category: "${category}"`
      ).toBeDefined();
      expect(typeof ERROR_SUGGESTIONS[category]).toBe("string");
      expect(ERROR_SUGGESTIONS[category].length).toBeGreaterThan(0);
    }
  });

  it("does not have unknown extra keys beyond the ErrorCategory union", () => {
    const definedKeys = Object.keys(ERROR_SUGGESTIONS);
    for (const key of definedKeys) {
      expect(
        ALL_ERROR_CATEGORIES,
        `ERROR_SUGGESTIONS has unexpected key: "${key}"`
      ).toContain(key);
    }
  });

  it("network suggestion mentions connection or retry", () => {
    const suggestion = ERROR_SUGGESTIONS["network"].toLowerCase();
    const mentionsConnectionOrRetry =
      suggestion.includes("connection") || suggestion.includes("try again");
    expect(mentionsConnectionOrRetry).toBe(true);
  });

  it("vault suggestion mentions Obsidian", () => {
    const suggestion = ERROR_SUGGESTIONS["vault"].toLowerCase();
    expect(suggestion).toContain("obsidian");
  });

  it("llm suggestion mentions API key or settings", () => {
    const suggestion = ERROR_SUGGESTIONS["llm"].toLowerCase();
    const mentionsApiOrSettings =
      suggestion.includes("api key") || suggestion.includes("settings");
    expect(mentionsApiOrSettings).toBe(true);
  });

  it("timeout suggestion mentions retry", () => {
    const suggestion = ERROR_SUGGESTIONS["timeout"].toLowerCase();
    const mentionsRetry =
      suggestion.includes("try again") || suggestion.includes("retry");
    expect(mentionsRetry).toBe(true);
  });
});

describe("QUALITY_SUGGESTIONS", () => {
  it("has entries for all ContentQualityReason values", () => {
    for (const reason of ALL_QUALITY_REASONS) {
      expect(
        QUALITY_SUGGESTIONS[reason],
        `Missing QUALITY_SUGGESTIONS entry for reason: "${reason}"`
      ).toBeDefined();
      expect(typeof QUALITY_SUGGESTIONS[reason]).toBe("string");
      expect(QUALITY_SUGGESTIONS[reason].length).toBeGreaterThan(0);
    }
  });

  it("does not have unknown extra keys beyond the ContentQualityReason union", () => {
    const definedKeys = Object.keys(QUALITY_SUGGESTIONS);
    for (const key of definedKeys) {
      expect(
        ALL_QUALITY_REASONS,
        `QUALITY_SUGGESTIONS has unexpected key: "${key}"`
      ).toContain(key);
    }
  });

  it("error-page suggestion contains retry advice", () => {
    const suggestion = QUALITY_SUGGESTIONS["error-page"].toLowerCase();
    const mentionsRetry =
      suggestion.includes("try again") ||
      suggestion.includes("retry") ||
      suggestion.includes("later");
    expect(mentionsRetry).toBe(true);
  });

  it("login-wall suggestion mentions browser or login", () => {
    const suggestion = QUALITY_SUGGESTIONS["login-wall"].toLowerCase();
    const mentionsLoginOrBrowser =
      suggestion.includes("login") ||
      suggestion.includes("log in") ||
      suggestion.includes("browser");
    expect(mentionsLoginOrBrowser).toBe(true);
  });

  it("bot-protection suggestion mentions keyboard shortcut or page", () => {
    const suggestion = QUALITY_SUGGESTIONS["bot-protection"].toLowerCase();
    const mentionsAccessMethod =
      suggestion.includes("keyboard") ||
      suggestion.includes("page") ||
      suggestion.includes("access");
    expect(mentionsAccessMethod).toBe(true);
  });

  it("deleted-content suggestion mentions deleted or content", () => {
    const suggestion = QUALITY_SUGGESTIONS["deleted-content"].toLowerCase();
    const mentionsDeletion =
      suggestion.includes("deleted") || suggestion.includes("content");
    expect(mentionsDeletion).toBe(true);
  });

  it("soft-404 suggestion mentions page existence", () => {
    const suggestion = QUALITY_SUGGESTIONS["soft-404"].toLowerCase();
    const mentionsExistence =
      suggestion.includes("page") ||
      suggestion.includes("exist") ||
      suggestion.includes("available");
    expect(mentionsExistence).toBe(true);
  });

  it("insufficient-content suggestion mentions content or extraction", () => {
    const suggestion = QUALITY_SUGGESTIONS["insufficient-content"].toLowerCase();
    const mentionsContent =
      suggestion.includes("content") || suggestion.includes("extracted");
    expect(mentionsContent).toBe(true);
  });
});
