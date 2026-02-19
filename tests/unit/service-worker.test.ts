import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// Hoisted mocks for core modules
const {
  mockProcessUrls,
  mockGetConfig,
  mockGetProcessingState,
  mockSetProcessingState,
  mockClearProcessingState,
  mockGetLocalStorage,
  mockSetLocalStorage,
  mockFetchAndExtract,
  mockCreateFailedExtraction,
} = vi.hoisted(() => ({
  mockProcessUrls: vi.fn(),
  mockGetConfig: vi.fn(),
  mockGetProcessingState: vi.fn(),
  mockSetProcessingState: vi.fn(),
  mockClearProcessingState: vi.fn(),
  mockGetLocalStorage: vi.fn(),
  mockSetLocalStorage: vi.fn(),
  mockFetchAndExtract: vi.fn(),
  mockCreateFailedExtraction: vi.fn((url: string, error: string) => ({
    url,
    title: "",
    content: "",
    author: null,
    datePublished: null,
    wordCount: 0,
    type: "article" as const,
    platform: "web" as const,
    status: "failed" as const,
    error,
  })),
}));

vi.mock("@/core/orchestrator", () => ({
  processUrls: mockProcessUrls,
  createDefaultProvider: vi.fn(() => ({ processContent: vi.fn() })),
}));

vi.mock("@/core/extractor", () => ({
  fetchAndExtract: mockFetchAndExtract,
  createFailedExtraction: mockCreateFailedExtraction,
}));

vi.mock("@/utils/storage", () => ({
  getConfig: mockGetConfig,
  getProcessingState: mockGetProcessingState,
  setProcessingState: mockSetProcessingState,
  clearProcessingState: mockClearProcessingState,
  getLocalStorage: mockGetLocalStorage,
  setLocalStorage: mockSetLocalStorage,
}));

vi.mock("@/utils/config", () => ({
  MAX_HISTORY: 100,
}));

// Capture chrome API handlers
let commandListener: ((command: string) => void) | null = null;
let messageListener:
  | ((
      message: { type: string; [key: string]: unknown },
      sender: chrome.runtime.MessageSender,
      sendResponse: (response: unknown) => void
    ) => boolean | void)
  | null = null;
let installedListener: (() => void) | null = null;
let contextMenuClickListener:
  | ((
      info: chrome.contextMenus.OnClickData,
      tab?: chrome.tabs.Tab
    ) => void)
  | null = null;

// Track onUpdated listeners for tab load simulation
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
        addListener: vi.fn((fn: () => void) => {
          installedListener = fn;
        }),
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
        addListener: vi.fn(
          (
            fn: (
              info: chrome.contextMenus.OnClickData,
              tab?: chrome.tabs.Tab
            ) => void
          ) => {
            contextMenuClickListener = fn;
          }
        ),
      },
    },
    tabs: {
      query: vi.fn(
        (
          _query: chrome.tabs.QueryInfo,
          callback: (tabs: chrome.tabs.Tab[]) => void
        ) => {
          callback([
            { id: 1, url: "https://example.com/current-page" } as chrome.tabs.Tab,
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
            // Auto-fire "complete" for the created tab after a tick
            setTimeout(() => fn(99, { status: "complete" } as chrome.tabs.OnUpdatedInfo), 5);
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

const TEST_CONFIG = {
  apiKey: "sk-test",
  llmProvider: "openrouter" as const,
  vaultUrl: "https://localhost:27124",
  vaultApiKey: "vault-key",
  vaultName: "TestVault",
  vaultOrganization: "para" as const,
  tagGroups: [],
  summaryDetailLevel: "standard" as const,
};

// Import once to register listeners (avoids re-importing the entire module
// graph on every test which can cause beforeEach hook timeouts).
beforeAll(async () => {
  setupChromeMock();
  vi.resetModules();
  await import("@/background/service-worker");
});

beforeEach(() => {
  // Reset only the hoisted mocks (NOT vi.clearAllMocks() which would wipe
  // chrome mock implementations and the captured listeners).
  mockProcessUrls.mockReset();
  mockGetConfig.mockReset();
  mockGetProcessingState.mockReset();
  mockSetProcessingState.mockReset();
  mockClearProcessingState.mockReset();
  mockGetLocalStorage.mockReset();
  mockSetLocalStorage.mockReset();
  mockFetchAndExtract.mockReset();
  mockCreateFailedExtraction.mockReset();

  // Re-apply default mock implementations
  mockCreateFailedExtraction.mockImplementation((url: string, error: string) => ({
    url,
    title: "",
    content: "",
    author: null,
    datePublished: null,
    wordCount: 0,
    type: "article" as const,
    platform: "web" as const,
    status: "failed" as const,
    error,
  }));
  mockGetConfig.mockResolvedValue(TEST_CONFIG);
  mockGetProcessingState.mockResolvedValue(null);
  mockSetProcessingState.mockResolvedValue(undefined);
  mockClearProcessingState.mockResolvedValue(undefined);
  mockGetLocalStorage.mockResolvedValue([]);
  mockSetLocalStorage.mockResolvedValue(undefined);
  mockProcessUrls.mockResolvedValue([
    { url: "https://example.com", status: "success", folder: "Inbox" },
  ]);

  // Clear call history on chrome mock functions so assertions are per-test
  vi.mocked(chrome.tabs.create).mockClear();
  vi.mocked(chrome.tabs.remove).mockClear();
  vi.mocked(chrome.tabs.sendMessage).mockClear();
  vi.mocked(chrome.notifications.create).mockClear();
  vi.mocked(chrome.notifications.clear).mockClear();
  vi.mocked(chrome.contextMenus.create).mockClear();
  vi.mocked(chrome.windows.create).mockClear();
  vi.mocked(chrome.scripting.executeScript).mockClear();
  vi.mocked(chrome.action.openPopup).mockClear();

  // Restore default chrome.tabs.query implementation (some tests override it)
  (chrome.tabs.query as ReturnType<typeof vi.fn>).mockImplementation(
    (
      _query: chrome.tabs.QueryInfo,
      callback: (tabs: chrome.tabs.Tab[]) => void
    ) => {
      callback([
        { id: 1, url: "https://example.com/current-page" } as chrome.tabs.Tab,
      ]);
    }
  );
});

describe("Service worker - message handling", () => {
  it("registers command and message listeners", () => {
    expect(commandListener).toBeTruthy();
    expect(messageListener).toBeTruthy();
  });

  it("handles START_PROCESSING message", async () => {
    const sendResponse = vi.fn();
    const urls = ["https://example.com/a", "https://example.com/b"];

    messageListener!(
      { type: "START_PROCESSING", urls },
      {} as chrome.runtime.MessageSender,
      sendResponse
    );

    // Wait for the async getProcessingState to resolve
    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({
        type: "PROCESSING_STARTED",
      });
    });
  });

  it("responds PROCESSING_ALREADY_ACTIVE when processing is running", async () => {
    mockGetProcessingState.mockResolvedValue({ active: true });

    const sendResponse = vi.fn();
    messageListener!(
      { type: "START_PROCESSING", urls: ["https://example.com"] },
      {} as chrome.runtime.MessageSender,
      sendResponse
    );

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({
        type: "PROCESSING_ALREADY_ACTIVE",
      });
    });
  });

  it("handles CANCEL_PROCESSING message", async () => {
    mockGetProcessingState.mockResolvedValue({
      active: true,
      urls: ["https://example.com"],
      results: [],
      urlStatuses: { "https://example.com": "extracting" },
      startedAt: Date.now(),
      cancelled: false,
    });

    const sendResponse = vi.fn();
    messageListener!(
      { type: "CANCEL_PROCESSING" },
      {} as chrome.runtime.MessageSender,
      sendResponse
    );

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({
        type: "PROCESSING_CANCELLED",
      });
    });

    expect(mockSetProcessingState).toHaveBeenCalledWith(
      expect.objectContaining({ cancelled: true, active: false })
    );
  });

  it("updates processing state during batch processing", async () => {
    const urls = ["https://example.com/a"];
    const sendResponse = vi.fn();

    messageListener!(
      { type: "START_PROCESSING", urls },
      {} as chrome.runtime.MessageSender,
      sendResponse
    );

    // Wait for processing to initiate
    await vi.waitFor(() => {
      expect(mockSetProcessingState).toHaveBeenCalled();
    });

    // Initial state should be set
    expect(mockSetProcessingState).toHaveBeenCalledWith(
      expect.objectContaining({
        active: true,
        urls,
      })
    );
  });
});

describe("Service worker - keyboard shortcut", () => {
  it("handles capture-current-page command", async () => {
    commandListener!("capture-current-page");

    // Wait for async processing
    await vi.waitFor(() => {
      expect(mockProcessUrls).toHaveBeenCalledWith(
        ["https://example.com/current-page"],
        TEST_CONFIG,
        expect.anything(),
        undefined,
        expect.any(Function)
      );
    });
  });

  it("shows notification on successful capture", async () => {
    mockProcessUrls.mockResolvedValue([
      { url: "https://example.com", status: "success", folder: "Reading" },
    ]);

    commandListener!("capture-current-page");

    await vi.waitFor(() => {
      expect(chrome.notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "basic",
          title: "2Vault",
          message: "Saved to Reading",
        })
      );
    });
  });

  it("shows failure notification on error", async () => {
    mockProcessUrls.mockResolvedValue([
      { url: "https://example.com", status: "failed", error: "HTTP 404" },
    ]);

    commandListener!("capture-current-page");

    await vi.waitFor(() => {
      expect(chrome.notifications.create).toHaveBeenCalledWith(
        "save-failed",
        expect.objectContaining({
          message: "Save failed - click extension icon to retry",
        })
      );
    });

    // Should store pending URL for popup prefill
    expect(mockSetLocalStorage).toHaveBeenCalledWith(
      "pendingCaptureUrl",
      "https://example.com/current-page"
    );
  });

  it("does not process chrome:// URLs", () => {
    (chrome.tabs.query as ReturnType<typeof vi.fn>).mockImplementation(
      (
        _query: chrome.tabs.QueryInfo,
        callback: (tabs: chrome.tabs.Tab[]) => void
      ) => {
        callback([{ id: 1, url: "chrome://extensions" } as chrome.tabs.Tab]);
      }
    );

    commandListener!("capture-current-page");

    expect(mockProcessUrls).not.toHaveBeenCalled();
  });

  it("skips capture when API keys are missing", async () => {
    mockGetConfig.mockResolvedValue({
      ...TEST_CONFIG,
      apiKey: "",
      vaultApiKey: "",
    });

    commandListener!("capture-current-page");

    // Give time for async
    await new Promise((r) => setTimeout(r, 50));
    expect(mockProcessUrls).not.toHaveBeenCalled();
  });

  it("passes extractFn that uses active tab for social media URLs", async () => {
    // Set the active tab to an X/Twitter URL
    (chrome.tabs.query as ReturnType<typeof vi.fn>).mockImplementation(
      (
        _query: chrome.tabs.QueryInfo,
        callback: (tabs: chrome.tabs.Tab[]) => void
      ) => {
        callback([
          { id: 42, url: "https://x.com/user/status/789" } as chrome.tabs.Tab,
        ]);
      }
    );

    commandListener!("capture-current-page");

    await vi.waitFor(() => {
      expect(mockProcessUrls).toHaveBeenCalledWith(
        ["https://x.com/user/status/789"],
        TEST_CONFIG,
        expect.anything(),
        undefined,
        expect.any(Function)
      );
    });

    // For social media on active tab, should NOT open a new tab
    expect(chrome.tabs.create).not.toHaveBeenCalled();
  });
});

// -- Batch error handling -----------------------------------------------------

describe("Service worker - batch error handling", () => {
  it("sets error field when processUrls throws", async () => {
    mockProcessUrls.mockRejectedValue(
      new Error("VaultClientError: Network error: Failed to fetch")
    );

    const sendResponse = vi.fn();
    messageListener!(
      { type: "START_PROCESSING", urls: ["https://example.com/a"] },
      {} as chrome.runtime.MessageSender,
      sendResponse
    );

    await vi.waitFor(() => {
      const calls = mockSetProcessingState.mock.calls;
      const finalCall = calls[calls.length - 1];
      expect(finalCall).toBeDefined();
      const finalState = finalCall![0] as { active: boolean; error?: string };
      expect(finalState.active).toBe(false);
      expect(finalState.error).toBe(
        "VaultClientError: Network error: Failed to fetch"
      );
    });
  });

  it("marks remaining URLs as failed when batch throws", async () => {
    mockProcessUrls.mockRejectedValue(new Error("Vault unreachable"));

    const sendResponse = vi.fn();
    messageListener!(
      {
        type: "START_PROCESSING",
        urls: ["https://example.com/a", "https://example.com/b"],
      },
      {} as chrome.runtime.MessageSender,
      sendResponse
    );

    await vi.waitFor(() => {
      const calls = mockSetProcessingState.mock.calls;
      const finalCall = calls[calls.length - 1];
      expect(finalCall).toBeDefined();
      const finalState = finalCall![0] as {
        results: Array<{ url: string; status: string; error?: string }>;
      };
      expect(finalState.results).toHaveLength(2);
      expect(finalState.results[0]).toEqual(
        expect.objectContaining({
          url: "https://example.com/a",
          status: "failed",
          error: "Vault unreachable",
        })
      );
      expect(finalState.results[1]).toEqual(
        expect.objectContaining({
          url: "https://example.com/b",
          status: "failed",
          error: "Vault unreachable",
        })
      );
    });
  });

  it("saves history after successful batch", async () => {
    const results = [
      { url: "https://example.com/a", status: "success" as const, folder: "Inbox" },
    ];
    mockProcessUrls.mockResolvedValue(results);

    const sendResponse = vi.fn();
    messageListener!(
      { type: "START_PROCESSING", urls: ["https://example.com/a"] },
      {} as chrome.runtime.MessageSender,
      sendResponse
    );

    await vi.waitFor(() => {
      expect(mockSetLocalStorage).toHaveBeenCalledWith(
        "processingHistory",
        expect.arrayContaining([
          expect.objectContaining({ url: "https://example.com/a" }),
        ])
      );
    });
  });

  it("caps history at MAX_HISTORY (100)", async () => {
    const existingHistory = Array.from({ length: 99 }, (_, i) => ({
      url: `https://example.com/old-${i}`,
      status: "success" as const,
    }));
    mockGetLocalStorage.mockResolvedValue(existingHistory);

    const newResults = [
      { url: "https://example.com/new-1", status: "success" as const, folder: "Inbox" },
      { url: "https://example.com/new-2", status: "success" as const, folder: "Inbox" },
    ];
    mockProcessUrls.mockResolvedValue(newResults);

    const sendResponse = vi.fn();
    messageListener!(
      {
        type: "START_PROCESSING",
        urls: ["https://example.com/new-1", "https://example.com/new-2"],
      },
      {} as chrome.runtime.MessageSender,
      sendResponse
    );

    await vi.waitFor(() => {
      expect(mockSetLocalStorage).toHaveBeenCalledWith(
        "processingHistory",
        expect.any(Array)
      );
      const historyCall = mockSetLocalStorage.mock.calls.find(
        (c) => (c as [string, unknown])[0] === "processingHistory"
      );
      expect(historyCall).toBeDefined();
      const savedHistory = (historyCall as [string, unknown[]])[1];
      expect(savedHistory.length).toBeLessThanOrEqual(100);
    });
  });
});

// -- isSocialMediaUrl ---------------------------------------------------------

describe("Service worker - isSocialMediaUrl", () => {
  // We test the function indirectly through behavior since it's not directly
  // re-exported after vi.resetModules(). The batch processing test below
  // validates the routing logic.

  it("passes smartExtract to batch processing", async () => {
    const urls = ["https://x.com/user/status/1", "https://example.com/article"];
    const sendResponse = vi.fn();

    messageListener!(
      { type: "START_PROCESSING", urls },
      {} as chrome.runtime.MessageSender,
      sendResponse
    );

    await vi.waitFor(() => {
      expect(mockProcessUrls).toHaveBeenCalledWith(
        urls,
        TEST_CONFIG,
        expect.anything(),
        expect.any(Function),
        expect.any(Function), // smartExtract passed as extractFn
        expect.any(Function)  // isCancelled callback
      );
    });
  });
});

// -- Reddit URL routing -------------------------------------------------------

describe("Service worker - Reddit URL routing", () => {
  it("routes reddit.com URLs through smartExtract (social media path)", async () => {
    (chrome.tabs.query as ReturnType<typeof vi.fn>).mockImplementation(
      (
        _query: chrome.tabs.QueryInfo,
        callback: (tabs: chrome.tabs.Tab[]) => void
      ) => {
        callback([
          { id: 50, url: "https://www.reddit.com/r/webdev/comments/abc/test" } as chrome.tabs.Tab,
        ]);
      }
    );

    commandListener!("capture-current-page");

    await vi.waitFor(() => {
      expect(mockProcessUrls).toHaveBeenCalledWith(
        ["https://www.reddit.com/r/webdev/comments/abc/test"],
        TEST_CONFIG,
        expect.anything(),
        undefined,
        expect.any(Function)
      );
    });
  });

  it("routes old.reddit.com URLs through smartExtract", async () => {
    (chrome.tabs.query as ReturnType<typeof vi.fn>).mockImplementation(
      (
        _query: chrome.tabs.QueryInfo,
        callback: (tabs: chrome.tabs.Tab[]) => void
      ) => {
        callback([
          { id: 51, url: "https://old.reddit.com/r/webdev/comments/abc/test" } as chrome.tabs.Tab,
        ]);
      }
    );

    commandListener!("capture-current-page");

    await vi.waitFor(() => {
      expect(mockProcessUrls).toHaveBeenCalledWith(
        ["https://old.reddit.com/r/webdev/comments/abc/test"],
        TEST_CONFIG,
        expect.anything(),
        undefined,
        expect.any(Function)
      );
    });
  });
});

// -- extractViaDom (tab-based extraction) -------------------------------------

describe("Service worker - tab-based DOM extraction", () => {
  it("batch processing calls processUrls with smartExtract", async () => {
    const sendResponse = vi.fn();

    messageListener!(
      { type: "START_PROCESSING", urls: ["https://linkedin.com/posts/test"] },
      {} as chrome.runtime.MessageSender,
      sendResponse
    );

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({
        type: "PROCESSING_STARTED",
      });
    });

    // processUrls should be called with an extractFn (5th arg) and isCancelled (6th arg)
    expect(mockProcessUrls).toHaveBeenCalledWith(
      ["https://linkedin.com/posts/test"],
      expect.anything(),
      expect.anything(),
      expect.any(Function),
      expect.any(Function),
      expect.any(Function)
    );
  });
});

// -- Context menu -------------------------------------------------------------

describe("Service worker - context menu", () => {
  it("registers context menu items on install", () => {
    expect(installedListener).toBeTruthy();
    installedListener!();

    expect(chrome.contextMenus.create).toHaveBeenCalledWith({
      id: "save-page-to-2vault",
      title: "Save to 2Vault",
      contexts: ["page"],
    });
    expect(chrome.contextMenus.create).toHaveBeenCalledWith({
      id: "save-link-to-2vault",
      title: "Save Link to 2Vault",
      contexts: ["link"],
    });
  });

  it("registers context menu click listener", () => {
    expect(contextMenuClickListener).toBeTruthy();
  });

  it("handles page context click - stores URL and opens popup", async () => {
    contextMenuClickListener!(
      { menuItemId: "save-page-to-2vault" } as chrome.contextMenus.OnClickData,
      { id: 10, url: "https://example.com/article" } as chrome.tabs.Tab
    );

    await vi.waitFor(() => {
      expect(mockSetLocalStorage).toHaveBeenCalledWith(
        "pendingCaptureUrl",
        "https://example.com/article"
      );
      expect(chrome.windows.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: "popup" })
      );
    });
  });

  it("handles link context click - stores URL and opens popup", async () => {
    contextMenuClickListener!(
      {
        menuItemId: "save-link-to-2vault",
        linkUrl: "https://example.com/linked-page",
      } as chrome.contextMenus.OnClickData,
      { id: 10, url: "https://example.com/current" } as chrome.tabs.Tab
    );

    await vi.waitFor(() => {
      expect(mockSetLocalStorage).toHaveBeenCalledWith(
        "pendingCaptureUrl",
        "https://example.com/linked-page"
      );
      expect(chrome.windows.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: "popup" })
      );
    });
  });

  it("ignores chrome:// URLs for page context", async () => {
    contextMenuClickListener!(
      { menuItemId: "save-page-to-2vault" } as chrome.contextMenus.OnClickData,
      { id: 10, url: "chrome://extensions" } as chrome.tabs.Tab
    );

    await new Promise((r) => setTimeout(r, 50));
    expect(mockSetLocalStorage).not.toHaveBeenCalledWith("pendingCaptureUrl", expect.anything());
    expect(chrome.windows.create).not.toHaveBeenCalled();
  });

  it("ignores about: URLs for page context", async () => {
    contextMenuClickListener!(
      { menuItemId: "save-page-to-2vault" } as chrome.contextMenus.OnClickData,
      { id: 10, url: "about:blank" } as chrome.tabs.Tab
    );

    await new Promise((r) => setTimeout(r, 50));
    expect(mockSetLocalStorage).not.toHaveBeenCalledWith("pendingCaptureUrl", expect.anything());
    expect(chrome.windows.create).not.toHaveBeenCalled();
  });

  it("handles missing tab gracefully for page context", async () => {
    contextMenuClickListener!(
      { menuItemId: "save-page-to-2vault" } as chrome.contextMenus.OnClickData,
      undefined
    );

    await new Promise((r) => setTimeout(r, 50));
    expect(mockSetLocalStorage).not.toHaveBeenCalledWith("pendingCaptureUrl", expect.anything());
    expect(chrome.windows.create).not.toHaveBeenCalled();
  });

  it("handles missing linkUrl gracefully for link context", async () => {
    contextMenuClickListener!(
      { menuItemId: "save-link-to-2vault" } as chrome.contextMenus.OnClickData,
      { id: 10, url: "https://example.com" } as chrome.tabs.Tab
    );

    await new Promise((r) => setTimeout(r, 50));
    expect(mockSetLocalStorage).not.toHaveBeenCalledWith("pendingCaptureUrl", expect.anything());
    expect(chrome.windows.create).not.toHaveBeenCalled();
  });

  it("stores social media URL and opens popup for page context", async () => {
    contextMenuClickListener!(
      { menuItemId: "save-page-to-2vault" } as chrome.contextMenus.OnClickData,
      { id: 42, url: "https://x.com/user/status/123" } as chrome.tabs.Tab
    );

    await vi.waitFor(() => {
      expect(mockSetLocalStorage).toHaveBeenCalledWith(
        "pendingCaptureUrl",
        "https://x.com/user/status/123"
      );
      expect(chrome.windows.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: "popup" })
      );
    });
  });
});

// -- extractViaDom retry logic ------------------------------------------------

describe("Service worker - extractViaDom retry logic", () => {
  /**
   * Helper: trigger START_PROCESSING and capture the extractFn (5th arg)
   * that runBatchProcessing passes to processUrls.
   */
  async function captureExtractFn(
    urls: string[] = ["https://x.com/user/status/123"]
  ): Promise<(url: string) => Promise<ExtractedContent>> {
    // Make processUrls hang until we resolve it, so we can grab the extractFn
    let resolveProcessUrls!: (value: ProcessingResult[]) => void;
    const processUrlsPromise = new Promise<ProcessingResult[]>((resolve) => {
      resolveProcessUrls = resolve;
    });
    mockProcessUrls.mockReturnValue(processUrlsPromise);

    const sendResponse = vi.fn();
    messageListener!(
      { type: "START_PROCESSING", urls },
      {} as chrome.runtime.MessageSender,
      sendResponse
    );

    // Wait until processUrls is called
    let extractFn!: (url: string) => Promise<ExtractedContent>;
    await vi.waitFor(() => {
      expect(mockProcessUrls).toHaveBeenCalled();
      const call = mockProcessUrls.mock.calls[0];
      extractFn = call[4] as (url: string) => Promise<ExtractedContent>;
      expect(extractFn).toBeTypeOf("function");
    });

    // Resolve processUrls so the batch completes in the background
    resolveProcessUrls([{ url: urls[0]!, status: "success", folder: "Inbox" }]);

    return extractFn;
  }

  // We need chrome.tabs.get for waitForTabLoad. Add it if not already present.
  beforeEach(() => {
    if (!chrome.tabs.get) {
      (chrome.tabs as Record<string, ReturnType<typeof vi.fn>>).get = vi.fn();
    }
    // Default: tab not yet loaded (will wait for onUpdated)
    vi.mocked(chrome.tabs.get).mockResolvedValue({
      status: "loading",
    } as chrome.tabs.Tab);

    // Restore default sendMessage behavior (successful extraction)
    vi.mocked(chrome.tabs.sendMessage).mockReset();
    vi.mocked(chrome.tabs.sendMessage).mockResolvedValue({
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
    });

    // Restore default tabs.create (returns tab with id 99)
    vi.mocked(chrome.tabs.create).mockReset();
    vi.mocked(chrome.tabs.create).mockResolvedValue({ id: 99 } as chrome.tabs.Tab);

    vi.mocked(chrome.tabs.remove).mockReset();
    vi.mocked(chrome.tabs.remove).mockResolvedValue(undefined);

    vi.mocked(chrome.scripting.executeScript).mockReset();
    vi.mocked(chrome.scripting.executeScript).mockResolvedValue([{ result: undefined }] as chrome.scripting.InjectionResult[]);

    // Reset onUpdated listeners
    tabUpdateListeners = [];
    vi.mocked(chrome.tabs.onUpdated.addListener).mockImplementation(
      (fn: (tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo) => void) => {
        tabUpdateListeners.push(fn);
        // Auto-fire "complete" for the created tab after a tick
        setTimeout(() => fn(99, { status: "complete" } as chrome.tabs.OnUpdatedInfo), 5);
      }
    );
    vi.mocked(chrome.tabs.onUpdated.removeListener).mockImplementation(
      (fn: (tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo) => void) => {
        tabUpdateListeners = tabUpdateListeners.filter((l) => l !== fn);
      }
    );
  });

  it("extractViaDom succeeds on first attempt", async () => {
    vi.mocked(chrome.tabs.sendMessage).mockResolvedValue({
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
    });

    const extractFn = await captureExtractFn();
    const result = await extractFn("https://x.com/user/status/123");

    expect(result.status).toBe("success");
    expect(result.title).toBe("Post by Test User");
    // Tab should be cleaned up
    expect(chrome.tabs.remove).toHaveBeenCalled();
  });

  it("extractViaDom retries on failed extraction", async () => {
    vi.useFakeTimers();

    let callCount = 0;
    vi.mocked(chrome.tabs.sendMessage).mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          type: "EXTRACTION_RESULT",
          data: {
            url: "https://x.com/user/status/123",
            title: "",
            content: "",
            author: null,
            datePublished: null,
            wordCount: 0,
            type: "social-media",
            platform: "x",
            status: "failed",
            error: "fallback",
          },
        };
      }
      return {
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
      };
    });

    // Make tabs.get return complete so waitForTabLoad resolves fast
    vi.mocked(chrome.tabs.get).mockResolvedValue({
      status: "complete",
    } as chrome.tabs.Tab);

    const extractFn = await captureExtractFn();
    const resultPromise = extractFn("https://x.com/user/status/123");

    // Advance past the first retry delay (1000ms)
    await vi.advanceTimersByTimeAsync(1_500);

    const result = await resultPromise;

    expect(result.status).toBe("success");
    expect(callCount).toBeGreaterThanOrEqual(2);

    vi.useRealTimers();
  });

  it("extractViaDom returns timeout after MAX_DOM_ATTEMPTS", async () => {
    vi.useFakeTimers();

    vi.mocked(chrome.tabs.sendMessage).mockResolvedValue({
      type: "EXTRACTION_RESULT",
      data: {
        url: "https://x.com/user/status/123",
        title: "",
        content: "",
        author: null,
        datePublished: null,
        wordCount: 0,
        type: "social-media",
        platform: "x",
        status: "failed",
        error: "no content found",
      },
    });

    // Make tabs.get return complete so waitForTabLoad resolves fast
    vi.mocked(chrome.tabs.get).mockResolvedValue({
      status: "complete",
    } as chrome.tabs.Tab);

    const extractFn = await captureExtractFn();
    const resultPromise = extractFn("https://x.com/user/status/123");

    // Advance through all retry delays: 1s + 5s + 5s + 10s + 10s + 15s + 15s + 20s = 81s
    // Use a generous advance to cover all delays plus internal timeouts
    for (let i = 0; i < 10; i++) {
      await vi.advanceTimersByTimeAsync(25_000);
    }

    const result = await resultPromise;

    expect(result.error).toContain("Timed out after");
    expect(result.status).toBe("failed");

    vi.useRealTimers();
  });

  it("waitForTabLoad resolves immediately for already-loaded tabs", async () => {
    // Mock tabs.get to return a tab that is already complete
    vi.mocked(chrome.tabs.get).mockResolvedValue({
      status: "complete",
    } as chrome.tabs.Tab);

    // Clear the addListener mock to track fresh calls
    vi.mocked(chrome.tabs.onUpdated.addListener).mockClear();

    // We cannot call waitForTabLoad directly, but extractViaDom calls it.
    // If tabs.get returns complete, onUpdated.addListener should NOT be called.
    const extractFn = await captureExtractFn();
    await extractFn("https://x.com/user/status/123");

    // onUpdated.addListener should NOT have been called since tab was already loaded
    expect(chrome.tabs.onUpdated.addListener).not.toHaveBeenCalled();
  });

  it("tryExtractFromTab re-injects content script on failure", async () => {
    // sendMessageWithRetry does SEND_RETRY_COUNT+1 = 4 attempts.
    // All 4 must throw so tryExtractFromTab catches and re-injects.
    // Then the direct sendMessage call (5th) after re-injection succeeds.
    let callCount = 0;
    vi.mocked(chrome.tabs.sendMessage).mockImplementation(async () => {
      callCount++;
      if (callCount <= 4) {
        throw new Error("Could not establish connection");
      }
      // After re-injection, succeed
      return {
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
      };
    });

    vi.useFakeTimers();

    // Make tabs.get return complete so waitForTabLoad resolves fast
    vi.mocked(chrome.tabs.get).mockResolvedValue({
      status: "complete",
    } as chrome.tabs.Tab);

    const extractFn = await captureExtractFn();
    const resultPromise = extractFn("https://x.com/user/status/123");

    // Advance timers to cover sendMessageWithRetry delays + post-injection wait
    for (let i = 0; i < 5; i++) {
      await vi.advanceTimersByTimeAsync(5_000);
    }

    const result = await resultPromise;

    // scripting.executeScript should have been called to re-inject
    expect(chrome.scripting.executeScript).toHaveBeenCalledWith(
      expect.objectContaining({
        target: { tabId: 99 },
      })
    );

    vi.useRealTimers();
  });

  it("sendMessageWithRetry retries on 'Receiving end does not exist'", async () => {
    let callCount = 0;
    vi.mocked(chrome.tabs.sendMessage).mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error("Receiving end does not exist");
      }
      return {
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
      };
    });

    vi.useFakeTimers();

    // Make tabs.get return complete
    vi.mocked(chrome.tabs.get).mockResolvedValue({
      status: "complete",
    } as chrome.tabs.Tab);

    const extractFn = await captureExtractFn();
    const resultPromise = extractFn("https://x.com/user/status/123");

    // Advance past sendMessageWithRetry delay (500ms * (attempt+1))
    for (let i = 0; i < 5; i++) {
      await vi.advanceTimersByTimeAsync(2_000);
    }

    const result = await resultPromise;

    expect(result.status).toBe("success");
    // sendMessage should have been called at least twice (1 failure + 1 success)
    expect(callCount).toBeGreaterThanOrEqual(2);

    vi.useRealTimers();
  });

  it("preloadTabs only opens tabs for social media URLs", async () => {
    vi.mocked(chrome.tabs.create).mockClear();

    const urls = [
      "https://x.com/user/status/123",
      "https://example.com/article",
      "https://www.linkedin.com/posts/test",
      "https://news.ycombinator.com/item?id=1",
      "https://www.reddit.com/r/webdev/comments/abc/test",
    ];

    // Trigger batch processing which calls preloadTabs internally
    const sendResponse = vi.fn();
    messageListener!(
      { type: "START_PROCESSING", urls },
      {} as chrome.runtime.MessageSender,
      sendResponse
    );

    // Wait for processUrls to be called (which means preloadTabs already ran)
    await vi.waitFor(() => {
      expect(mockProcessUrls).toHaveBeenCalled();
    });

    // tabs.create should only be called for social media URLs (x.com, linkedin, reddit)
    const createCalls = vi.mocked(chrome.tabs.create).mock.calls;
    const createdUrls = createCalls.map(
      (call) => (call[0] as { url: string }).url
    );

    // Should contain social media URLs
    expect(createdUrls).toContain("https://x.com/user/status/123");
    expect(createdUrls).toContain("https://www.linkedin.com/posts/test");
    expect(createdUrls).toContain("https://www.reddit.com/r/webdev/comments/abc/test");

    // Should NOT contain non-social-media URLs
    expect(createdUrls).not.toContain("https://example.com/article");
    expect(createdUrls).not.toContain("https://news.ycombinator.com/item?id=1");
  });

  it("claimPreloadedTab returns preloaded tab ID", async () => {
    // Pre-load a tab by starting batch processing
    const socialUrl = "https://x.com/user/status/456";

    // Make tabs.create resolve with a specific tab ID for our URL
    vi.mocked(chrome.tabs.create).mockImplementation(async (opts) => {
      const url = (opts as { url: string }).url;
      if (url === socialUrl) {
        return { id: 77 } as chrome.tabs.Tab;
      }
      return { id: 99 } as chrome.tabs.Tab;
    });

    // tabs.get returns complete for the preloaded tab
    vi.mocked(chrome.tabs.get).mockResolvedValue({
      status: "complete",
    } as chrome.tabs.Tab);

    // When processUrls is called, we capture extractFn and call it.
    // The extractFn (extractWithRetryStatus) calls extractViaDom, which
    // calls claimPreloadedTab internally.
    let extractFn!: (url: string) => Promise<ExtractedContent>;
    let resolveProcessUrls!: (value: ProcessingResult[]) => void;
    mockProcessUrls.mockImplementation(
      async (
        _urls: string[],
        _config: Record<string, string>,
        _provider: Record<string, unknown>,
        _onProgress: ((url: string, status: string) => void) | undefined,
        extractWithRetryStatus: (url: string) => Promise<ExtractedContent>,
      ) => {
        extractFn = extractWithRetryStatus;
        // Call extractFn which should use the preloaded tab
        const result = await extractFn(socialUrl);
        return [{ url: socialUrl, status: result.status as "success", folder: "Inbox" }];
      }
    );

    const sendResponse = vi.fn();
    messageListener!(
      { type: "START_PROCESSING", urls: [socialUrl] },
      {} as chrome.runtime.MessageSender,
      sendResponse
    );

    await vi.waitFor(() => {
      expect(mockProcessUrls).toHaveBeenCalled();
    });

    // Wait for the batch processing to complete
    await vi.waitFor(() => {
      // The preloaded tab (id 77) should have been used, not a fresh one
      // tabs.create should have been called once for preloading
      const createCalls = vi.mocked(chrome.tabs.create).mock.calls;
      expect(createCalls.length).toBeGreaterThanOrEqual(1);
      const preloadCall = createCalls.find(
        (call) => (call[0] as { url: string }).url === socialUrl
      );
      expect(preloadCall).toBeDefined();
    });

    // The tab 77 (preloaded) should eventually be removed (cleanup)
    await vi.waitFor(() => {
      expect(chrome.tabs.remove).toHaveBeenCalledWith(77);
    });
  });
});

// Type import for captureExtractFn return type
type ExtractedContent = import("@/core/types.ts").ExtractedContent;
type ProcessingResult = import("@/core/types.ts").ProcessingResult;

// -- Tab Preloader: additional coverage (HIGH) --------------------------------

describe("Service worker - Tab Preloader (direct API)", () => {
  let sw: {
    preloadTabs: (urls: string[]) => void;
    clearAllProcessingTabs: () => void;
    extractViaDom: (
      url: string,
      onRetry?: (attempt: number, total: number) => void,
    ) => Promise<ExtractedContent>;
  };

  beforeAll(async () => {
    const mod = await import("@/background/service-worker");
    sw = {
      preloadTabs: mod.preloadTabs,
      clearAllProcessingTabs: mod.clearAllProcessingTabs,
      extractViaDom: mod.extractViaDom,
    };
  });

  beforeEach(() => {
    sw.clearAllProcessingTabs();
    vi.mocked(chrome.tabs.create).mockClear();
    vi.mocked(chrome.tabs.remove).mockClear();
    vi.mocked(chrome.tabs.sendMessage).mockClear();

    let nextTabId = 300;
    vi.mocked(chrome.tabs.create).mockImplementation(() =>
      Promise.resolve({ id: nextTabId++ } as chrome.tabs.Tab),
    );

    if (!chrome.tabs.get) {
      (chrome.tabs as Record<string, ReturnType<typeof vi.fn>>).get = vi.fn();
    }
    vi.mocked(chrome.tabs.get).mockImplementation((tabId: number) =>
      Promise.resolve({ id: tabId, status: "complete" } as chrome.tabs.Tab),
    );

    vi.mocked(chrome.tabs.sendMessage).mockResolvedValue({
      type: "EXTRACTION_RESULT",
      data: {
        url: "https://x.com/user/status/1",
        title: "Test Post",
        content: "Content",
        author: null,
        datePublished: null,
        wordCount: 1,
        type: "social-media",
        platform: "x",
        status: "success",
      },
    });
  });

  it("preloadTabs does not exceed MAX_PRELOADED_TABS (5)", async () => {
    const socialUrls = Array.from(
      { length: 8 },
      (_, i) => `https://x.com/user/status/${i + 1}`,
    );

    sw.preloadTabs(socialUrls);
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(vi.mocked(chrome.tabs.create).mock.calls.length).toBeLessThanOrEqual(5);
  });

  it("claimPreloadedTab returns preloaded tab immediately when available", async () => {
    const url = "https://x.com/user/status/42";

    sw.preloadTabs([url]);
    await new Promise((resolve) => setTimeout(resolve, 50));

    vi.mocked(chrome.tabs.create).mockClear();

    await sw.extractViaDom(url);

    expect(vi.mocked(chrome.tabs.create)).not.toHaveBeenCalled();
  });

  it("claimPreloadedTab returns undefined when no tab available", async () => {
    const url = "https://x.com/user/status/99";

    await sw.extractViaDom(url);

    expect(vi.mocked(chrome.tabs.create)).toHaveBeenCalledWith(
      expect.objectContaining({ url, active: false }),
    );
  });

  it("releaseTab removes the tab and triggers fillPreloadSlots", async () => {
    const urls = Array.from(
      { length: 6 },
      (_, i) => `https://x.com/user/status/${i + 1}`,
    );

    sw.preloadTabs(urls);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const createCountAfterPreload = vi.mocked(chrome.tabs.create).mock.calls.length;
    expect(createCountAfterPreload).toBeLessThanOrEqual(5);

    await sw.extractViaDom("https://x.com/user/status/1");

    expect(vi.mocked(chrome.tabs.remove)).toHaveBeenCalled();

    const createCountAfterRelease = vi.mocked(chrome.tabs.create).mock.calls.length;
    expect(createCountAfterRelease).toBeGreaterThan(createCountAfterPreload);
  });

  it("clearAllProcessingTabs closes all preloaded tabs", async () => {
    const urls = [
      "https://x.com/user/status/1",
      "https://x.com/user/status/2",
      "https://x.com/user/status/3",
    ];

    sw.preloadTabs(urls);
    await new Promise((resolve) => setTimeout(resolve, 50));

    vi.mocked(chrome.tabs.remove).mockClear();

    sw.clearAllProcessingTabs();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(vi.mocked(chrome.tabs.remove)).toHaveBeenCalledTimes(urls.length);
  });

  it("preloadedTabs skips duplicate URLs already in the map", async () => {
    const url = "https://x.com/user/status/unique";

    sw.preloadTabs([url]);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(vi.mocked(chrome.tabs.create)).toHaveBeenCalledTimes(1);

    sw.preloadTabs([url]);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(vi.mocked(chrome.tabs.create)).toHaveBeenCalledTimes(1);
  });

  it("pendingTabCreations count decrements even on tab creation failure", async () => {
    vi.mocked(chrome.tabs.create).mockRejectedValue(
      new Error("Tab creation failed"),
    );

    const urls = Array.from(
      { length: 5 },
      (_, i) => `https://x.com/user/status/${i + 1}`,
    );

    sw.preloadTabs(urls);
    await new Promise((resolve) => setTimeout(resolve, 100));

    vi.mocked(chrome.tabs.create).mockClear();
    let nextRecoveryId = 400;
    vi.mocked(chrome.tabs.create).mockImplementation(() =>
      Promise.resolve({ id: nextRecoveryId++ } as chrome.tabs.Tab),
    );

    sw.preloadTabs(urls);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(vi.mocked(chrome.tabs.create).mock.calls.length).toBeGreaterThan(0);
  });
});
