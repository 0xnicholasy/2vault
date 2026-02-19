import { describe, it, expect, vi, beforeEach } from "vitest";

// In-memory stores that simulate chrome.storage
const syncStore: Record<string, unknown> = {};
const localStore: Record<string, unknown> = {};

function setupChromeMock() {
  vi.stubGlobal("chrome", {
    storage: {
      sync: {
        get: vi.fn((key: string) =>
          Promise.resolve({ [key]: syncStore[key] })
        ),
        set: vi.fn((obj: Record<string, unknown>) => {
          Object.assign(syncStore, obj);
          return Promise.resolve();
        }),
      },
      local: {
        get: vi.fn((key: string) =>
          Promise.resolve({ [key]: localStore[key] })
        ),
        set: vi.fn((obj: Record<string, unknown>) => {
          Object.assign(localStore, obj);
          return Promise.resolve();
        }),
        remove: vi.fn((key: string) => {
          delete localStore[key];
          return Promise.resolve();
        }),
      },
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
  });
}

setupChromeMock();

const {
  getSyncStorage,
  setSyncStorage,
  getLocalStorage,
  setLocalStorage,
  getConfig,
  getProcessingState,
  setProcessingState,
  clearProcessingState,
  getProcessingHistory,
  clearProcessingHistory,
} = await import("@/utils/storage");

beforeEach(() => {
  for (const key of Object.keys(syncStore)) delete syncStore[key];
  for (const key of Object.keys(localStore)) delete localStore[key];
  vi.clearAllMocks();
  setupChromeMock();
});

describe("getSyncStorage / setSyncStorage", () => {
  it("returns undefined for missing keys", async () => {
    const result = await getSyncStorage("apiKey");
    expect(result).toBeUndefined();
  });

  it("reads back a value after setting it", async () => {
    await setSyncStorage("apiKey", "sk-or-test-123");
    const result = await getSyncStorage("apiKey");
    expect(result).toBe("sk-or-test-123");
  });

  it("stores multiple keys independently", async () => {
    await setSyncStorage("apiKey", "key-1");
    await setSyncStorage("vaultUrl", "https://localhost:9999");

    expect(await getSyncStorage("apiKey")).toBe("key-1");
    expect(await getSyncStorage("vaultUrl")).toBe("https://localhost:9999");
  });
});

describe("getLocalStorage / setLocalStorage", () => {
  it("returns undefined for missing keys", async () => {
    const result = await getLocalStorage("processingHistory");
    expect(result).toBeUndefined();
  });

  it("reads back a value after setting it", async () => {
    const history = [
      { url: "https://example.com", status: "success" as const },
    ];
    await setLocalStorage("processingHistory", history as never);
    const result = await getLocalStorage("processingHistory");
    expect(result).toEqual(history);
  });
});

describe("getConfig", () => {
  it("returns defaults when storage is empty", async () => {
    const config = await getConfig();

    expect(config).toEqual({
      apiKey: "",
      llmProvider: "openrouter",
      vaultUrl: "http://localhost:27123",
      vaultApiKey: "",
      vaultName: "",
      vaultOrganization: "para",
      tagGroups: [],
      summaryDetailLevel: "standard",
    });
  });

  it("loads all fields from storage", async () => {
    syncStore["apiKey"] = "sk-or-real";
    syncStore["llmProvider"] = "openrouter";
    syncStore["vaultUrl"] = "http://localhost:27123";
    syncStore["vaultApiKey"] = "vault-key-abc";
    syncStore["vaultName"] = "My Vault";

    const config = await getConfig();

    expect(config.apiKey).toBe("sk-or-real");
    expect(config.vaultUrl).toBe("http://localhost:27123");
    expect(config.vaultApiKey).toBe("vault-key-abc");
    expect(config.vaultName).toBe("My Vault");
    expect(config.llmProvider).toBe("openrouter");
  });

  it("applies defaults for partially configured storage", async () => {
    syncStore["apiKey"] = "sk-or-partial";
    // vaultUrl, vaultApiKey, vaultName are NOT set

    const config = await getConfig();

    expect(config.apiKey).toBe("sk-or-partial");
    expect(config.vaultUrl).toBe("http://localhost:27123");
    expect(config.vaultApiKey).toBe("");
    expect(config.vaultName).toBe("");
  });
});

describe("getProcessingState / setProcessingState / clearProcessingState", () => {
  it("returns null when no state exists", async () => {
    const state = await getProcessingState();
    expect(state).toBeNull();
  });

  it("persists and retrieves processing state", async () => {
    const state = {
      active: true,
      urls: ["https://example.com/1"],
      results: [],
      urlStatuses: { "https://example.com/1": "extracting" as const },
      startedAt: 1707000000000,
      cancelled: false,
    };

    await setProcessingState(state);
    const retrieved = await getProcessingState();

    expect(retrieved).toEqual(state);
  });

  it("overwrites previous state on set", async () => {
    const initial = {
      active: true,
      urls: ["https://example.com/1"],
      results: [],
      urlStatuses: { "https://example.com/1": "extracting" as const },
      startedAt: 1707000000000,
      cancelled: false,
    };
    await setProcessingState(initial);

    const updated = { ...initial, active: false, urlStatuses: { "https://example.com/1": "done" as const } };
    await setProcessingState(updated);

    const retrieved = await getProcessingState();
    expect(retrieved?.active).toBe(false);
    expect(retrieved?.urlStatuses["https://example.com/1"]).toBe("done");
  });

  it("clears state completely", async () => {
    await setProcessingState({
      active: true,
      urls: [],
      results: [],
      urlStatuses: {},
      startedAt: 0,
      cancelled: false,
    });

    await clearProcessingState();
    const state = await getProcessingState();
    expect(state).toBeNull();
  });
});

describe("getProcessingHistory / clearProcessingHistory", () => {
  it("returns empty array when no history exists", async () => {
    const history = await getProcessingHistory();
    expect(history).toEqual([]);
  });

  it("returns stored history", async () => {
    const history = [
      { url: "https://example.com/a", status: "success" as const, folder: "Inbox" },
      { url: "https://example.com/b", status: "failed" as const, error: "timeout" },
    ];
    localStore["processingHistory"] = history;

    const result = await getProcessingHistory();
    expect(result).toEqual(history);
    expect(result).toHaveLength(2);
  });

  it("clears history", async () => {
    localStore["processingHistory"] = [
      { url: "https://example.com", status: "success" as const },
    ];

    await clearProcessingHistory();
    const history = await getProcessingHistory();
    expect(history).toEqual([]);
  });
});
