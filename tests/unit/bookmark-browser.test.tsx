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
    vaultName: "TestVault",
    vaultOrganization: "para" as const,
    tagGroups: [],
    summaryDetailLevel: "standard" as const,
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
      vaultName: "TestVault",
    vaultOrganization: "para" as const,
    tagGroups: [],
    summaryDetailLevel: "standard" as const,
    });

    const onProcess = vi.fn();
    render(<BookmarkBrowser onProcess={onProcess} processing={false} />);

    await waitFor(() => {
      expect(
        screen.getByText(/Configure your API keys/)
      ).toBeInTheDocument();
    });
  });

  it("renders empty state without bookmark tree when no bookmarks", async () => {
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
      // Direct URL input should still render
      expect(screen.getByLabelText(/Paste URLs/)).toBeInTheDocument();
    });

    // Bookmark divider and tree should not render
    expect(screen.queryByText("or browse bookmarks")).not.toBeInTheDocument();
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

  // -- Direct URL input tests --

  it("renders URL textarea", async () => {
    const onProcess = vi.fn();
    render(<BookmarkBrowser onProcess={onProcess} processing={false} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Paste URLs/)).toBeInTheDocument();
    });
  });

  it("shows valid URL count after entering URLs", async () => {
    const onProcess = vi.fn();
    render(<BookmarkBrowser onProcess={onProcess} processing={false} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Paste URLs/)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Paste URLs/), {
      target: { value: "https://example.com/a\nhttps://example.com/b" },
    });

    expect(screen.getByText("2 valid URLs")).toBeInTheDocument();
  });

  it("shows 0 count for invalid URLs and disables button", async () => {
    const onProcess = vi.fn();
    render(<BookmarkBrowser onProcess={onProcess} processing={false} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Paste URLs/)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Paste URLs/), {
      target: { value: "not-a-url\nalso-invalid" },
    });

    expect(screen.getByText("0 valid URLs")).toBeInTheDocument();
    expect(screen.getByText("Process URLs")).toBeDisabled();
  });

  it("clicking Process URLs calls onProcess with parsed URLs", async () => {
    const onProcess = vi.fn();
    render(<BookmarkBrowser onProcess={onProcess} processing={false} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Paste URLs/)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Paste URLs/), {
      target: { value: "https://example.com/a\nhttps://example.com/b" },
    });

    fireEvent.click(screen.getByText("Process URLs"));

    expect(onProcess).toHaveBeenCalledWith([
      "https://example.com/a",
      "https://example.com/b",
    ]);
  });

  it("deduplicates URLs in direct input", async () => {
    const onProcess = vi.fn();
    render(<BookmarkBrowser onProcess={onProcess} processing={false} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Paste URLs/)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Paste URLs/), {
      target: {
        value:
          "https://example.com/a\nhttps://example.com/a\nhttps://example.com/b",
      },
    });

    // Only 2 unique URLs
    expect(screen.getByText("2 valid URLs")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Process URLs"));
    expect(onProcess).toHaveBeenCalledWith([
      "https://example.com/a",
      "https://example.com/b",
    ]);
  });
});
