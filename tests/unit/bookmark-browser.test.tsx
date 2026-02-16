// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockGetConfig = vi.fn();

vi.mock("@/utils/storage", () => ({
  getConfig: (...args: unknown[]) => mockGetConfig(...args),
}));

const mockBookmarkTree: chrome.bookmarks.BookmarkTreeNode[] = [
  {
    id: "0",
    title: "",
    children: [
      {
        id: "1",
        title: "Bookmarks Bar",
        children: [
          {
            id: "10",
            title: "Example Page",
            url: "https://example.com/page1",
          },
          {
            id: "11",
            title: "Another Page",
            url: "https://example.com/page2",
          },
          {
            id: "12",
            title: "Dev Resources",
            children: [
              {
                id: "20",
                title: "TypeScript Docs",
                url: "https://typescriptlang.org",
              },
            ],
          },
        ],
      },
      {
        id: "2",
        title: "Other Bookmarks",
        children: [],
      },
    ],
  },
];

function setupChromeMock(tree = mockBookmarkTree) {
  vi.stubGlobal("chrome", {
    bookmarks: {
      getTree: vi.fn(() => Promise.resolve(tree)),
    },
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
    runtime: {
      sendMessage: vi.fn(),
    },
  });
}

setupChromeMock();

const { BookmarkBrowser } = await import(
  "@/popup/components/BookmarkBrowser"
);

beforeEach(() => {
  vi.clearAllMocks();
  setupChromeMock();
  mockGetConfig.mockResolvedValue({
    apiKey: "sk-test",
    llmProvider: "openrouter",
    vaultUrl: "https://localhost:27124",
    vaultApiKey: "vault-key",
    defaultFolder: "Inbox",
  });
});

describe("BookmarkBrowser", () => {
  it("renders folder tree from bookmark data", async () => {
    const onProcess = vi.fn();
    render(<BookmarkBrowser onProcess={onProcess} processing={false} />);

    await waitFor(() => {
      expect(screen.getByText("Bookmarks Bar")).toBeInTheDocument();
    });
  });

  it("shows URL count per folder", async () => {
    const onProcess = vi.fn();
    render(<BookmarkBrowser onProcess={onProcess} processing={false} />);

    await waitFor(() => {
      // Bookmarks Bar has 2 direct + 1 nested = 3 URLs
      expect(screen.getByText("3")).toBeInTheDocument();
    });
  });

  it("hides empty folders", async () => {
    const onProcess = vi.fn();
    render(<BookmarkBrowser onProcess={onProcess} processing={false} />);

    await waitFor(() => {
      expect(screen.getByText("Bookmarks Bar")).toBeInTheDocument();
    });

    // "Other Bookmarks" has 0 URLs, should not be rendered
    expect(screen.queryByText("Other Bookmarks")).not.toBeInTheDocument();
  });

  it("expands folder on click to show URLs", async () => {
    const onProcess = vi.fn();
    render(<BookmarkBrowser onProcess={onProcess} processing={false} />);

    await waitFor(() => {
      expect(screen.getByText("Bookmarks Bar")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Bookmarks Bar"));

    await waitFor(() => {
      expect(screen.getByText("Example Page")).toBeInTheDocument();
      expect(screen.getByText("Another Page")).toBeInTheDocument();
    });
  });

  it("collapses folder on second click", async () => {
    const onProcess = vi.fn();
    render(<BookmarkBrowser onProcess={onProcess} processing={false} />);

    await waitFor(() => {
      expect(screen.getByText("Bookmarks Bar")).toBeInTheDocument();
    });

    // Expand
    fireEvent.click(screen.getByText("Bookmarks Bar"));
    await waitFor(() => {
      expect(screen.getByText("Example Page")).toBeInTheDocument();
    });

    // Collapse
    fireEvent.click(screen.getByText("Bookmarks Bar"));
    await waitFor(() => {
      expect(screen.queryByText("Example Page")).not.toBeInTheDocument();
    });
  });

  it("selects and deselects individual URLs", async () => {
    const onProcess = vi.fn();
    render(<BookmarkBrowser onProcess={onProcess} processing={false} />);

    await waitFor(() => {
      expect(screen.getByText("Bookmarks Bar")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Bookmarks Bar"));

    await waitFor(() => {
      expect(screen.getByText("Example Page")).toBeInTheDocument();
    });

    const checkbox = screen.getAllByRole("checkbox")[0]!;
    fireEvent.click(checkbox);

    // Should show Process Selected button
    await waitFor(() => {
      expect(screen.getByText(/Process Selected/)).toBeInTheDocument();
    });

    // Deselect
    fireEvent.click(checkbox);
    await waitFor(() => {
      expect(screen.queryByText(/Process Selected/)).not.toBeInTheDocument();
    });
  });

  it("Process folder button calls handler with correct URLs", async () => {
    const onProcess = vi.fn();
    render(<BookmarkBrowser onProcess={onProcess} processing={false} />);

    await waitFor(() => {
      expect(screen.getByText("Bookmarks Bar")).toBeInTheDocument();
    });

    // Click the "Process" button next to Bookmarks Bar
    const processButtons = screen.getAllByText("Process");
    fireEvent.click(processButtons[0]!);

    expect(onProcess).toHaveBeenCalledWith([
      "https://example.com/page1",
      "https://example.com/page2",
      "https://typescriptlang.org",
    ]);
  });

  it("shows config guard when API keys are missing", async () => {
    mockGetConfig.mockResolvedValue({
      apiKey: "",
      llmProvider: "openrouter",
      vaultUrl: "https://localhost:27124",
      vaultApiKey: "",
      defaultFolder: "Inbox",
    });

    const onProcess = vi.fn();
    render(<BookmarkBrowser onProcess={onProcess} processing={false} />);

    await waitFor(() => {
      expect(
        screen.getByText(/Configure your API keys/)
      ).toBeInTheDocument();
    });
  });

  it("renders empty state when no bookmarks", async () => {
    setupChromeMock([
      {
        id: "0",
        title: "",
        children: [],
      },
    ]);

    const onProcess = vi.fn();
    render(<BookmarkBrowser onProcess={onProcess} processing={false} />);

    await waitFor(() => {
      expect(
        screen.getByText("No bookmark folders found")
      ).toBeInTheDocument();
    });
  });

  it("disables Process buttons when processing is active", async () => {
    const onProcess = vi.fn();
    render(<BookmarkBrowser onProcess={onProcess} processing={true} />);

    await waitFor(() => {
      expect(screen.getByText("Bookmarks Bar")).toBeInTheDocument();
    });

    const processButton = screen.getAllByText("Process")[0]!;
    expect(processButton).toBeDisabled();
  });
});
