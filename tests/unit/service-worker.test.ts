import { describe, it, expect, vi, beforeEach } from "vitest";

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
  defaultFolder: "Inbox",
};

beforeEach(async () => {
  vi.clearAllMocks();
  commandListener = null;
  messageListener = null;
  setupChromeMock();

  mockGetConfig.mockResolvedValue(TEST_CONFIG);
  mockGetProcessingState.mockResolvedValue(null);
  mockSetProcessingState.mockResolvedValue(undefined);
  mockClearProcessingState.mockResolvedValue(undefined);
  mockGetLocalStorage.mockResolvedValue([]);
  mockSetLocalStorage.mockResolvedValue(undefined);
  mockProcessUrls.mockResolvedValue([
    { url: "https://example.com", status: "success", folder: "Inbox" },
  ]);

  // Re-import to register listeners
  vi.resetModules();
  await import("@/background/service-worker");
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
      currentIndex: 0,
      currentUrl: "https://example.com",
      currentStatus: "extracting",
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
        expect.objectContaining({
          message: "Failed: HTTP 404",
        })
      );
    });
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
        expect.any(Function) // smartExtract passed as extractFn
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

    // processUrls should be called with an extractFn (5th arg)
    expect(mockProcessUrls).toHaveBeenCalledWith(
      ["https://linkedin.com/posts/test"],
      expect.anything(),
      expect.anything(),
      expect.any(Function),
      expect.any(Function)
    );
  });
});
