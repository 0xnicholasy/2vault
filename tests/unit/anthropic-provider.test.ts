import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ExtractedContent, VaultContext } from "@/core/types";
import { LLMProcessingError } from "@/core/types";

// Mock the Anthropic SDK at module level
const mockCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
    constructor() {}
  },
}));

// Import after mocking
import { AnthropicProvider } from "@/core/anthropic-provider";

const TEST_API_KEY = "sk-ant-test-key-123";

const sampleContent: ExtractedContent = {
  url: "https://example.com/article",
  title: "Understanding TypeScript Generics",
  content:
    "TypeScript generics allow you to write reusable, type-safe code...",
  author: "Jane Doe",
  datePublished: "2025-06-15T10:00:00Z",
  wordCount: 1500,
  type: "article",
  platform: "web",
  status: "success",
};

const socialMediaContent: ExtractedContent = {
  url: "https://x.com/user/status/123456",
  title: "Thread on AI safety",
  content: "AI safety is important because...",
  author: "@airesearcher",
  datePublished: "2025-07-01T14:30:00Z",
  wordCount: 280,
  type: "social-media",
  platform: "x",
  status: "success",
};

const sampleVaultContext: VaultContext = {
  folders: [
    "Daily",
    "Inbox",
    "Projects/2Vault",
    "Reading/Articles",
    "Resources/AI",
    "Resources/Programming",
  ],
  tags: ["ai", "programming", "typescript", "architecture", "rust"],
  recentNotes: [
    { folder: "Resources/Programming", title: "TypeScript Patterns", tags: ["typescript", "programming"] },
    { folder: "Resources/AI", title: "GPT-4 Architecture", tags: ["ai", "llm"] },
  ],
};

function mockSummarizationResponse(overrides?: Record<string, unknown>) {
  return {
    id: "msg_summarize_123",
    type: "message",
    role: "assistant",
    content: [
      {
        type: "tool_use",
        id: "toolu_sum_123",
        name: "summarize_content",
        input: {
          title: "TypeScript Generics Explained",
          summary:
            "A comprehensive guide to TypeScript generics for writing reusable, type-safe code.",
          keyTakeaways: [
            "Generics enable type-safe reusable code",
            "Constraints limit generic types",
            "Utility types leverage generics extensively",
          ],
          ...overrides,
        },
      },
    ],
    model: "claude-haiku-4-5-20251001",
    stop_reason: "tool_use",
    usage: { input_tokens: 500, output_tokens: 200 },
  };
}

function mockCategorizationResponse(overrides?: Record<string, unknown>) {
  return {
    id: "msg_categorize_123",
    type: "message",
    role: "assistant",
    content: [
      {
        type: "tool_use",
        id: "toolu_cat_123",
        name: "categorize_content",
        input: {
          suggestedFolder: "Resources/Programming",
          suggestedTags: ["typescript", "programming", "generics"],
          ...overrides,
        },
      },
    ],
    model: "claude-sonnet-4-5-20250929",
    stop_reason: "tool_use",
    usage: { input_tokens: 800, output_tokens: 150 },
  };
}

beforeEach(() => {
  mockCreate.mockReset();
});

// -- Two-call architecture ----------------------------------------------------

describe("AnthropicProvider.processContent", () => {
  it("makes two API calls (summarization then categorization)", async () => {
    mockCreate
      .mockResolvedValueOnce(mockSummarizationResponse())
      .mockResolvedValueOnce(mockCategorizationResponse());

    const provider = new AnthropicProvider(TEST_API_KEY);
    await provider.processContent(sampleContent, sampleVaultContext);

    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("uses Haiku for summarization (call 1)", async () => {
    mockCreate
      .mockResolvedValueOnce(mockSummarizationResponse())
      .mockResolvedValueOnce(mockCategorizationResponse());

    const provider = new AnthropicProvider(TEST_API_KEY);
    await provider.processContent(sampleContent, sampleVaultContext);

    const firstCallArgs = mockCreate.mock.calls[0]![0] as Record<string, unknown>;
    expect(firstCallArgs.model).toBe("claude-haiku-4-5-20251001");
  });

  it("uses Sonnet for categorization (call 2)", async () => {
    mockCreate
      .mockResolvedValueOnce(mockSummarizationResponse())
      .mockResolvedValueOnce(mockCategorizationResponse());

    const provider = new AnthropicProvider(TEST_API_KEY);
    await provider.processContent(sampleContent, sampleVaultContext);

    const secondCallArgs = mockCreate.mock.calls[1]![0] as Record<string, unknown>;
    expect(secondCallArgs.model).toBe("claude-sonnet-4-5-20250929");
  });

  it("forces tool_choice on both calls", async () => {
    mockCreate
      .mockResolvedValueOnce(mockSummarizationResponse())
      .mockResolvedValueOnce(mockCategorizationResponse());

    const provider = new AnthropicProvider(TEST_API_KEY);
    await provider.processContent(sampleContent, sampleVaultContext);

    const firstCallArgs = mockCreate.mock.calls[0]![0] as Record<string, unknown>;
    expect(firstCallArgs.tool_choice).toEqual({
      type: "tool",
      name: "summarize_content",
    });

    const secondCallArgs = mockCreate.mock.calls[1]![0] as Record<string, unknown>;
    expect(secondCallArgs.tool_choice).toEqual({
      type: "tool",
      name: "categorize_content",
    });
  });

  it("returns correct ProcessedNote structure", async () => {
    mockCreate
      .mockResolvedValueOnce(mockSummarizationResponse())
      .mockResolvedValueOnce(mockCategorizationResponse());

    const provider = new AnthropicProvider(TEST_API_KEY);
    const result = await provider.processContent(
      sampleContent,
      sampleVaultContext
    );

    expect(result).toEqual({
      title: "TypeScript Generics Explained",
      summary:
        "A comprehensive guide to TypeScript generics for writing reusable, type-safe code.",
      keyTakeaways: [
        "Generics enable type-safe reusable code",
        "Constraints limit generic types",
        "Utility types leverage generics extensively",
      ],
      suggestedFolder: "Resources/Programming",
      suggestedTags: ["typescript", "programming", "generics"],
      type: "article",
      platform: "web",
      source: sampleContent,
    });
  });

  it("includes vault context in categorization prompt", async () => {
    mockCreate
      .mockResolvedValueOnce(mockSummarizationResponse())
      .mockResolvedValueOnce(mockCategorizationResponse());

    const provider = new AnthropicProvider(TEST_API_KEY);
    await provider.processContent(sampleContent, sampleVaultContext);

    const secondCallArgs = mockCreate.mock.calls[1]![0] as Record<string, unknown>;
    const messages = secondCallArgs.messages as Array<{
      role: string;
      content: string;
    }>;
    const prompt = messages[0]!.content;

    // Prompt should contain vault folders and tags
    expect(prompt).toContain("Resources/Programming");
    expect(prompt).toContain("Resources/AI");
    expect(prompt).toContain("typescript");
    expect(prompt).toContain("programming");
  });
});

// -- Folder fallback ----------------------------------------------------------

describe("folder validation", () => {
  it("falls back to first folder if LLM suggests non-existent one", async () => {
    mockCreate
      .mockResolvedValueOnce(mockSummarizationResponse())
      .mockResolvedValueOnce(
        mockCategorizationResponse({
          suggestedFolder: "NonExistent/Folder",
        })
      );

    const provider = new AnthropicProvider(TEST_API_KEY);
    const result = await provider.processContent(
      sampleContent,
      sampleVaultContext
    );

    expect(result.suggestedFolder).toBe("Daily");
  });

  it("keeps valid folder suggestion", async () => {
    mockCreate
      .mockResolvedValueOnce(mockSummarizationResponse())
      .mockResolvedValueOnce(
        mockCategorizationResponse({
          suggestedFolder: "Resources/AI",
        })
      );

    const provider = new AnthropicProvider(TEST_API_KEY);
    const result = await provider.processContent(
      sampleContent,
      sampleVaultContext
    );

    expect(result.suggestedFolder).toBe("Resources/AI");
  });
});

// -- Error handling -----------------------------------------------------------

describe("error handling", () => {
  it("throws LLMProcessingError with stage 'summarization' on Haiku failure", async () => {
    mockCreate.mockRejectedValueOnce(new Error("API rate limited"));

    const provider = new AnthropicProvider(TEST_API_KEY);

    try {
      await provider.processContent(sampleContent, sampleVaultContext);
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(LLMProcessingError);
      const llmErr = err as LLMProcessingError;
      expect(llmErr.stage).toBe("summarization");
      expect(llmErr.message).toContain("Summarization API call failed");
    }
  });

  it("throws LLMProcessingError with stage 'categorization' on Sonnet failure", async () => {
    mockCreate
      .mockResolvedValueOnce(mockSummarizationResponse())
      .mockRejectedValueOnce(new Error("API rate limited"));

    const provider = new AnthropicProvider(TEST_API_KEY);

    try {
      await provider.processContent(sampleContent, sampleVaultContext);
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(LLMProcessingError);
      const llmErr = err as LLMProcessingError;
      expect(llmErr.stage).toBe("categorization");
      expect(llmErr.message).toContain("Categorization API call failed");
    }
  });

  it("throws LLMProcessingError when response has no tool_use block", async () => {
    mockCreate.mockResolvedValueOnce({
      id: "msg_no_tool",
      type: "message",
      role: "assistant",
      content: [
        { type: "text", text: "I cannot summarize this content." },
      ],
      model: "claude-haiku-4-5-20251001",
      stop_reason: "end_turn",
      usage: { input_tokens: 500, output_tokens: 50 },
    });

    const provider = new AnthropicProvider(TEST_API_KEY);

    try {
      await provider.processContent(sampleContent, sampleVaultContext);
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(LLMProcessingError);
      const llmErr = err as LLMProcessingError;
      expect(llmErr.stage).toBe("summarization");
    }
  });

  it("throws LLMProcessingError on malformed tool_use input", async () => {
    const badResponse = {
      ...mockSummarizationResponse(),
      content: [
        {
          type: "tool_use",
          id: "toolu_bad",
          name: "summarize_content",
          input: { title: 123, summary: null },
        },
      ],
    };

    mockCreate.mockResolvedValueOnce(badResponse);

    const provider = new AnthropicProvider(TEST_API_KEY);

    try {
      await provider.processContent(sampleContent, sampleVaultContext);
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(LLMProcessingError);
      const llmErr = err as LLMProcessingError;
      expect(llmErr.stage).toBe("summarization");
      expect(llmErr.message).toContain("invalid");
    }
  });
});

// -- Social media content -----------------------------------------------------

describe("social media content", () => {
  it("preserves type and platform for social media", async () => {
    mockCreate
      .mockResolvedValueOnce(
        mockSummarizationResponse({
          title: "AI Safety Thread",
          summary: "A thread discussing AI safety concerns.",
          keyTakeaways: ["Safety is critical"],
        })
      )
      .mockResolvedValueOnce(
        mockCategorizationResponse({
          suggestedFolder: "Resources/AI",
          suggestedTags: ["ai", "safety"],
        })
      );

    const provider = new AnthropicProvider(TEST_API_KEY);
    const result = await provider.processContent(
      socialMediaContent,
      sampleVaultContext
    );

    expect(result.type).toBe("social-media");
    expect(result.platform).toBe("x");
    expect(result.source).toBe(socialMediaContent);
  });

  it("includes platform info in summarization prompt", async () => {
    mockCreate
      .mockResolvedValueOnce(mockSummarizationResponse())
      .mockResolvedValueOnce(mockCategorizationResponse());

    const provider = new AnthropicProvider(TEST_API_KEY);
    await provider.processContent(
      socialMediaContent,
      sampleVaultContext
    );

    const firstCallArgs = mockCreate.mock.calls[0]![0] as Record<string, unknown>;
    const messages = firstCallArgs.messages as Array<{
      role: string;
      content: string;
    }>;
    const prompt = messages[0]!.content;

    expect(prompt).toContain("social-media");
    expect(prompt).toContain("x");
  });
});
