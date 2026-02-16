// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Settings } from "@/popup/components/Settings";

const { mockTestConnection, mockTestOpenRouter } = vi.hoisted(() => ({
  mockTestConnection: vi.fn(),
  mockTestOpenRouter: vi.fn(),
}));

// Mock chrome.storage.sync
const mockSyncStore: Record<string, string> = {};

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
        get: vi.fn(() => Promise.resolve({})),
        set: vi.fn(() => Promise.resolve()),
      },
    },
  });
}

setupChromeMock();

vi.mock("@/core/vault-client", () => {
  return {
    VaultClient: class MockVaultClient {
      testConnection = mockTestConnection;
    },
  };
});

vi.mock("@/core/openrouter-provider", () => ({
  testOpenRouterConnection: mockTestOpenRouter,
}));

beforeEach(() => {
  for (const key of Object.keys(mockSyncStore)) {
    delete mockSyncStore[key];
  }

  mockTestConnection.mockReset();
  mockTestConnection.mockResolvedValue(true);
  mockTestOpenRouter.mockReset();
  mockTestOpenRouter.mockResolvedValue(true);

  setupChromeMock();
});

describe("Settings", () => {
  it("renders all form fields", () => {
    render(<Settings />);

    expect(screen.getByLabelText("OpenRouter API Key")).toBeInTheDocument();
    expect(screen.getByLabelText("Obsidian Vault URL")).toBeInTheDocument();
    expect(screen.getByLabelText("Obsidian Vault API Key")).toBeInTheDocument();
    expect(screen.getByLabelText("Default Folder")).toBeInTheDocument();
  });

  it("loads existing config on mount", async () => {
    mockSyncStore["apiKey"] = "sk-or-test";
    mockSyncStore["vaultUrl"] = "https://localhost:9999";
    mockSyncStore["vaultApiKey"] = "vault-key-123";
    mockSyncStore["defaultFolder"] = "Notes";

    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByLabelText("OpenRouter API Key")).toHaveValue(
        "sk-or-test"
      );
    });
    expect(screen.getByLabelText("Obsidian Vault URL")).toHaveValue(
      "https://localhost:9999"
    );
    expect(screen.getByLabelText("Default Folder")).toHaveValue("Notes");
  });

  it("saves config via setSyncStorage on submit", async () => {
    render(<Settings />);

    const apiKeyInput = screen.getByLabelText("OpenRouter API Key");
    fireEvent.change(apiKeyInput, { target: { value: "sk-or-new" } });

    const saveBtn = screen.getByText("Save Settings");
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(chrome.storage.sync.set).toHaveBeenCalledWith({
        apiKey: "sk-or-new",
      });
    });
  });

  it("shows saved confirmation after save", async () => {
    render(<Settings />);

    fireEvent.change(screen.getByLabelText("OpenRouter API Key"), {
      target: { value: "changed" },
    });
    fireEvent.click(screen.getByText("Save Settings"));

    await waitFor(() => {
      expect(screen.getByText("Saved")).toBeInTheDocument();
    });
  });

  it("tests both OpenRouter and Vault on test button click", async () => {
    mockSyncStore["apiKey"] = "sk-or-test";
    mockSyncStore["vaultApiKey"] = "existing-key";
    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByLabelText("Obsidian Vault API Key")).toHaveValue(
        "existing-key"
      );
    });

    fireEvent.click(screen.getByText("Test Connections"));

    await waitFor(() => {
      expect(mockTestOpenRouter).toHaveBeenCalledWith("sk-or-test");
      expect(mockTestConnection).toHaveBeenCalled();
    });
  });

  it("shows separate success statuses for both connections", async () => {
    mockTestOpenRouter.mockResolvedValue(true);
    mockTestConnection.mockResolvedValue(true);
    mockSyncStore["apiKey"] = "sk-or-test";
    mockSyncStore["vaultApiKey"] = "existing-key";
    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByLabelText("Obsidian Vault API Key")).toHaveValue(
        "existing-key"
      );
    });

    fireEvent.click(screen.getByText("Test Connections"));

    await waitFor(() => {
      const connectedElements = screen.getAllByText("Connected");
      expect(connectedElements).toHaveLength(2);
    });
  });

  it("shows individual failure when only vault fails", async () => {
    mockTestOpenRouter.mockResolvedValue(true);
    mockTestConnection.mockResolvedValue(false);
    mockSyncStore["apiKey"] = "sk-or-test";
    mockSyncStore["vaultApiKey"] = "bad-key";
    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByLabelText("Obsidian Vault API Key")).toHaveValue(
        "bad-key"
      );
    });

    fireEvent.click(screen.getByText("Test Connections"));

    await waitFor(() => {
      expect(screen.getByText("OpenRouter API:")).toBeInTheDocument();
      expect(screen.getByText("Obsidian Vault:")).toBeInTheDocument();
      expect(screen.getAllByText("Connected")).toHaveLength(1);
      expect(screen.getAllByText("Connection failed")).toHaveLength(1);
    });
  });

  it("shows 'No API key' when testing without keys configured", async () => {
    render(<Settings />);

    fireEvent.click(screen.getByText("Test Connections"));

    await waitFor(() => {
      const noKeyMessages = screen.getAllByText("No API key");
      expect(noKeyMessages).toHaveLength(2);
    });
  });

  it("disables save button when form is not dirty", () => {
    render(<Settings />);

    const saveBtn = screen.getByText("Save Settings");
    expect(saveBtn).toBeDisabled();
  });

  it("renders vault name field and saves it", async () => {
    render(<Settings />);

    const vaultNameInput = screen.getByLabelText("Vault Name");
    expect(vaultNameInput).toBeInTheDocument();

    fireEvent.change(vaultNameInput, { target: { value: "My Vault" } });
    fireEvent.click(screen.getByText("Save Settings"));

    await waitFor(() => {
      expect(chrome.storage.sync.set).toHaveBeenCalledWith({
        vaultName: "My Vault",
      });
    });
  });

  it("loads existing vault name on mount", async () => {
    mockSyncStore["vaultName"] = "Test Vault";
    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByLabelText("Vault Name")).toHaveValue("Test Vault");
    });
  });
});
