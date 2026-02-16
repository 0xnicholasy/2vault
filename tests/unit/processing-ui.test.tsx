// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import type { ProcessingState } from "@/background/messages";
import type { ProcessingResult } from "@/core/types";

vi.stubGlobal("chrome", {
  storage: {
    sync: { get: vi.fn(() => Promise.resolve({})), set: vi.fn(() => Promise.resolve()) },
    local: { get: vi.fn(() => Promise.resolve({})), set: vi.fn(() => Promise.resolve()) },
    onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  runtime: { sendMessage: vi.fn() },
});

import {
  formatUrl,
  getUrlStatus,
  buildObsidianUri,
  StatusIcon,
} from "@/popup/utils/processing-ui";

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

describe("formatUrl", () => {
  it("shows hostname + path for a regular URL", () => {
    const result = formatUrl("https://example.com/articles/hello");
    expect(result).toBe("example.com/articles/hello");
  });

  it("truncates long pathnames at 30 chars with ellipsis", () => {
    // Build a URL whose pathname exceeds 30 characters
    const longPath = "/this-is-a-very-long-pathname-that-exceeds-thirty-chars";
    const url = `https://example.com${longPath}`;
    const result = formatUrl(url);

    expect(result).toBe("example.com" + longPath.slice(0, 30) + "...");
    expect(result).toContain("...");
  });

  it("shows full hostname + pathname for short URLs", () => {
    const result = formatUrl("https://example.com/short");
    expect(result).toBe("example.com/short");
    expect(result).not.toContain("...");
  });

  it("falls back to raw string for invalid URLs, truncated at 40 chars", () => {
    const longInvalid = "not-a-url-but-it-is-definitely-longer-than-forty-characters-total";
    const result = formatUrl(longInvalid);
    expect(result).toBe(longInvalid.slice(0, 40) + "...");
  });

  it("returns short invalid URL as-is without truncation", () => {
    const result = formatUrl("not-a-url");
    expect(result).toBe("not-a-url");
  });

  it("shows root path correctly", () => {
    const result = formatUrl("https://example.com/");
    expect(result).toBe("example.com/");
  });
});

describe("getUrlStatus", () => {
  it('returns "done" when results contain a success entry for the URL', () => {
    const results: ProcessingResult[] = [
      { url: "https://example.com/1", status: "success" },
    ];
    const state = makeState({ results });

    const status = getUrlStatus("https://example.com/1", 0, state);
    expect(status).toBe("done");
  });

  it('returns "failed" when results contain a failed entry for the URL', () => {
    const results: ProcessingResult[] = [
      { url: "https://example.com/1", status: "failed", error: "Timeout" },
    ];
    const state = makeState({ results });

    const status = getUrlStatus("https://example.com/1", 0, state);
    expect(status).toBe("failed");
  });

  it("returns currentStatus when URL is at currentIndex and state is active", () => {
    const state = makeState({
      currentIndex: 1,
      currentStatus: "processing",
      active: true,
    });

    const status = getUrlStatus("https://example.com/2", 1, state);
    expect(status).toBe("processing");
  });

  it('returns "queued" for an unprocessed URL that is not the current index', () => {
    const state = makeState({
      currentIndex: 0,
      active: true,
    });

    const status = getUrlStatus("https://example.com/2", 1, state);
    expect(status).toBe("queued");
  });

  it('returns "queued" when URL is at currentIndex but state is not active', () => {
    const state = makeState({
      currentIndex: 1,
      active: false,
    });

    const status = getUrlStatus("https://example.com/2", 1, state);
    expect(status).toBe("queued");
  });

  it("prioritizes result lookup over currentIndex match", () => {
    const results: ProcessingResult[] = [
      { url: "https://example.com/1", status: "success" },
    ];
    const state = makeState({
      results,
      currentIndex: 0,
      currentStatus: "creating",
      active: true,
    });

    // Even though index matches and state is active, the result takes priority
    const status = getUrlStatus("https://example.com/1", 0, state);
    expect(status).toBe("done");
  });
});

describe("buildObsidianUri", () => {
  it("encodes vault name with spaces", () => {
    const uri = buildObsidianUri("My Vault", "Articles", "Test Title");
    expect(uri).toContain("vault=My%20Vault");
  });

  it("generates correct file path from folder and title", () => {
    const uri = buildObsidianUri("vault", "Articles", "How to Code");
    // generateFilename("How to Code") -> "how-to-code.md"
    // filePath = "Articles/how-to-code.md" -> strip .md -> "Articles/how-to-code"
    expect(uri).toContain("file=" + encodeURIComponent("Articles/how-to-code"));
  });

  it("strips .md extension from the file path", () => {
    const uri = buildObsidianUri("vault", "Notes", "Some Title");
    // The path should not end with .md
    const fileParam = decodeURIComponent(uri.split("file=")[1]);
    expect(fileParam).not.toMatch(/\.md$/);
  });

  it("returns a well-formed obsidian:// URI", () => {
    const uri = buildObsidianUri("TestVault", "Inbox", "Hello World");
    expect(uri).toMatch(/^obsidian:\/\/open\?vault=.+&file=.+$/);
  });

  it("handles special characters in title via generateFilename", () => {
    const uri = buildObsidianUri("vault", "Inbox", "What's New? A Guide!");
    // generateFilename strips special chars -> "what-s-new-a-guide"
    const fileParam = decodeURIComponent(uri.split("file=")[1]);
    expect(fileParam).toBe("Inbox/what-s-new-a-guide");
  });
});

describe("StatusIcon", () => {
  it('renders done icon with correct class for status "done"', () => {
    const { container } = render(<StatusIcon status="done" />);
    const icon = container.querySelector(".status-icon-done");
    expect(icon).not.toBeNull();
    expect(icon?.classList.contains("status-icon")).toBe(true);
  });

  it('renders failed icon with correct class for status "failed"', () => {
    const { container } = render(<StatusIcon status="failed" />);
    const icon = container.querySelector(".status-icon-failed");
    expect(icon).not.toBeNull();
    expect(icon?.classList.contains("status-icon")).toBe(true);
  });

  it('renders queued icon with correct class for status "queued"', () => {
    const { container } = render(<StatusIcon status="queued" />);
    const icon = container.querySelector(".status-icon-queued");
    expect(icon).not.toBeNull();
    expect(icon?.classList.contains("status-icon")).toBe(true);
  });

  it('renders active icon for status "extracting"', () => {
    const { container } = render(<StatusIcon status="extracting" />);
    const icon = container.querySelector(".status-icon-active");
    expect(icon).not.toBeNull();
    expect(icon?.classList.contains("status-icon")).toBe(true);
  });

  it('renders active icon for status "processing"', () => {
    const { container } = render(<StatusIcon status="processing" />);
    const icon = container.querySelector(".status-icon-active");
    expect(icon).not.toBeNull();
    expect(icon?.classList.contains("status-icon")).toBe(true);
  });

  it('renders active icon for status "creating"', () => {
    const { container } = render(<StatusIcon status="creating" />);
    const icon = container.querySelector(".status-icon-active");
    expect(icon).not.toBeNull();
    expect(icon?.classList.contains("status-icon")).toBe(true);
  });
});
