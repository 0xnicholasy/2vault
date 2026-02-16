// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProcessingStatus } from "@/popup/components/ProcessingStatus";
import type { ProcessingState } from "@/background/messages";
import type { ProcessingResult, ProcessedNote, ExtractedContent } from "@/core/types";

vi.stubGlobal("chrome", {
  storage: {
    sync: { get: vi.fn(() => Promise.resolve({})), set: vi.fn(() => Promise.resolve()) },
    local: { get: vi.fn(() => Promise.resolve({})), set: vi.fn(() => Promise.resolve()) },
    onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  runtime: { sendMessage: vi.fn() },
});

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

function makeState(overrides: Partial<ProcessingState> = {}): ProcessingState {
  return {
    active: true,
    urls: ["https://example.com/1", "https://example.com/2"],
    results: [],
    currentIndex: 0,
    currentUrl: "https://example.com/1",
    currentStatus: "extracting",
    startedAt: Date.now(),
    cancelled: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProcessingStatus", () => {
  it("renders progress bar with correct percentage", () => {
    const state = makeState({
      results: [{ url: "https://example.com/1", status: "success", note: makeNote() }],
    });

    render(<ProcessingStatus state={state} vaultName="" onCancel={vi.fn()} />);

    expect(screen.getByText("1 / 2 URLs")).toBeInTheDocument();
    expect(screen.getByText("Processing Bookmarks...")).toBeInTheDocument();
  });

  it("shows 'Processing Complete' when not active", () => {
    const state = makeState({
      active: false,
      results: [
        { url: "https://example.com/1", status: "success", note: makeNote() },
        { url: "https://example.com/2", status: "failed", error: "Timeout" },
      ],
    });

    render(<ProcessingStatus state={state} vaultName="" onCancel={vi.fn()} />);

    expect(screen.getByText("Processing Complete")).toBeInTheDocument();
    expect(screen.getByText(/1 saved, 1 failed/)).toBeInTheDocument();
  });

  it("shows cancel button when active, hides when complete", () => {
    const onCancel = vi.fn();
    const { rerender } = render(
      <ProcessingStatus state={makeState()} vaultName="" onCancel={onCancel} />
    );

    const cancelBtn = screen.getByText("Cancel");
    expect(cancelBtn).toBeInTheDocument();
    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalled();

    rerender(
      <ProcessingStatus state={makeState({ active: false })} vaultName="" onCancel={onCancel} />
    );
    expect(screen.queryByText("Cancel")).not.toBeInTheDocument();
  });

  it("renders status icons for each URL", () => {
    const state = makeState({
      results: [{ url: "https://example.com/1", status: "success", note: makeNote() }],
    });

    render(<ProcessingStatus state={state} vaultName="" onCancel={vi.fn()} />);

    const rows = document.querySelectorAll(".url-status-row");
    expect(rows).toHaveLength(2);
  });

  it("toggles error details for failed URLs", () => {
    const state = makeState({
      active: false,
      results: [
        { url: "https://example.com/1", status: "failed", error: "Network timeout" },
        { url: "https://example.com/2", status: "success", note: makeNote() },
      ],
    });

    render(<ProcessingStatus state={state} vaultName="" onCancel={vi.fn()} />);

    expect(screen.queryByText("Network timeout")).not.toBeInTheDocument();

    const toggleBtn = screen.getByLabelText("Show error details");
    fireEvent.click(toggleBtn);

    expect(screen.getByText("Network timeout")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Hide error details"));
    expect(screen.queryByText("Network timeout")).not.toBeInTheDocument();
  });

  it("shows Obsidian links when vaultName is configured", () => {
    const note = makeNote({ title: "My Article", suggestedFolder: "Articles" });
    const state = makeState({
      active: false,
      results: [
        { url: "https://example.com/1", status: "success", note, folder: "Articles" },
        { url: "https://example.com/2", status: "failed", error: "Error" },
      ],
    });

    render(<ProcessingStatus state={state} vaultName="My Vault" onCancel={vi.fn()} />);

    const obsidianLinks = document.querySelectorAll(".obsidian-link");
    expect(obsidianLinks).toHaveLength(1);
    expect(obsidianLinks[0]).toHaveAttribute(
      "href",
      expect.stringContaining("obsidian://open?vault=My%20Vault")
    );
  });

  it("hides Obsidian links when vaultName is empty", () => {
    const note = makeNote();
    const state = makeState({
      active: false,
      results: [{ url: "https://example.com/1", status: "success", note }],
    });

    render(<ProcessingStatus state={state} vaultName="" onCancel={vi.fn()} />);

    const obsidianLinks = document.querySelectorAll(".obsidian-link");
    expect(obsidianLinks).toHaveLength(0);
  });
});
