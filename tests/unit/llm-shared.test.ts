import { describe, it, expect, vi } from "vitest";
import {
  buildSummarizationPrompt,
  buildCategorizationPrompt,
  validateCategorizationResult,
  getMaxTokensForDetailLevel,
  getSummarizeFunctionSchema,
} from "@/core/llm-shared";
import type { VaultContext, ExtractedContent, SummaryDetailLevel } from "@/core/types";

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

// -- Thread context hints in summarization prompt -----------------------------

describe("buildSummarizationPrompt - thread context hints", () => {
  it("adds X/Twitter thread hint when content has ## Top Replies", () => {
    const content = createContent({
      platform: "x",
      content: "## Thread\n\n**[1/2]** First tweet\n\n## Top Replies\n\n**@user:** Reply text",
    });
    const prompt = buildSummarizationPrompt(content);
    expect(prompt).toContain("Summarize the author's thread first");
    expect(prompt).toContain("discussion points from replies");
  });

  it("adds Reddit hint when content has ## Top Comments", () => {
    const content = createContent({
      platform: "reddit",
      content: "## Post\n\nPost body\n\n## Top Comments\n\n**u/user:** Comment text",
    });
    const prompt = buildSummarizationPrompt(content);
    expect(prompt).toContain("Summarize the post first");
    expect(prompt).toContain("insights from the discussion");
  });

  it("does not add hints for regular article content", () => {
    const content = createContent({ platform: "web", content: "Regular article content" });
    const prompt = buildSummarizationPrompt(content);
    expect(prompt).not.toContain("Summarize the author's thread");
    expect(prompt).not.toContain("Summarize the post first");
  });

  it("does not add hints for single-tweet content", () => {
    const content = createContent({ platform: "x", content: "Just a single tweet" });
    const prompt = buildSummarizationPrompt(content);
    expect(prompt).not.toContain("Summarize the author's thread");
  });
});

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

// -- Summary detail level in summarization prompt ----------------------------

describe("buildSummarizationPrompt - detail level", () => {
  it("includes brief instructions for brief level", () => {
    const prompt = buildSummarizationPrompt(createContent(), "brief");
    expect(prompt).toContain("1-2 sentence summary");
    expect(prompt).toContain("2-3 key takeaways");
  });

  it("includes standard instructions for standard level", () => {
    const prompt = buildSummarizationPrompt(createContent(), "standard");
    expect(prompt).toContain("2-3 sentence summary");
    expect(prompt).toContain("3-5 key takeaways");
  });

  it("includes detailed instructions for detailed level", () => {
    const prompt = buildSummarizationPrompt(createContent(), "detailed");
    expect(prompt).toContain("4-6 sentence summary");
    expect(prompt).toContain("5-8 key takeaways");
  });

  it("defaults to standard when no level provided", () => {
    const prompt = buildSummarizationPrompt(createContent());
    expect(prompt).toContain("2-3 sentence summary");
    expect(prompt).toContain("3-5 key takeaways");
  });

  it("still includes thread hints with detail level set", () => {
    const content = createContent({
      platform: "x",
      content: "## Thread\n\nFirst tweet\n\n## Top Replies\n\n**@user:** Reply",
    });
    const prompt = buildSummarizationPrompt(content, "detailed");
    expect(prompt).toContain("4-6 sentence summary");
    expect(prompt).toContain("Summarize the author's thread first");
  });
});

// -- getMaxTokensForDetailLevel -----------------------------------------------

describe("getMaxTokensForDetailLevel", () => {
  it("returns 512 for brief", () => {
    expect(getMaxTokensForDetailLevel("brief")).toBe(512);
  });

  it("returns 1024 for standard", () => {
    expect(getMaxTokensForDetailLevel("standard")).toBe(1024);
  });

  it("returns 1536 for detailed", () => {
    expect(getMaxTokensForDetailLevel("detailed")).toBe(1536);
  });
});

// -- getSummarizeFunctionSchema -----------------------------------------------

describe("getSummarizeFunctionSchema", () => {
  const levels: SummaryDetailLevel[] = ["brief", "standard", "detailed"];

  for (const level of levels) {
    it(`returns valid schema for ${level}`, () => {
      const schema = getSummarizeFunctionSchema(level);
      expect(schema.type).toBe("function");
      expect(schema.function.name).toBe("summarize_content");
      expect(schema.function.parameters.required).toEqual(["title", "summary", "keyTakeaways"]);
    });
  }

  it("brief schema describes 1-2 sentences", () => {
    const schema = getSummarizeFunctionSchema("brief");
    expect(schema.function.parameters.properties.summary.description).toContain("1-2");
    expect(schema.function.parameters.properties.keyTakeaways.description).toContain("2-3");
  });

  it("standard schema describes 2-3 sentences", () => {
    const schema = getSummarizeFunctionSchema("standard");
    expect(schema.function.parameters.properties.summary.description).toContain("2-3");
    expect(schema.function.parameters.properties.keyTakeaways.description).toContain("3-5");
  });

  it("detailed schema describes 4-6 sentences", () => {
    const schema = getSummarizeFunctionSchema("detailed");
    expect(schema.function.parameters.properties.summary.description).toContain("4-6");
    expect(schema.function.parameters.properties.keyTakeaways.description).toContain("5-8");
  });
});
