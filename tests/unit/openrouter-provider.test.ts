import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ExtractedContent, VaultContext } from "@/core/types";
import { LLMProcessingError } from "@/core/types";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { OpenRouterProvider } from "@/core/openrouter-provider";

const TEST_API_KEY = "sk-or-test-key-123";

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
    id: "gen-summarize-123",
    choices: [
      {
        message: {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call_sum_123",
              type: "function",
              function: {
                name: "summarize_content",
                arguments: JSON.stringify({
                  title: "TypeScript Generics Explained",
                  summary:
                    "A comprehensive guide to TypeScript generics for writing reusable, type-safe code.",
                  keyTakeaways: [
                    "Generics enable type-safe reusable code",
                    "Constraints limit generic types",
                    "Utility types leverage generics extensively",
                  ],
                  ...overrides,
                }),
              },
            },
          ],
        },
        finish_reason: "tool_calls",
      },
    ],
    model: "google/gemini-2.0-flash-001",
    usage: { prompt_tokens: 500, completion_tokens: 200, total_tokens: 700 },
  };
}

function mockCategorizationResponse(overrides?: Record<string, unknown>) {
  return {
    id: "gen-categorize-123",
    choices: [
      {
        message: {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call_cat_123",
              type: "function",
              function: {
                name: "categorize_content",
                arguments: JSON.stringify({
                  suggestedFolder: "Resources/Programming",
                  suggestedTags: ["typescript", "programming", "generics"],
                  ...overrides,
                }),
              },
            },
          ],
        },
        finish_reason: "tool_calls",
      },
    ],
    model: "google/gemini-2.0-flash-001",
    usage: { prompt_tokens: 800, completion_tokens: 150, total_tokens: 950 },
  };
}

function mockFetchResponse(body: Record<string, unknown>, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

beforeEach(() => {
  mockFetch.mockReset();
});

// -- Two-call architecture ----------------------------------------------------

describe("OpenRouterProvider.processContent", () => {
  it("makes two fetch calls (summarization then categorization)", async () => {
    mockFetch
      .mockResolvedValueOnce(mockFetchResponse(mockSummarizationResponse()))
      .mockResolvedValueOnce(mockFetchResponse(mockCategorizationResponse()));

    const provider = new OpenRouterProvider(TEST_API_KEY);
    await provider.processContent(sampleContent, sampleVaultContext);

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("sends correct Authorization header", async () => {
    mockFetch
      .mockResolvedValueOnce(mockFetchResponse(mockSummarizationResponse()))
      .mockResolvedValueOnce(mockFetchResponse(mockCategorizationResponse()));

    const provider = new OpenRouterProvider(TEST_API_KEY);
    await provider.processContent(sampleContent, sampleVaultContext);

    const firstCall = mockFetch.mock.calls[0]!;
    const requestInit = firstCall[1] as RequestInit;
    const headers = requestInit.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${TEST_API_KEY}`);
  });

  it("sends requests to OpenRouter API URL", async () => {
    mockFetch
      .mockResolvedValueOnce(mockFetchResponse(mockSummarizationResponse()))
      .mockResolvedValueOnce(mockFetchResponse(mockCategorizationResponse()));

    const provider = new OpenRouterProvider(TEST_API_KEY);
    await provider.processContent(sampleContent, sampleVaultContext);

    const firstCall = mockFetch.mock.calls[0]!;
    expect(firstCall[0]).toBe("https://openrouter.ai/api/v1/chat/completions");
  });

  it("uses correct model for both calls", async () => {
    mockFetch
      .mockResolvedValueOnce(mockFetchResponse(mockSummarizationResponse()))
      .mockResolvedValueOnce(mockFetchResponse(mockCategorizationResponse()));

    const provider = new OpenRouterProvider(TEST_API_KEY);
    await provider.processContent(sampleContent, sampleVaultContext);

    const firstBody = JSON.parse((mockFetch.mock.calls[0]![1] as RequestInit).body as string);
    const secondBody = JSON.parse((mockFetch.mock.calls[1]![1] as RequestInit).body as string);

    expect(firstBody.model).toBe("google/gemini-2.0-flash-001");
    expect(secondBody.model).toBe("google/gemini-2.0-flash-001");
  });

  it("uses OpenAI-compatible function tool format", async () => {
    mockFetch
      .mockResolvedValueOnce(mockFetchResponse(mockSummarizationResponse()))
      .mockResolvedValueOnce(mockFetchResponse(mockCategorizationResponse()));

    const provider = new OpenRouterProvider(TEST_API_KEY);
    await provider.processContent(sampleContent, sampleVaultContext);

    const firstBody = JSON.parse((mockFetch.mock.calls[0]![1] as RequestInit).body as string);
    expect(firstBody.tools[0].type).toBe("function");
    expect(firstBody.tools[0].function.name).toBe("summarize_content");
    expect(firstBody.tool_choice).toEqual({
      type: "function",
      function: { name: "summarize_content" },
    });

    const secondBody = JSON.parse((mockFetch.mock.calls[1]![1] as RequestInit).body as string);
    expect(secondBody.tools[0].type).toBe("function");
    expect(secondBody.tools[0].function.name).toBe("categorize_content");
    expect(secondBody.tool_choice).toEqual({
      type: "function",
      function: { name: "categorize_content" },
    });
  });

  it("returns correct ProcessedNote structure", async () => {
    mockFetch
      .mockResolvedValueOnce(mockFetchResponse(mockSummarizationResponse()))
      .mockResolvedValueOnce(mockFetchResponse(mockCategorizationResponse()));

    const provider = new OpenRouterProvider(TEST_API_KEY);
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
    mockFetch
      .mockResolvedValueOnce(mockFetchResponse(mockSummarizationResponse()))
      .mockResolvedValueOnce(mockFetchResponse(mockCategorizationResponse()));

    const provider = new OpenRouterProvider(TEST_API_KEY);
    await provider.processContent(sampleContent, sampleVaultContext);

    const secondBody = JSON.parse((mockFetch.mock.calls[1]![1] as RequestInit).body as string);
    const prompt = secondBody.messages[0].content;

    expect(prompt).toContain("Resources/Programming");
    expect(prompt).toContain("Resources/AI");
    expect(prompt).toContain("typescript");
    expect(prompt).toContain("programming");
  });
});

// -- Folder fallback ----------------------------------------------------------

describe("folder validation", () => {
  it("falls back to first folder if LLM suggests non-existent one", async () => {
    mockFetch
      .mockResolvedValueOnce(mockFetchResponse(mockSummarizationResponse()))
      .mockResolvedValueOnce(
        mockFetchResponse(
          mockCategorizationResponse({ suggestedFolder: "NonExistent/Folder" })
        )
      );

    const provider = new OpenRouterProvider(TEST_API_KEY);
    const result = await provider.processContent(
      sampleContent,
      sampleVaultContext
    );

    expect(result.suggestedFolder).toBe("Daily");
  });

  it("keeps valid folder suggestion", async () => {
    mockFetch
      .mockResolvedValueOnce(mockFetchResponse(mockSummarizationResponse()))
      .mockResolvedValueOnce(
        mockFetchResponse(
          mockCategorizationResponse({ suggestedFolder: "Resources/AI" })
        )
      );

    const provider = new OpenRouterProvider(TEST_API_KEY);
    const result = await provider.processContent(
      sampleContent,
      sampleVaultContext
    );

    expect(result.suggestedFolder).toBe("Resources/AI");
  });
});

// -- Error handling -----------------------------------------------------------

describe("error handling", () => {
  it("throws LLMProcessingError with stage 'summarization' on fetch failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const provider = new OpenRouterProvider(TEST_API_KEY);

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

  it("throws LLMProcessingError with stage 'summarization' on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce(
      mockFetchResponse({ error: { message: "Invalid API key" } }, false, 401)
    );

    const provider = new OpenRouterProvider(TEST_API_KEY);

    try {
      await provider.processContent(sampleContent, sampleVaultContext);
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(LLMProcessingError);
      const llmErr = err as LLMProcessingError;
      expect(llmErr.stage).toBe("summarization");
      expect(llmErr.message).toContain("Summarization API call failed");
      expect(llmErr.message).toContain("401");
    }
  });

  it("throws LLMProcessingError with stage 'categorization' on second call failure", async () => {
    mockFetch
      .mockResolvedValueOnce(mockFetchResponse(mockSummarizationResponse()))
      .mockRejectedValueOnce(new Error("Network timeout"));

    const provider = new OpenRouterProvider(TEST_API_KEY);

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

  it("throws LLMProcessingError when response has no tool_calls", async () => {
    mockFetch.mockResolvedValueOnce(
      mockFetchResponse({
        id: "gen-no-tool",
        choices: [
          {
            message: {
              role: "assistant",
              content: "I cannot summarize this content.",
              tool_calls: undefined,
            },
            finish_reason: "stop",
          },
        ],
        model: "google/gemini-2.0-flash-001",
        usage: { prompt_tokens: 500, completion_tokens: 50, total_tokens: 550 },
      })
    );

    const provider = new OpenRouterProvider(TEST_API_KEY);

    try {
      await provider.processContent(sampleContent, sampleVaultContext);
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(LLMProcessingError);
      const llmErr = err as LLMProcessingError;
      expect(llmErr.stage).toBe("summarization");
    }
  });

  it("throws LLMProcessingError on malformed tool_calls arguments", async () => {
    mockFetch.mockResolvedValueOnce(
      mockFetchResponse({
        id: "gen-bad-args",
        choices: [
          {
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "call_bad",
                  type: "function",
                  function: {
                    name: "summarize_content",
                    arguments: JSON.stringify({ title: 123, summary: null }),
                  },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
        model: "google/gemini-2.0-flash-001",
        usage: { prompt_tokens: 500, completion_tokens: 50, total_tokens: 550 },
      })
    );

    const provider = new OpenRouterProvider(TEST_API_KEY);

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
    mockFetch
      .mockResolvedValueOnce(
        mockFetchResponse(
          mockSummarizationResponse({
            title: "AI Safety Thread",
            summary: "A thread discussing AI safety concerns.",
            keyTakeaways: ["Safety is critical"],
          })
        )
      )
      .mockResolvedValueOnce(
        mockFetchResponse(
          mockCategorizationResponse({
            suggestedFolder: "Resources/AI",
            suggestedTags: ["ai", "safety"],
          })
        )
      );

    const provider = new OpenRouterProvider(TEST_API_KEY);
    const result = await provider.processContent(
      socialMediaContent,
      sampleVaultContext
    );

    expect(result.type).toBe("social-media");
    expect(result.platform).toBe("x");
    expect(result.source).toBe(socialMediaContent);
  });

  it("includes platform info in summarization prompt", async () => {
    mockFetch
      .mockResolvedValueOnce(mockFetchResponse(mockSummarizationResponse()))
      .mockResolvedValueOnce(mockFetchResponse(mockCategorizationResponse()));

    const provider = new OpenRouterProvider(TEST_API_KEY);
    await provider.processContent(socialMediaContent, sampleVaultContext);

    const firstBody = JSON.parse((mockFetch.mock.calls[0]![1] as RequestInit).body as string);
    const prompt = firstBody.messages[0].content;

    expect(prompt).toContain("social-media");
    expect(prompt).toContain("x");
  });
});
