import { describe, it, expect, vi } from "vitest";
import {
  buildCategorizationPrompt,
  validateCategorizationResult,
} from "@/core/llm-shared";
import type { VaultContext, ExtractedContent } from "@/core/types";

function createSummarized() {
  return {
    title: "Test Article",
    summary: "A summary of the test article.",
    keyTakeaways: ["Takeaway 1"],
  };
}

function createContent(overrides?: Partial<ExtractedContent>): ExtractedContent {
  return {
    url: "https://example.com/article",
    title: "Test Article",
    content: "Content here.",
    author: "Jane Doe",
    datePublished: "2026-01-15",
    wordCount: 500,
    type: "article",
    platform: "web",
    status: "success",
    ...overrides,
  };
}

function createVaultContext(overrides?: Partial<VaultContext>): VaultContext {
  return {
    folders: ["Inbox", "Resources/AI"],
    tags: ["ai", "programming"],
    recentNotes: [],
    tagGroups: [],
    organization: "custom",
    ...overrides,
  };
}

// -- PARA-aware prompt --------------------------------------------------------

describe("buildCategorizationPrompt - PARA mode", () => {
  it("includes PARA instructions when organization is para", () => {
    const context = createVaultContext({ organization: "para" });
    const prompt = buildCategorizationPrompt(createSummarized(), createContent(), context);

    expect(prompt).toContain("PARA organization system");
    expect(prompt).toContain("Projects:");
    expect(prompt).toContain("Areas:");
    expect(prompt).toContain("Resources:");
    expect(prompt).toContain("Archive:");
  });

  it("does not include PARA instructions when organization is custom", () => {
    const context = createVaultContext({ organization: "custom" });
    const prompt = buildCategorizationPrompt(createSummarized(), createContent(), context);

    expect(prompt).not.toContain("PARA organization system");
  });
});

// -- Tag groups in prompt -----------------------------------------------------

describe("buildCategorizationPrompt - tag groups", () => {
  it("renders tag groups in prompt when provided", () => {
    const context = createVaultContext({
      tagGroups: [
        { name: "Tech", tags: ["ai", "ml", "data-science"] },
        { name: "Career", tags: ["interview", "resume"] },
      ],
    });

    const prompt = buildCategorizationPrompt(createSummarized(), createContent(), context);

    expect(prompt).toContain("User-defined tag groups");
    expect(prompt).toContain("Tech: ai, ml, data-science");
    expect(prompt).toContain("Career: interview, resume");
    expect(prompt).toContain("Prefer tags from the above user-defined groups");
  });

  it("does not render tag groups section when empty", () => {
    const context = createVaultContext({ tagGroups: [] });
    const prompt = buildCategorizationPrompt(createSummarized(), createContent(), context);

    expect(prompt).not.toContain("User-defined tag groups");
  });
});

// -- Tag consistency validation -----------------------------------------------

describe("validateCategorizationResult - tag groups warning", () => {
  it("warns when LLM invents tags not in groups", () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    validateCategorizationResult(
      { suggestedFolder: "Inbox", suggestedTags: ["ai", "new-tag"] },
      ["Inbox"],
      [{ name: "Tech", tags: ["ai", "ml"] }]
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("new-tag")
    );
    consoleSpy.mockRestore();
  });

  it("does not warn when all tags are in groups", () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    validateCategorizationResult(
      { suggestedFolder: "Inbox", suggestedTags: ["ai", "ml"] },
      ["Inbox"],
      [{ name: "Tech", tags: ["ai", "ml"] }]
    );

    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("does not warn when no tag groups defined", () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    validateCategorizationResult(
      { suggestedFolder: "Inbox", suggestedTags: ["ai", "new-tag"] },
      ["Inbox"]
    );

    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
