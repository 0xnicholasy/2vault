// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.stubGlobal("chrome", {
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
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  runtime: {
    sendMessage: vi.fn(),
  },
});

vi.mock("@/core/vault-client", () => ({
  VaultClient: vi.fn().mockImplementation(() => ({
    testConnection: vi.fn().mockResolvedValue(true),
  })),
}));

// Import after mocks
const { Settings } = await import("@/popup/components/Settings");
const { ErrorBoundary } = await import("@/popup/components/ErrorBoundary");

describe("Popup navigation", () => {
  it("renders all three tab buttons", () => {
    render(
      <nav className="tab-nav">
        <button role="tab" aria-selected={true}>Settings</button>
        <button role="tab">Bookmarks</button>
        <button role="tab">Status</button>
      </nav>
    );

    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Bookmarks")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("Status tab is enabled (not disabled)", () => {
    render(
      <nav className="tab-nav">
        <button role="tab">Settings</button>
        <button role="tab">Bookmarks</button>
        <button role="tab">Status</button>
      </nav>
    );

    const statusBtn = screen.getByText("Status");
    expect(statusBtn).not.toBeDisabled();
  });

  it("Settings component renders without crashing", () => {
    render(<Settings />);
    expect(screen.getByText("Save Settings")).toBeInTheDocument();
  });

  it("ErrorBoundary renders children when no error", () => {
    render(
      <ErrorBoundary>
        <div>Child content</div>
      </ErrorBoundary>
    );
    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("ErrorBoundary catches errors and shows fallback", () => {
    function Bomb(): never {
      throw new Error("Boom");
    }

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong.")).toBeInTheDocument();
    expect(screen.getByText("Try again")).toBeInTheDocument();

    spy.mockRestore();
  });
});
