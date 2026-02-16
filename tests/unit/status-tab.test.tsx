// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { StatusTab } from "@/popup/components/StatusTab";
import type { ProcessingState } from "@/background/messages";
import type { ProcessingResult, ProcessedNote, ExtractedContent } from "@/core/types";

const mockSyncStore: Record<string, string> = {};
const mockLocalStore: Record<string, ProcessingResult[]> = {};

function setupChromeMock() {
  vi.stubGlobal("chrome", {
    storage: {
      sync: {
        get: vi.fn((key: string) =>
          Promise.resolve({ [key]: mockSyncStore[key] })
        ),
        set: vi.fn((obj: Record<string, string>) => {
          Object.assign(mockSyncStore, obj);
          return Promise.resolve();
        }),
      },
      local: {
        get: vi.fn((key: string) =>
          Promise.resolve({ [key]: mockLocalStore[key] })
        ),
        set: vi.fn(() => Promise.resolve()),
        remove: vi.fn(() => Promise.resolve()),
      },
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
    runtime: {
      sendMessage: vi.fn(),
    },
  });
}

setupChromeMock();

vi.mock("@/core/vault-client", () => ({
  VaultClient: vi.fn().mockImplementation(() => ({
    testConnection: vi.fn().mockResolvedValue(true),
  })),
}));

function makeNote(overrides: Partial<ProcessedNote> = {}): ProcessedNote {
  const source: ExtractedContent = {
    url: "https://example.com/article",
    title: "Test Article",
    content: "Some content",
    author: null,
    datePublished: null,
    wordCount: 100,
    type: "article",
    platform: "web",
    status: "success",
  };
  return {
    title: "Test Note",
    summary: "Summary",
    keyTakeaways: ["Point 1"],
    suggestedFolder: "Articles",
    suggestedTags: ["test"],
    type: "article",
    platform: "web",
    source,
    ...overrides,
  };
}

beforeEach(() => {
  for (const key of Object.keys(mockSyncStore)) delete mockSyncStore[key];
  for (const key of Object.keys(mockLocalStore)) delete mockLocalStore[key];

  // Default: valid config
  mockSyncStore["apiKey"] = "sk-test";
  mockSyncStore["vaultApiKey"] = "vault-test";
  mockSyncStore["vaultUrl"] = "https://localhost:27124";
  mockSyncStore["defaultFolder"] = "Inbox";
  mockSyncStore["vaultName"] = "";

  setupChromeMock();
});

describe("StatusTab", () => {
  it("shows config guard when API keys are missing", async () => {
    mockSyncStore["apiKey"] = "";
    mockSyncStore["vaultApiKey"] = "";

    const onSwitchTab = vi.fn();
    render(
      <StatusTab
        processingState={null}
        onProcess={vi.fn()}
        onSwitchTab={onSwitchTab}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Configure your API keys/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Go to Settings"));
    expect(onSwitchTab).toHaveBeenCalledWith("settings");
  });

  it("shows empty history state when no results exist", async () => {
    render(
      <StatusTab
        processingState={null}
        onProcess={vi.fn()}
        onSwitchTab={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("No processing history yet")).toBeInTheDocument();
    });
  });

  it("shows processing status when actively processing", async () => {
    const state: ProcessingState = {
      active: true,
      urls: ["https://example.com/1"],
      results: [],
      currentIndex: 0,
      currentUrl: "https://example.com/1",
      currentStatus: "extracting",
      startedAt: Date.now(),
      cancelled: false,
    };

    render(
      <StatusTab
        processingState={state}
        onProcess={vi.fn()}
        onSwitchTab={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Processing Bookmarks...")).toBeInTheDocument();
    });
  });

  it("shows results from processing history", async () => {
    const history: ProcessingResult[] = [
      { url: "https://example.com/1", status: "success", note: makeNote(), folder: "Articles" },
    ];
    mockLocalStore["processingHistory"] = history;

    render(
      <StatusTab
        processingState={null}
        onProcess={vi.fn()}
        onSwitchTab={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Results (1)")).toBeInTheDocument();
    });
  });

  it("switches to bookmarks tab when Process More is clicked", async () => {
    const history: ProcessingResult[] = [
      { url: "https://example.com/1", status: "success", note: makeNote(), folder: "Articles" },
    ];
    mockLocalStore["processingHistory"] = history;

    const onSwitchTab = vi.fn();
    render(
      <StatusTab
        processingState={null}
        onProcess={vi.fn()}
        onSwitchTab={onSwitchTab}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Process More")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Process More"));
    expect(onSwitchTab).toHaveBeenCalledWith("bookmarks");
  });

  it("clears history when Clear History is clicked", async () => {
    const history: ProcessingResult[] = [
      { url: "https://example.com/1", status: "success", note: makeNote(), folder: "Articles" },
    ];
    mockLocalStore["processingHistory"] = history;

    render(
      <StatusTab
        processingState={null}
        onProcess={vi.fn()}
        onSwitchTab={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Clear History")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Clear History"));

    await waitFor(() => {
      expect(chrome.storage.local.remove).toHaveBeenCalledWith("processingHistory");
    });
  });
});
