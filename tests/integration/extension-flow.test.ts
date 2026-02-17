import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ProcessingResult } from "@/core/types";
import type { ProcessingState } from "@/background/messages";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockProcessUrls,
  mockGetConfig,
  mockGetProcessingState,
  mockSetProcessingState,
  mockGetLocalStorage,
  mockSetLocalStorage,
} = vi.hoisted(() => ({
  mockProcessUrls: vi.fn(),
  mockGetConfig: vi.fn(),
  mockGetProcessingState: vi.fn(),
  mockSetProcessingState: vi.fn(),
  mockGetLocalStorage: vi.fn(),
  mockSetLocalStorage: vi.fn(),
}));

vi.mock("@/core/orchestrator", () => ({
  processUrls: mockProcessUrls,
  createDefaultProvider: vi.fn(() => ({ processContent: vi.fn() })),
}));

vi.mock("@/core/extractor", () => ({
  fetchAndExtract: vi.fn(),
  createFailedExtraction: vi.fn(),
}));

vi.mock("@/utils/storage", () => ({
  getConfig: mockGetConfig,
  getProcessingState: mockGetProcessingState,
  setProcessingState: mockSetProcessingState,
  getLocalStorage: mockGetLocalStorage,
  setLocalStorage: mockSetLocalStorage,
}));

vi.mock("@/utils/config", () => ({
  MAX_HISTORY: 100,
}));

// ---------------------------------------------------------------------------
// Chrome mock & listener capture
// ---------------------------------------------------------------------------

let commandListener: ((command: string) => void) | null = null;
let messageListener:
  | ((
      message: { type: string; [key: string]: unknown },
      sender: chrome.runtime.MessageSender,
      sendResponse: (response: unknown) => void
    ) => boolean | void)
  | null = null;

let tabUpdateListeners: Array<
  (tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo) => void
> = [];

function setupChromeMock() {
  tabUpdateListeners = [];

  vi.stubGlobal("chrome", {
    commands: {
      onCommand: {
        addListener: vi.fn((fn: (command: string) => void) => {
          commandListener = fn;
        }),
      },
    },
    runtime: {
      onInstalled: {
        addListener: vi.fn(),
      },
      onMessage: {
        addListener: vi.fn(
          (
            fn: (
              message: { type: string; [key: string]: unknown },
              sender: chrome.runtime.MessageSender,
              sendResponse: (response: unknown) => void
            ) => boolean | void
          ) => {
            messageListener = fn;
          }
        ),
      },
      getURL: vi.fn((path: string) => `chrome-extension://abc123/${path}`),
      getManifest: vi.fn(() => ({
        content_scripts: [
          { matches: ["https://x.com/*", "https://twitter.com/*"], js: ["src/content-scripts/twitter-extractor.js"] },
          { matches: ["https://www.linkedin.com/*"], js: ["src/content-scripts/linkedin-extractor.js"] },
          { matches: ["https://www.reddit.com/*", "https://old.reddit.com/*"], js: ["src/content-scripts/reddit-extractor.js"] },
        ],
      })),
    },
    contextMenus: {
      create: vi.fn(),
      onClicked: {
        addListener: vi.fn(),
      },
    },
    tabs: {
      query: vi.fn(
        (
          _query: chrome.tabs.QueryInfo,
          callback: (tabs: chrome.tabs.Tab[]) => void
        ) => {
          callback([
            {
              id: 1,
              url: "https://example.com/current-page",
            } as chrome.tabs.Tab,
          ]);
        }
      ),
      create: vi.fn().mockResolvedValue({ id: 99 }),
      remove: vi.fn().mockResolvedValue(undefined),
      sendMessage: vi.fn().mockResolvedValue({
        type: "EXTRACTION_RESULT",
        data: {
          url: "https://x.com/user/status/123",
          title: "Post by Test User",
          content: "Tweet content",
          author: "Test User (@testuser)",
          datePublished: "2026-02-15T10:00:00.000Z",
          wordCount: 2,
          type: "social-media",
          platform: "x",
          status: "success",
        },
      }),
      onUpdated: {
        addListener: vi.fn(
          (
            fn: (
              tabId: number,
              changeInfo: chrome.tabs.OnUpdatedInfo
            ) => void
          ) => {
            tabUpdateListeners.push(fn);
            setTimeout(
              () => fn(99, { status: "complete" } as chrome.tabs.OnUpdatedInfo),
              5
            );
          }
        ),
        removeListener: vi.fn(
          (
            fn: (
              tabId: number,
              changeInfo: chrome.tabs.OnUpdatedInfo
            ) => void
          ) => {
            tabUpdateListeners = tabUpdateListeners.filter((l) => l !== fn);
          }
        ),
      },
    },
    notifications: {
      create: vi.fn(),
      clear: vi.fn(),
      onClicked: {
        addListener: vi.fn(),
      },
    },
    action: {
      openPopup: vi.fn().mockResolvedValue(undefined),
    },
    scripting: {
      executeScript: vi.fn().mockResolvedValue([{ result: undefined }]),
    },
    windows: {
      create: vi.fn().mockResolvedValue({ id: 1 }),
    },
    storage: {
      sync: {
        get: vi.fn(() => Promise.resolve({})),
        set: vi.fn(() => Promise.resolve()),
      },
      local: {
        get: vi.fn(() => Promise.resolve({})),
        set: vi.fn(() => Promise.resolve()),
        remove: vi.fn(() => Promise.resolve()),
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Test config
// ---------------------------------------------------------------------------

const TEST_CONFIG = {
  apiKey: "sk-test",
  llmProvider: "openrouter" as const,
  vaultUrl: "https://localhost:27124",
  vaultApiKey: "vault-key",
  defaultFolder: "Inbox",
  vaultName: "TestVault",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Send a message to the service worker and return the async response. */
function sendMessage(
  message: { type: string; [key: string]: unknown }
): Promise<unknown> {
  return new Promise((resolve) => {
    messageListener!(message, {} as chrome.runtime.MessageSender, resolve);
  });
}

/** Build a simple success ProcessingResult for a given URL. */
function successResult(
  url: string,
  folder = "Inbox"
): ProcessingResult {
  return { url, status: "success", folder };
}

/** Build a simple failed ProcessingResult for a given URL. */
function failedResult(
  url: string,
  error = "Processing failed"
): ProcessingResult {
  return { url, status: "failed", error };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(async () => {
  vi.clearAllMocks();
  commandListener = null;
  messageListener = null;
  setupChromeMock();

  mockGetConfig.mockResolvedValue(TEST_CONFIG);
  mockGetProcessingState.mockResolvedValue(null);
  mockSetProcessingState.mockResolvedValue(undefined);
  mockGetLocalStorage.mockResolvedValue([]);
  mockSetLocalStorage.mockResolvedValue(undefined);

  vi.resetModules();
  await import("@/background/service-worker");
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Integration: popup -> service-worker round trips", () => {
  // -----------------------------------------------------------------------
  // 1. START_PROCESSING -> batch runs -> state updates -> history saved
  // -----------------------------------------------------------------------
  it("START_PROCESSING -> batch runs -> state updates -> history saved", async () => {
    const urls = ["https://example.com/a", "https://example.com/b"];
    const results: ProcessingResult[] = [
      successResult(urls[0]!, "Reading/Articles"),
      successResult(urls[1]!, "Resources"),
    ];

    mockProcessUrls.mockResolvedValue(results);

    const response = await sendMessage({
      type: "START_PROCESSING",
      urls,
    });

    expect(response).toEqual({ type: "PROCESSING_STARTED" });

    // Wait for the async runBatchProcessing to finish
    await vi.waitFor(() => {
      // Final setProcessingState must have been called with active:false
      const calls = mockSetProcessingState.mock.calls as ProcessingState[][];
      const finalCall = calls[calls.length - 1]?.[0];
      expect(finalCall?.active).toBe(false);
    });

    const allSetCalls = mockSetProcessingState.mock.calls as ProcessingState[][];

    // First call should set active:true (initial state)
    const initialCall = allSetCalls[0]?.[0];
    expect(initialCall?.active).toBe(true);
    expect(initialCall?.urls).toEqual(urls);

    // Final call should have active:false with both results
    const finalCall = allSetCalls[allSetCalls.length - 1]?.[0];
    expect(finalCall?.active).toBe(false);
    expect(finalCall?.results).toHaveLength(2);
    expect(finalCall?.results[0]?.status).toBe("success");
    expect(finalCall?.results[1]?.status).toBe("success");

    // History should be saved via setLocalStorage
    expect(mockSetLocalStorage).toHaveBeenCalledWith(
      "processingHistory",
      expect.arrayContaining([
        expect.objectContaining({ url: urls[0], status: "success" }),
        expect.objectContaining({ url: urls[1], status: "success" }),
      ])
    );
  });

  // -----------------------------------------------------------------------
  // 2. Batch error (vault unreachable) -> error state propagated
  // -----------------------------------------------------------------------
  it("batch error (vault unreachable) -> error state propagated", async () => {
    const urls = ["https://example.com/a", "https://example.com/b"];

    // Import VaultClientError to throw a realistic error
    const { VaultClientError } = await import("@/core/types");
    mockProcessUrls.mockRejectedValue(
      new VaultClientError("ECONNREFUSED", null, "GET /vault/")
    );

    const response = await sendMessage({
      type: "START_PROCESSING",
      urls,
    });

    expect(response).toEqual({ type: "PROCESSING_STARTED" });

    // Wait for the async batch processing to finish with error
    await vi.waitFor(() => {
      const calls = mockSetProcessingState.mock.calls as ProcessingState[][];
      const finalCall = calls[calls.length - 1]?.[0];
      expect(finalCall?.active).toBe(false);
    });

    const allSetCalls = mockSetProcessingState.mock.calls as ProcessingState[][];
    const finalCall = allSetCalls[allSetCalls.length - 1]?.[0];

    // Error field should be set
    expect(finalCall?.error).toBeDefined();
    expect(finalCall?.error).toContain("ECONNREFUSED");

    // Both URLs should appear as failed in results
    expect(finalCall?.results).toHaveLength(2);
    expect(finalCall?.results[0]?.status).toBe("failed");
    expect(finalCall?.results[1]?.status).toBe("failed");
    expect(finalCall?.results[0]?.error).toContain("ECONNREFUSED");
    expect(finalCall?.results[1]?.error).toContain("ECONNREFUSED");
  });

  // -----------------------------------------------------------------------
  // 3. CANCEL_PROCESSING mid-batch -> cancelled state
  // -----------------------------------------------------------------------
  it("CANCEL_PROCESSING mid-batch -> cancelled state", async () => {
    const urls = ["https://example.com/a", "https://example.com/b"];

    // processUrls takes time so we can cancel mid-flight
    mockProcessUrls.mockImplementation(
      () =>
        new Promise<ProcessingResult[]>((resolve) => {
          setTimeout(() => {
            resolve([
              successResult(urls[0]!),
              successResult(urls[1]!),
            ]);
          }, 200);
        })
    );

    // Kick off processing
    const startResponse = await sendMessage({
      type: "START_PROCESSING",
      urls,
    });
    expect(startResponse).toEqual({ type: "PROCESSING_STARTED" });

    // Wait for the initial state to be set (active:true), then cancel
    await vi.waitFor(() => {
      expect(mockSetProcessingState).toHaveBeenCalledWith(
        expect.objectContaining({ active: true })
      );
    });

    // Store a mock active state so CANCEL_PROCESSING handler can read it
    const urlStatuses: Record<string, string> = {};
    for (const u of urls) {
      urlStatuses[u] = "queued";
    }
    urlStatuses[urls[0]!] = "extracting";
    const activeState: ProcessingState = {
      active: true,
      urls,
      results: [],
      urlStatuses: urlStatuses as Record<string, import("@/background/messages").UrlStatus>,
      startedAt: Date.now(),
      cancelled: false,
    };
    mockGetProcessingState.mockResolvedValue(activeState);

    // Send cancel
    const cancelResponse = await sendMessage({
      type: "CANCEL_PROCESSING",
    });
    expect(cancelResponse).toEqual({ type: "PROCESSING_CANCELLED" });

    // The CANCEL_PROCESSING handler immediately calls setProcessingState
    // with cancelled:true and active:false
    expect(mockSetProcessingState).toHaveBeenCalledWith(
      expect.objectContaining({
        cancelled: true,
        active: false,
      })
    );

    // Wait for the batch processing promise to also complete
    await vi.waitFor(
      () => {
        const calls = mockSetProcessingState.mock.calls as ProcessingState[][];
        // The final call from runBatchProcessing should also have cancelled:true
        const finalBatchCall = calls[calls.length - 1]?.[0];
        expect(finalBatchCall?.cancelled).toBe(true);
      },
      { timeout: 1000 }
    );
  });

  // -----------------------------------------------------------------------
  // 4. History accumulation across multiple batches
  // -----------------------------------------------------------------------
  it("history accumulation across multiple batches", async () => {
    // First batch: 1 result
    const firstResult = successResult("https://example.com/first", "Inbox");
    mockProcessUrls.mockResolvedValue([firstResult]);
    mockGetLocalStorage.mockResolvedValue([]);

    await sendMessage({
      type: "START_PROCESSING",
      urls: ["https://example.com/first"],
    });

    await vi.waitFor(() => {
      expect(mockSetLocalStorage).toHaveBeenCalledWith(
        "processingHistory",
        expect.arrayContaining([
          expect.objectContaining({ url: "https://example.com/first" }),
        ])
      );
    });

    // Reset mocks for second batch, but simulate existing history
    mockSetProcessingState.mockClear();
    mockSetLocalStorage.mockClear();
    mockGetProcessingState.mockResolvedValue(null); // first batch done

    const secondResult = successResult("https://example.com/second", "Reading");
    mockProcessUrls.mockResolvedValue([secondResult]);

    // Simulate that the first batch's result is already in history
    mockGetLocalStorage.mockResolvedValue([firstResult]);

    await sendMessage({
      type: "START_PROCESSING",
      urls: ["https://example.com/second"],
    });

    await vi.waitFor(() => {
      expect(mockSetLocalStorage).toHaveBeenCalledWith(
        "processingHistory",
        expect.any(Array)
      );
    });

    // Verify the saved history has newest first, then old entries
    const historyArg = (
      mockSetLocalStorage.mock.calls as [string, ProcessingResult[]][]
    ).find(([key]) => key === "processingHistory")?.[1];

    expect(historyArg).toBeDefined();
    expect(historyArg!.length).toBe(2);
    // Newest first (from [...results, ...history] in service worker)
    expect(historyArg![0]!.url).toBe("https://example.com/second");
    expect(historyArg![1]!.url).toBe("https://example.com/first");
  });

  // -----------------------------------------------------------------------
  // 5. Concurrent START_PROCESSING while active -> PROCESSING_ALREADY_ACTIVE
  // -----------------------------------------------------------------------
  it("concurrent START_PROCESSING while active -> PROCESSING_ALREADY_ACTIVE", async () => {
    // Simulate an already-active processing state
    mockGetProcessingState.mockResolvedValue({
      active: true,
      urls: ["https://example.com/running"],
      results: [],
      urlStatuses: { "https://example.com/running": "extracting" },
      startedAt: Date.now(),
      cancelled: false,
    } satisfies ProcessingState);

    const response = await sendMessage({
      type: "START_PROCESSING",
      urls: ["https://example.com/new"],
    });

    expect(response).toEqual({ type: "PROCESSING_ALREADY_ACTIVE" });

    // processUrls should NOT have been called for the second request
    expect(mockProcessUrls).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // 6. History capped at MAX_HISTORY (100)
  // -----------------------------------------------------------------------
  it("history capped at MAX_HISTORY (100)", async () => {
    // Pre-populate history with 99 entries
    const existingHistory: ProcessingResult[] = Array.from(
      { length: 99 },
      (_, i) => successResult(`https://example.com/old-${i}`, "Archive")
    );
    mockGetLocalStorage.mockResolvedValue(existingHistory);

    // Process 2 new URLs
    const newResults: ProcessingResult[] = [
      successResult("https://example.com/new-a", "Inbox"),
      successResult("https://example.com/new-b", "Reading"),
    ];
    mockProcessUrls.mockResolvedValue(newResults);

    await sendMessage({
      type: "START_PROCESSING",
      urls: ["https://example.com/new-a", "https://example.com/new-b"],
    });

    await vi.waitFor(() => {
      expect(mockSetLocalStorage).toHaveBeenCalledWith(
        "processingHistory",
        expect.any(Array)
      );
    });

    const historyArg = (
      mockSetLocalStorage.mock.calls as [string, ProcessingResult[]][]
    ).find(([key]) => key === "processingHistory")?.[1];

    expect(historyArg).toBeDefined();
    // 2 new + 99 existing = 101, capped to 100
    expect(historyArg!.length).toBe(100);

    // Newest entries should be first
    expect(historyArg![0]!.url).toBe("https://example.com/new-a");
    expect(historyArg![1]!.url).toBe("https://example.com/new-b");

    // Oldest entry (old-98) should have been dropped
    const allUrls = historyArg!.map((r) => r.url);
    expect(allUrls).not.toContain("https://example.com/old-98");
    // But old-97 should still be present (index 99 in the capped array)
    expect(allUrls).toContain("https://example.com/old-97");
  });
});
