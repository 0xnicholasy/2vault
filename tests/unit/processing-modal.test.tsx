// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ProcessingState } from "@/background/messages.ts";
import type { ProcessingResult } from "@/core/types.ts";

const mockGetProcessingState = vi.fn();

vi.mock("@/utils/storage", () => ({
  getProcessingState: (...args: unknown[]) => mockGetProcessingState(...args),
}));

function setupChromeMock() {
  vi.stubGlobal("chrome", {
    storage: {
      sync: { get: vi.fn(() => Promise.resolve({})), set: vi.fn(() => Promise.resolve()) },
      local: { get: vi.fn(() => Promise.resolve({})), set: vi.fn(() => Promise.resolve()) },
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    runtime: { sendMessage: vi.fn() },
  });
}

setupChromeMock();

const { ProcessingModal } = await import(
  "@/popup/components/ProcessingModal"
);

function makeState(overrides: Partial<ProcessingState> = {}): ProcessingState {
  return {
    active: true,
    urls: ["https://example.com/1", "https://example.com/2"],
    results: [],
    urlStatuses: {
      "https://example.com/1": "extracting",
      "https://example.com/2": "queued",
    },
    startedAt: Date.now(),
    cancelled: false,
    ...overrides,
  };
}

function makeResult(
  url: string,
  status: "success" | "failed",
  extra: Partial<ProcessingResult> = {}
): ProcessingResult {
  return { url, status, ...extra };
}

beforeEach(() => {
  vi.clearAllMocks();
  setupChromeMock();
  mockGetProcessingState.mockResolvedValue(null);
});

afterEach(() => {
  cleanup();
});

describe("ProcessingModal", () => {
  it("renders progress bar during active processing", () => {
    const state = makeState({
      urls: ["https://example.com/1", "https://example.com/2", "https://example.com/3"],
      results: [makeResult("https://example.com/1", "success")],
      urlStatuses: {
        "https://example.com/1": "done",
        "https://example.com/2": "extracting",
        "https://example.com/3": "queued",
      },
    });

    render(<ProcessingModal initialState={state} onClose={vi.fn()} />);

    // Progress bar fill should be at 33% (1 of 3)
    const progressFill = document.querySelector(".progress-fill") as HTMLElement;
    expect(progressFill).toBeInTheDocument();
    expect(progressFill.style.width).toBe("33%");

    // Progress text shows completed / total
    expect(screen.getByText(/1 \/ 3 URLs/)).toBeInTheDocument();

    // Header shows active processing title
    expect(screen.getByText("Processing Bookmarks")).toBeInTheDocument();
  });

  it('shows "Processing Complete" when not active', () => {
    const state = makeState({
      active: false,
      results: [
        makeResult("https://example.com/1", "success"),
        makeResult("https://example.com/2", "success"),
      ],
    });

    render(<ProcessingModal initialState={state} onClose={vi.fn()} />);

    expect(screen.getByText("Processing Complete")).toBeInTheDocument();
  });

  it("shows Cancel button when active, Close button when done", () => {
    const activeState = makeState({ active: true });
    const { unmount } = render(
      <ProcessingModal initialState={activeState} onClose={vi.fn()} />
    );

    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();

    unmount();

    const doneState = makeState({ active: false });
    render(<ProcessingModal initialState={doneState} onClose={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });

  it("Cancel button calls chrome.runtime.sendMessage", async () => {
    const user = userEvent.setup();
    const state = makeState({ active: true });

    render(<ProcessingModal initialState={state} onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: "CANCEL_PROCESSING",
    });
  });

  it("Close button calls onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const state = makeState({ active: false });

    render(<ProcessingModal initialState={state} onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders URL list with status icons", () => {
    const state = makeState({
      urls: ["https://example.com/1", "https://example.com/2", "https://example.com/3"],
      results: [
        makeResult("https://example.com/1", "success"),
        makeResult("https://example.com/2", "failed"),
      ],
      urlStatuses: {
        "https://example.com/1": "done",
        "https://example.com/2": "failed",
        "https://example.com/3": "extracting",
      },
      active: true,
    });

    render(<ProcessingModal initialState={state} onClose={vi.fn()} />);

    const rows = document.querySelectorAll(".url-status-row");
    expect(rows).toHaveLength(3);

    // First URL is done (success result)
    expect(rows[0]).toHaveClass("url-status-done");
    // Second URL is failed
    expect(rows[1]).toHaveClass("url-status-failed");
    // Third URL is the current one being extracted
    expect(rows[2]).toHaveClass("url-status-extracting");

    // Each row has a status icon
    rows.forEach((row) => {
      expect(row.querySelector(".status-icon")).toBeInTheDocument();
    });

    // Each row has a human-readable status label
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("Reading")).toBeInTheDocument();
  });

  it("shows batch error banner when state.error is set", () => {
    const state = makeState({
      active: false,
      error: "API rate limit exceeded",
    });

    render(<ProcessingModal initialState={state} onClose={vi.fn()} />);

    const banner = screen.getByRole("alert");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent("Processing failed: API rate limit exceeded");
  });

  it("shows summary (saved/failed counts) when complete", () => {
    const state = makeState({
      active: false,
      urls: [
        "https://example.com/1",
        "https://example.com/2",
        "https://example.com/3",
      ],
      results: [
        makeResult("https://example.com/1", "success"),
        makeResult("https://example.com/2", "success"),
        makeResult("https://example.com/3", "failed", { error: "timeout" }),
      ],
      urlStatuses: {
        "https://example.com/1": "done",
        "https://example.com/2": "done",
        "https://example.com/3": "failed",
      },
    });

    render(<ProcessingModal initialState={state} onClose={vi.fn()} />);

    // Progress text should show 3 / 3 URLs
    expect(screen.getByText(/3 \/ 3 URLs/)).toBeInTheDocument();

    // Summary should show 2 saved, 1 failed
    expect(screen.getByText(/2 saved, 1 failed/)).toBeInTheDocument();
  });

  it("subscribes to chrome.storage.onChanged on mount", () => {
    const state = makeState();

    render(<ProcessingModal initialState={state} onClose={vi.fn()} />);

    expect(chrome.storage.onChanged.addListener).toHaveBeenCalledTimes(1);
    expect(chrome.storage.onChanged.addListener).toHaveBeenCalledWith(
      expect.any(Function)
    );
  });

  it("cleans up storage listener on unmount", () => {
    const state = makeState();

    const { unmount } = render(
      <ProcessingModal initialState={state} onClose={vi.fn()} />
    );

    const addedListener = vi.mocked(chrome.storage.onChanged.addListener).mock
      .calls[0][0];

    unmount();

    expect(chrome.storage.onChanged.removeListener).toHaveBeenCalledTimes(1);
    expect(chrome.storage.onChanged.removeListener).toHaveBeenCalledWith(
      addedListener
    );
  });
});
