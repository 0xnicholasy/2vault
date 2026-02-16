// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ResultsSummary } from "@/popup/components/ResultsSummary";
import type {
  ProcessingResult,
  ProcessedNote,
  ExtractedContent,
} from "@/core/types";

vi.stubGlobal("chrome", {
  storage: {
    sync: {
      get: vi.fn(() => Promise.resolve({})),
      set: vi.fn(() => Promise.resolve()),
    },
    local: {
      get: vi.fn(() => Promise.resolve({})),
      set: vi.fn(() => Promise.resolve()),
    },
  },
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

const defaultProps = {
  vaultName: "",
  onRetry: vi.fn(),
  onProcessMore: vi.fn(),
  onClearHistory: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ResultsSummary", () => {
  it("shows empty state when no results", () => {
    render(<ResultsSummary {...defaultProps} results={[]} />);
    expect(screen.getByText("No processing history yet")).toBeInTheDocument();
  });

  it("renders results table with URL, folder, and status", () => {
    const results: ProcessingResult[] = [
      {
        url: "https://example.com/page",
        status: "success",
        note: makeNote(),
        folder: "Articles",
      },
    ];

    render(<ResultsSummary {...defaultProps} results={results} />);

    expect(screen.getByText("Results (1)")).toBeInTheDocument();
    expect(screen.getByText("Articles")).toBeInTheDocument();
    expect(screen.getByText("success")).toBeInTheDocument();
  });

  it("filters to failures only when toggled", () => {
    const results: ProcessingResult[] = [
      {
        url: "https://example.com/1",
        status: "success",
        note: makeNote(),
        folder: "Articles",
      },
      {
        url: "https://example.com/2",
        status: "failed",
        error: "Timeout",
        errorCategory: "network",
      },
    ];

    render(<ResultsSummary {...defaultProps} results={results} />);

    const rows = document.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(2);

    fireEvent.click(screen.getByText("Failures (1)"));

    const filteredRows = document.querySelectorAll("tbody tr");
    expect(filteredRows).toHaveLength(1);
  });

  it("shows Retry Failed button when there are mixed results", () => {
    const results: ProcessingResult[] = [
      {
        url: "https://example.com/1",
        status: "success",
        note: makeNote(),
        folder: "Articles",
      },
      {
        url: "https://example.com/2",
        status: "failed",
        error: "Timeout",
        errorCategory: "network",
      },
    ];

    const onRetry = vi.fn();
    render(
      <ResultsSummary {...defaultProps} results={results} onRetry={onRetry} />
    );

    const retryBtn = screen.getByText("Retry Failed");
    fireEvent.click(retryBtn);

    expect(onRetry).toHaveBeenCalledWith(["https://example.com/2"]);
  });

  it("shows all-failed banner when every URL failed", () => {
    const results: ProcessingResult[] = [
      {
        url: "https://example.com/1",
        status: "failed",
        error: "Error 1",
        errorCategory: "llm",
      },
      {
        url: "https://example.com/2",
        status: "failed",
        error: "Error 2",
        errorCategory: "vault",
      },
    ];

    const onRetry = vi.fn();
    render(
      <ResultsSummary {...defaultProps} results={results} onRetry={onRetry} />
    );

    expect(
      screen.getByText("All URLs failed to process")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Check your OpenRouter API key/)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("Retry All"));
    expect(onRetry).toHaveBeenCalledWith([
      "https://example.com/1",
      "https://example.com/2",
    ]);
  });

  it("calls onProcessMore when clicking Process More", () => {
    const results: ProcessingResult[] = [
      {
        url: "https://example.com/1",
        status: "success",
        note: makeNote(),
        folder: "Articles",
      },
    ];

    const onProcessMore = vi.fn();
    render(
      <ResultsSummary
        {...defaultProps}
        results={results}
        onProcessMore={onProcessMore}
      />
    );

    fireEvent.click(screen.getByText("Process More"));
    expect(onProcessMore).toHaveBeenCalled();
  });

  it("calls onClearHistory when clicking Clear History", () => {
    const results: ProcessingResult[] = [
      {
        url: "https://example.com/1",
        status: "success",
        note: makeNote(),
        folder: "Articles",
      },
    ];

    const onClearHistory = vi.fn();
    render(
      <ResultsSummary
        {...defaultProps}
        results={results}
        onClearHistory={onClearHistory}
      />
    );

    fireEvent.click(screen.getByText("Clear History"));
    expect(onClearHistory).toHaveBeenCalled();
  });

  it("shows Obsidian links when vaultName is configured", () => {
    const results: ProcessingResult[] = [
      {
        url: "https://example.com/1",
        status: "success",
        note: makeNote({ title: "My Article" }),
        folder: "Articles",
      },
    ];

    render(
      <ResultsSummary
        {...defaultProps}
        results={results}
        vaultName="My Vault"
      />
    );

    const obsidianLinks = document.querySelectorAll(".obsidian-link");
    expect(obsidianLinks).toHaveLength(1);
    expect(obsidianLinks[0]).toHaveAttribute(
      "href",
      expect.stringContaining("obsidian://open?vault=My%20Vault")
    );
  });

  it("hides Obsidian link column when vaultName is empty", () => {
    const results: ProcessingResult[] = [
      {
        url: "https://example.com/1",
        status: "success",
        note: makeNote(),
        folder: "Articles",
      },
    ];

    render(<ResultsSummary {...defaultProps} results={results} vaultName="" />);

    const headerCells = document.querySelectorAll("th");
    expect(headerCells).toHaveLength(3); // URL, Folder, Status - no link column
  });

  // -- Error category tests --

  it("shows error category badge for failed results", () => {
    const results: ProcessingResult[] = [
      {
        url: "https://example.com/1",
        status: "failed",
        error: "Connection refused",
        errorCategory: "vault",
      },
    ];

    render(<ResultsSummary {...defaultProps} results={results} />);

    expect(screen.getByText("vault")).toBeInTheDocument();
    const badge = screen.getByText("vault");
    expect(badge.className).toContain("status-badge-vault");
  });

  it("expands error details on click", () => {
    const results: ProcessingResult[] = [
      {
        url: "https://example.com/0",
        status: "success",
        note: makeNote(),
        folder: "Articles",
      },
      {
        url: "https://example.com/1",
        status: "failed",
        error: "API rate limit exceeded",
        errorCategory: "llm",
      },
    ];

    render(<ResultsSummary {...defaultProps} results={results} />);

    // Error details should not be visible initially
    expect(
      screen.queryByText("API rate limit exceeded")
    ).not.toBeInTheDocument();

    // Click the row to expand
    const row = document.querySelector(".error-row-expandable")!;
    fireEvent.click(row);

    // Error message and suggestion should now be visible
    expect(screen.getByText("API rate limit exceeded")).toBeInTheDocument();
    expect(
      screen.getByText(/Check your OpenRouter API key/)
    ).toBeInTheDocument();
  });

  it("shows error suggestion for each category", () => {
    const results: ProcessingResult[] = [
      {
        url: "https://example.com/0",
        status: "success",
        note: makeNote(),
        folder: "Articles",
      },
      {
        url: "https://example.com/1",
        status: "failed",
        error: "fetch failed",
        errorCategory: "network",
      },
    ];

    render(<ResultsSummary {...defaultProps} results={results} />);

    // Expand
    const row = document.querySelector(".error-row-expandable")!;
    fireEvent.click(row);

    expect(
      screen.getByText(/Check your internet connection/)
    ).toBeInTheDocument();
  });

  it("copy URL button calls clipboard API", () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: mockWriteText },
    });

    const results: ProcessingResult[] = [
      {
        url: "https://example.com/copy-me",
        status: "failed",
        error: "Some error",
        errorCategory: "extraction",
      },
    ];

    render(<ResultsSummary {...defaultProps} results={results} />);

    // Expand the row first
    const row = document.querySelector(".error-row-expandable")!;
    fireEvent.click(row);

    // Click copy button
    fireEvent.click(screen.getByText("Copy URL"));

    expect(mockWriteText).toHaveBeenCalledWith(
      "https://example.com/copy-me"
    );
  });

  it("defaults to unknown category when errorCategory is missing", () => {
    const results: ProcessingResult[] = [
      {
        url: "https://example.com/1",
        status: "failed",
        error: "Something went wrong",
      },
    ];

    render(<ResultsSummary {...defaultProps} results={results} />);

    expect(screen.getByText("unknown")).toBeInTheDocument();
  });
});
