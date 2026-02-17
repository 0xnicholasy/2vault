import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  Config,
  ExtractedContent,
  LLMProvider,
  ProcessedNote,
  VaultContext,
} from "@/core/types";
import { VaultClientError, LLMProcessingError } from "@/core/types";

// vi.hoisted ensures these are available when vi.mock factories run (hoisted above imports)
const {
  mockFetchAndExtract,
  mockBuildVaultContext,
  mockCreateNote,
  mockSearchNotes,
  mockReadNote,
  mockNoteExists,
  mockAppendToNote,
  mockFormatNote,
  mockGenerateFilename,
  mockFormatTagHubNote,
} = vi.hoisted(() => ({
  mockFetchAndExtract: vi.fn(),
  mockBuildVaultContext: vi.fn(),
  mockCreateNote: vi.fn(),
  mockSearchNotes: vi.fn(),
  mockReadNote: vi.fn(),
  mockNoteExists: vi.fn(),
  mockAppendToNote: vi.fn(),
  mockFormatNote: vi.fn(),
  mockGenerateFilename: vi.fn(),
  mockFormatTagHubNote: vi.fn(),
}));

vi.mock("@/core/extractor", () => ({
  fetchAndExtract: mockFetchAndExtract,
}));

vi.mock("@/core/vault-analyzer", () => ({
  buildVaultContext: mockBuildVaultContext,
}));

vi.mock("@/core/vault-client", () => ({
  VaultClient: class {
    createNote = mockCreateNote;
    searchNotes = mockSearchNotes;
    readNote = mockReadNote;
    noteExists = mockNoteExists;
    appendToNote = mockAppendToNote;
  },
}));

vi.mock("@/core/note-formatter", () => ({
  formatNote: mockFormatNote,
  generateFilename: mockGenerateFilename,
  formatTagHubNote: mockFormatTagHubNote,
}));

import { processUrls, normalizeUrl, type ProgressCallback, type ExtractFn } from "@/core/orchestrator";

const TEST_CONFIG: Config = {
  apiKey: "test-api-key",
  llmProvider: "openrouter",
  vaultUrl: "https://localhost:27124",
  vaultApiKey: "test-vault-key",
  defaultFolder: "Inbox",
  vaultName: "TestVault",
  vaultOrganization: "custom",
  tagGroups: [],
};

const MOCK_VAULT_CONTEXT: VaultContext = {
  folders: ["Inbox", "Reading/Articles"],
  tags: ["ai", "programming"],
  recentNotes: [],
  tagGroups: [],
  organization: "custom",
};

function createExtracted(
  overrides?: Partial<ExtractedContent>
): ExtractedContent {
  return {
    url: "https://example.com/article",
    title: "Test Article",
    content: "Article content here.",
    author: "Jane Doe",
    datePublished: "2026-01-15",
    wordCount: 500,
    type: "article",
    platform: "web",
    status: "success",
    ...overrides,
  };
}

function createProcessed(overrides?: Partial<ProcessedNote>): ProcessedNote {
  return {
    title: "Test Article Summary",
    summary: "Summary text.",
    keyTakeaways: ["Takeaway 1"],
    suggestedFolder: "Reading/Articles",
    suggestedTags: ["ai"],
    type: "article",
    platform: "web",
    source: createExtracted(),
    ...overrides,
  };
}

const mockProcessContent = vi.fn<LLMProvider["processContent"]>();

function createMockProvider(): LLMProvider {
  return { processContent: mockProcessContent };
}

beforeEach(() => {
  vi.clearAllMocks();

  mockBuildVaultContext.mockResolvedValue(MOCK_VAULT_CONTEXT);
  mockFetchAndExtract.mockResolvedValue(createExtracted());
  mockProcessContent.mockResolvedValue(createProcessed());
  mockFormatNote.mockReturnValue("# Formatted Note");
  mockGenerateFilename.mockReturnValue("test-article-summary.md");
  mockCreateNote.mockResolvedValue(undefined);
  mockSearchNotes.mockResolvedValue([]);
  mockReadNote.mockResolvedValue("");
  mockNoteExists.mockResolvedValue(false);
  mockAppendToNote.mockResolvedValue(undefined);
  mockFormatTagHubNote.mockReturnValue("# Hub Note");
});

// -- Happy path ---------------------------------------------------------------

describe("processUrls - happy path", () => {
  it("processes multiple URLs successfully", async () => {
    const urls = ["https://example.com/a", "https://example.com/b"];

    mockFetchAndExtract
      .mockResolvedValueOnce(createExtracted({ url: urls[0] }))
      .mockResolvedValueOnce(createExtracted({ url: urls[1] }));

    const processed1 = createProcessed({ title: "Article A" });
    const processed2 = createProcessed({ title: "Article B" });
    mockProcessContent
      .mockResolvedValueOnce(processed1)
      .mockResolvedValueOnce(processed2);

    const results = await processUrls(urls, TEST_CONFIG, createMockProvider());

    expect(results).toHaveLength(2);
    expect(results[0]!.status).toBe("success");
    expect(results[0]!.note).toEqual(processed1);
    expect(results[1]!.status).toBe("success");
    expect(results[1]!.note).toEqual(processed2);
  });

  it("returns folder in success result", async () => {
    const results = await processUrls(["https://example.com/a"], TEST_CONFIG, createMockProvider());

    expect(results[0]!.folder).toBe("Reading/Articles");
  });
});

// -- Pipeline order -----------------------------------------------------------

describe("processUrls - pipeline order", () => {
  it("calls extract -> process -> format -> create in sequence", async () => {
    const callOrder: string[] = [];

    mockFetchAndExtract.mockImplementation(async () => {
      callOrder.push("extract");
      return createExtracted();
    });

    mockProcessContent.mockImplementation(async () => {
      callOrder.push("process");
      return createProcessed({ suggestedTags: [] });
    });

    mockFormatNote.mockImplementation(() => {
      callOrder.push("format");
      return "# Note";
    });

    mockCreateNote.mockImplementation(async () => {
      callOrder.push("create");
    });

    await processUrls(["https://example.com/a"], TEST_CONFIG, createMockProvider());

    expect(callOrder).toEqual(["extract", "process", "format", "create"]);
  });
});

// -- Progress callbacks -------------------------------------------------------

describe("processUrls - progress callbacks", () => {
  it("reports correct status strings", async () => {
    const statuses: string[] = [];
    const onProgress: ProgressCallback = (_url, status) => {
      statuses.push(status);
    };

    await processUrls(["https://example.com/a"], TEST_CONFIG, createMockProvider(), onProgress);

    expect(statuses).toEqual(["checking", "extracting", "processing", "creating", "done"]);
  });

  it("reports url with each status callback", async () => {
    const urls = ["https://example.com/a", "https://example.com/b"];
    const calls: Array<{ url: string; status: string }> = [];

    mockFetchAndExtract
      .mockResolvedValueOnce(createExtracted({ url: urls[0] }))
      .mockResolvedValueOnce(createExtracted({ url: urls[1] }));

    const onProgress: ProgressCallback = (url, status) => {
      calls.push({ url, status });
    };

    await processUrls(urls, TEST_CONFIG, createMockProvider(), onProgress);

    // Each URL should get its own set of status callbacks
    const url1Calls = calls.filter((c) => c.url === urls[0]);
    const url2Calls = calls.filter((c) => c.url === urls[1]);

    expect(url1Calls.map((c) => c.status)).toEqual(["checking", "extracting", "processing", "creating", "done"]);
    expect(url2Calls.map((c) => c.status)).toEqual(["checking", "extracting", "processing", "creating", "done"]);
  });
});

// -- Partial failure: extraction ----------------------------------------------

describe("processUrls - extraction failure", () => {
  it("continues processing after extraction failure", async () => {
    const urls = ["https://example.com/fail", "https://example.com/ok"];

    mockFetchAndExtract
      .mockResolvedValueOnce(
        createExtracted({
          url: urls[0],
          status: "failed",
          error: "HTTP 404",
        })
      )
      .mockResolvedValueOnce(createExtracted({ url: urls[1] }));

    const results = await processUrls(urls, TEST_CONFIG, createMockProvider());

    expect(results).toHaveLength(2);
    expect(results[0]!.status).toBe("failed");
    expect(results[0]!.error).toBe("HTTP 404");
    expect(results[1]!.status).toBe("success");
  });
});

// -- Partial failure: LLM processing -----------------------------------------

describe("processUrls - LLM failure", () => {
  it("continues processing after LLM failure", async () => {
    const urls = ["https://example.com/fail", "https://example.com/ok"];

    mockFetchAndExtract
      .mockResolvedValueOnce(createExtracted({ url: urls[0] }))
      .mockResolvedValueOnce(createExtracted({ url: urls[1] }));

    mockProcessContent
      .mockRejectedValueOnce(new Error("Summarization API call failed"))
      .mockResolvedValueOnce(createProcessed());

    const results = await processUrls(urls, TEST_CONFIG, createMockProvider());

    expect(results).toHaveLength(2);
    expect(results[0]!.status).toBe("failed");
    expect(results[0]!.error).toContain("Summarization API call failed");
    expect(results[1]!.status).toBe("success");
  });
});

// -- Partial failure: vault creation ------------------------------------------

describe("processUrls - vault creation failure", () => {
  it("continues processing after vault creation failure", async () => {
    const urls = ["https://example.com/fail", "https://example.com/ok"];

    mockFetchAndExtract
      .mockResolvedValueOnce(createExtracted({ url: urls[0] }))
      .mockResolvedValueOnce(createExtracted({ url: urls[1] }));

    mockCreateNote
      .mockRejectedValueOnce(new Error("HTTP 500: PUT /vault/note.md"))
      .mockResolvedValueOnce(undefined);

    const results = await processUrls(urls, TEST_CONFIG, createMockProvider());

    expect(results).toHaveLength(2);
    expect(results[0]!.status).toBe("failed");
    expect(results[0]!.error).toContain("HTTP 500");
    expect(results[1]!.status).toBe("success");
  });
});

// -- Vault context failure ----------------------------------------------------

describe("processUrls - vault context failure", () => {
  it("throws when buildVaultContext fails", async () => {
    mockBuildVaultContext.mockRejectedValue(new Error("Connection refused"));

    await expect(
      processUrls(["https://example.com/a"], TEST_CONFIG, createMockProvider())
    ).rejects.toThrow("Connection refused");
  });
});

// -- Empty URL list -----------------------------------------------------------

describe("processUrls - empty URL list", () => {
  it("returns empty results for empty URL list", async () => {
    const results = await processUrls([], TEST_CONFIG, createMockProvider());

    expect(results).toEqual([]);
  });
});

// -- No progress callback -----------------------------------------------------

describe("processUrls - no progress callback", () => {
  it("works without onProgress callback", async () => {
    const results = await processUrls(
      ["https://example.com/a"],
      TEST_CONFIG,
      createMockProvider()
    );

    expect(results).toHaveLength(1);
    expect(results[0]!.status).toBe("success");
  });
});

// -- Correct note path --------------------------------------------------------

describe("processUrls - note path", () => {
  it("creates note at suggestedFolder/filename", async () => {
    mockGenerateFilename.mockReturnValue("my-article.md");

    await processUrls(["https://example.com/a"], TEST_CONFIG, createMockProvider());

    expect(mockCreateNote).toHaveBeenCalledWith(
      "Reading/Articles/my-article.md",
      "# Formatted Note"
    );
  });
});

// -- Custom extractFn ---------------------------------------------------------

describe("processUrls - custom extractFn", () => {
  it("uses custom extractFn instead of fetchAndExtract", async () => {
    const customExtract: ExtractFn = vi.fn().mockResolvedValue(
      createExtracted({
        url: "https://x.com/user/status/123",
        type: "social-media",
        platform: "x",
        content: "Tweet content from DOM",
      })
    );

    const results = await processUrls(
      ["https://x.com/user/status/123"],
      TEST_CONFIG,
      createMockProvider(),
      undefined,
      customExtract
    );

    expect(customExtract).toHaveBeenCalledWith("https://x.com/user/status/123");
    expect(mockFetchAndExtract).not.toHaveBeenCalled();
    expect(results).toHaveLength(1);
    expect(results[0]!.status).toBe("success");
  });

  it("falls back to fetchAndExtract when extractFn is not provided", async () => {
    await processUrls(
      ["https://example.com/article"],
      TEST_CONFIG,
      createMockProvider()
    );

    expect(mockFetchAndExtract).toHaveBeenCalledWith("https://example.com/article");
  });

  it("handles extractFn failure gracefully", async () => {
    const failingExtract: ExtractFn = vi.fn().mockResolvedValue(
      createExtracted({
        url: "https://x.com/user/status/456",
        status: "failed",
        error: "DOM extraction timed out",
      })
    );

    const results = await processUrls(
      ["https://x.com/user/status/456"],
      TEST_CONFIG,
      createMockProvider(),
      undefined,
      failingExtract
    );

    expect(results[0]!.status).toBe("failed");
    expect(results[0]!.error).toBe("DOM extraction timed out");
  });

  it("processes mixed URLs with custom extractFn", async () => {
    const urls = ["https://x.com/user/status/1", "https://example.com/article"];
    const customExtract: ExtractFn = vi.fn()
      .mockResolvedValueOnce(
        createExtracted({ url: urls[0], type: "social-media", platform: "x" })
      )
      .mockResolvedValueOnce(
        createExtracted({ url: urls[1] })
      );

    const results = await processUrls(
      urls,
      TEST_CONFIG,
      createMockProvider(),
      undefined,
      customExtract
    );

    expect(results).toHaveLength(2);
    expect(results[0]!.status).toBe("success");
    expect(results[1]!.status).toBe("success");
    expect(customExtract).toHaveBeenCalledTimes(2);
  });
});

// -- Duplicate detection ------------------------------------------------------

describe("processUrls - duplicate detection", () => {
  it("skips duplicate URLs found in vault", async () => {
    const url = "https://example.com/existing";
    mockSearchNotes.mockResolvedValue([{ filename: "Inbox/existing.md", score: 1.0 }]);
    mockReadNote.mockResolvedValue(
      `---\nsource: ${url}\ndate_saved: 2026-01-01\n---\n# Existing Note`
    );

    const results = await processUrls([url], TEST_CONFIG, createMockProvider());

    expect(results).toHaveLength(1);
    expect(results[0]!.status).toBe("skipped");
    expect(results[0]!.skipReason).toContain("Duplicate");
    expect(mockFetchAndExtract).not.toHaveBeenCalled();
  });

  it("continues processing when URL is not a duplicate", async () => {
    mockSearchNotes.mockResolvedValue([]);

    const results = await processUrls(
      ["https://example.com/new"],
      TEST_CONFIG,
      createMockProvider()
    );

    expect(results[0]!.status).toBe("success");
    expect(mockFetchAndExtract).toHaveBeenCalled();
  });

  it("continues processing when duplicate check fails", async () => {
    mockSearchNotes.mockRejectedValue(new Error("Search failed"));

    const results = await processUrls(
      ["https://example.com/a"],
      TEST_CONFIG,
      createMockProvider()
    );

    expect(results[0]!.status).toBe("success");
  });

  it("detects duplicates with normalized URL comparison", async () => {
    const storedUrl = "https://www.example.com/article?utm_source=twitter";
    const incomingUrl = "https://example.com/article";

    mockSearchNotes.mockResolvedValue([{ filename: "Inbox/article.md", score: 1.0 }]);
    mockReadNote.mockResolvedValue(
      `---\nsource: "${storedUrl}"\ndate_saved: 2026-01-01\n---\n# Article`
    );

    const results = await processUrls([incomingUrl], TEST_CONFIG, createMockProvider());

    expect(results[0]!.status).toBe("skipped");
    expect(mockFetchAndExtract).not.toHaveBeenCalled();
  });
});

// -- Tag groups flow ----------------------------------------------------------

describe("processUrls - tag groups in vault context", () => {
  it("merges config tagGroups into vault context", async () => {
    const configWithTags: Config = {
      ...TEST_CONFIG,
      tagGroups: [{ name: "Tech", tags: ["ai", "ml"] }],
    };

    await processUrls(
      ["https://example.com/a"],
      configWithTags,
      createMockProvider()
    );

    // The provider should receive vaultContext with tag groups merged
    const passedContext = mockProcessContent.mock.calls[0]![1] as VaultContext;
    expect(passedContext.tagGroups).toEqual([{ name: "Tech", tags: ["ai", "ml"] }]);
  });

  it("merges config vaultOrganization into vault context", async () => {
    const configWithPara: Config = {
      ...TEST_CONFIG,
      vaultOrganization: "para",
    };

    await processUrls(
      ["https://example.com/a"],
      configWithPara,
      createMockProvider()
    );

    const passedContext = mockProcessContent.mock.calls[0]![1] as VaultContext;
    expect(passedContext.organization).toBe("para");
  });
});

// -- Hub note post-processing -------------------------------------------------

describe("processUrls - hub notes", () => {
  it("creates new hub notes for tags when they do not exist", async () => {
    mockNoteExists.mockResolvedValue(false);

    await processUrls(
      ["https://example.com/a"],
      TEST_CONFIG,
      createMockProvider()
    );

    // Default processed note has suggestedTags: ["ai"]
    expect(mockNoteExists).toHaveBeenCalledWith("Tags/ai.md");
    expect(mockCreateNote).toHaveBeenCalledWith("Tags/ai.md", "# Hub Note");
  });

  it("appends to existing hub notes", async () => {
    mockNoteExists.mockResolvedValue(true);

    await processUrls(
      ["https://example.com/a"],
      TEST_CONFIG,
      createMockProvider()
    );

    expect(mockAppendToNote).toHaveBeenCalledWith(
      "Tags/ai.md",
      expect.stringContaining("[[test-article-summary]]")
    );
  });

  it("continues on hub note failure", async () => {
    mockNoteExists.mockRejectedValue(new Error("Hub check failed"));

    const results = await processUrls(
      ["https://example.com/a"],
      TEST_CONFIG,
      createMockProvider()
    );

    expect(results[0]!.status).toBe("success");
  });
});

// -- Error categorization ------------------------------------------------------

describe("processUrls - error categorization", () => {
  it("sets errorCategory to 'extraction' when extraction fails", async () => {
    mockFetchAndExtract.mockResolvedValue(
      createExtracted({ status: "failed", error: "Page not found" })
    );

    const results = await processUrls(
      ["https://example.com/a"],
      TEST_CONFIG,
      createMockProvider()
    );

    expect(results[0]!.status).toBe("failed");
    expect(results[0]!.errorCategory).toBe("extraction");
  });

  it("sets errorCategory to 'llm' for LLMProcessingError", async () => {
    mockProcessContent.mockRejectedValue(
      new LLMProcessingError("Model unavailable", "summarization")
    );

    const results = await processUrls(
      ["https://example.com/a"],
      TEST_CONFIG,
      createMockProvider()
    );

    expect(results[0]!.status).toBe("failed");
    expect(results[0]!.errorCategory).toBe("llm");
  });

  it("sets errorCategory to 'vault' for VaultClientError", async () => {
    mockCreateNote.mockRejectedValue(
      new VaultClientError("Forbidden", 403, "/vault/Reading/Articles/test.md")
    );

    const results = await processUrls(
      ["https://example.com/a"],
      TEST_CONFIG,
      createMockProvider()
    );

    expect(results[0]!.status).toBe("failed");
    expect(results[0]!.errorCategory).toBe("vault");
  });

  it("sets errorCategory to 'network' for fetch TypeError", async () => {
    mockProcessContent.mockRejectedValue(
      new TypeError("fetch failed")
    );

    const results = await processUrls(
      ["https://example.com/a"],
      TEST_CONFIG,
      createMockProvider()
    );

    expect(results[0]!.status).toBe("failed");
    expect(results[0]!.errorCategory).toBe("network");
  });

  it("sets errorCategory to 'unknown' for generic errors", async () => {
    mockProcessContent.mockRejectedValue(new Error("Something unexpected"));

    const results = await processUrls(
      ["https://example.com/a"],
      TEST_CONFIG,
      createMockProvider()
    );

    expect(results[0]!.status).toBe("failed");
    expect(results[0]!.errorCategory).toBe("unknown");
  });
});

// -- URL normalization --------------------------------------------------------

describe("normalizeUrl", () => {
  it("strips utm tracking params", () => {
    expect(normalizeUrl("https://example.com/page?utm_source=twitter&utm_medium=social"))
      .toBe("https://example.com/page");
  });

  it("strips fbclid and gclid", () => {
    expect(normalizeUrl("https://example.com/page?fbclid=abc123"))
      .toBe("https://example.com/page");
    expect(normalizeUrl("https://example.com/page?gclid=xyz456"))
      .toBe("https://example.com/page");
  });

  it("strips s param (Twitter share)", () => {
    expect(normalizeUrl("https://x.com/user/status/123?s=20"))
      .toBe("https://x.com/user/status/123");
  });

  it("normalizes http to https", () => {
    expect(normalizeUrl("http://example.com/page"))
      .toBe("https://example.com/page");
  });

  it("strips www prefix", () => {
    expect(normalizeUrl("https://www.example.com/page"))
      .toBe("https://example.com/page");
  });

  it("strips trailing slash", () => {
    expect(normalizeUrl("https://example.com/page/"))
      .toBe("https://example.com/page");
  });

  it("strips fragment", () => {
    expect(normalizeUrl("https://example.com/page#section"))
      .toBe("https://example.com/page");
  });

  it("preserves non-tracking query params", () => {
    expect(normalizeUrl("https://example.com/search?q=hello&page=2"))
      .toBe("https://example.com/search?q=hello&page=2");
  });

  it("handles combined normalizations", () => {
    expect(normalizeUrl("http://www.example.com/page/?utm_source=twitter&q=test#heading"))
      .toBe("https://example.com/page?q=test");
  });

  it("returns raw string for invalid URLs", () => {
    expect(normalizeUrl("not-a-url")).toBe("not-a-url");
  });
});

// -- Cancellation -------------------------------------------------------------

describe("processUrls - cancellation", () => {
  it("stops processing when isCancelled returns true", async () => {
    let callCount = 0;
    const isCancelled = () => {
      callCount++;
      // Cancel after first URL starts
      return callCount > 2;
    };

    const urls = ["https://example.com/a", "https://example.com/b"];

    mockFetchAndExtract
      .mockResolvedValueOnce(createExtracted({ url: urls[0] }))
      .mockResolvedValueOnce(createExtracted({ url: urls[1] }));

    const results = await processUrls(
      urls,
      TEST_CONFIG,
      createMockProvider(),
      undefined,
      undefined,
      isCancelled
    );

    expect(results).toHaveLength(2);
    // At least one should be cancelled
    const cancelledResults = results.filter((r) => r.error === "Cancelled");
    expect(cancelledResults.length).toBeGreaterThanOrEqual(1);
  });
});

// -- Parallel processing ------------------------------------------------------

describe("processUrls - parallel processing", () => {
  it("processes all URLs and returns correct results regardless of order", async () => {
    const urls = [
      "https://example.com/a",
      "https://example.com/b",
      "https://example.com/c",
    ];

    mockFetchAndExtract
      .mockResolvedValueOnce(createExtracted({ url: urls[0] }))
      .mockResolvedValueOnce(createExtracted({ url: urls[1] }))
      .mockResolvedValueOnce(createExtracted({ url: urls[2] }));

    const p1 = createProcessed({ title: "A" });
    const p2 = createProcessed({ title: "B" });
    const p3 = createProcessed({ title: "C" });
    mockProcessContent
      .mockResolvedValueOnce(p1)
      .mockResolvedValueOnce(p2)
      .mockResolvedValueOnce(p3);

    const results = await processUrls(urls, TEST_CONFIG, createMockProvider());

    expect(results).toHaveLength(3);
    expect(results.every((r) => r.status === "success")).toBe(true);
    // Results should be in URL order (maintained by processWithConcurrency)
    expect(results[0]!.note?.title).toBe("A");
    expect(results[1]!.note?.title).toBe("B");
    expect(results[2]!.note?.title).toBe("C");
  });
});
