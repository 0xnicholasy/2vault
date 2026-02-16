import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  Config,
  ExtractedContent,
  LLMProvider,
  ProcessedNote,
  VaultContext,
} from "@/core/types";

// vi.hoisted ensures these are available when vi.mock factories run (hoisted above imports)
const {
  mockFetchAndExtract,
  mockBuildVaultContext,
  mockCreateNote,
  mockFormatNote,
  mockGenerateFilename,
} = vi.hoisted(() => ({
  mockFetchAndExtract: vi.fn(),
  mockBuildVaultContext: vi.fn(),
  mockCreateNote: vi.fn(),
  mockFormatNote: vi.fn(),
  mockGenerateFilename: vi.fn(),
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
  },
}));

vi.mock("@/core/note-formatter", () => ({
  formatNote: mockFormatNote,
  generateFilename: mockGenerateFilename,
}));

import { processUrls, type ProgressCallback, type ExtractFn } from "@/core/orchestrator";

const TEST_CONFIG: Config = {
  apiKey: "test-api-key",
  llmProvider: "openrouter",
  vaultUrl: "https://localhost:27124",
  vaultApiKey: "test-vault-key",
  defaultFolder: "Inbox",
};

const MOCK_VAULT_CONTEXT: VaultContext = {
  folders: ["Inbox", "Reading/Articles"],
  tags: ["ai", "programming"],
  recentNotes: [],
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
      return createProcessed();
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

    expect(statuses).toEqual(["extracting", "processing", "creating", "done"]);
  });

  it("reports correct index and total", async () => {
    const urls = ["https://example.com/a", "https://example.com/b"];
    const calls: Array<{ index: number; total: number }> = [];

    mockFetchAndExtract
      .mockResolvedValueOnce(createExtracted({ url: urls[0] }))
      .mockResolvedValueOnce(createExtracted({ url: urls[1] }));

    const onProgress: ProgressCallback = (_url, _status, index, total) => {
      calls.push({ index, total });
    };

    await processUrls(urls, TEST_CONFIG, createMockProvider(), onProgress);

    // First URL: index 0, total 2 (4 callbacks)
    expect(calls[0]).toEqual({ index: 0, total: 2 });
    expect(calls[1]).toEqual({ index: 0, total: 2 });
    expect(calls[2]).toEqual({ index: 0, total: 2 });
    expect(calls[3]).toEqual({ index: 0, total: 2 });

    // Second URL: index 1, total 2 (4 callbacks)
    expect(calls[4]).toEqual({ index: 1, total: 2 });
    expect(calls[5]).toEqual({ index: 1, total: 2 });
    expect(calls[6]).toEqual({ index: 1, total: 2 });
    expect(calls[7]).toEqual({ index: 1, total: 2 });
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
