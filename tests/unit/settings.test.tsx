// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Settings } from "@/popup/components/Settings";

const { mockTestConnection } = vi.hoisted(() => ({
  mockTestConnection: vi.fn(),
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

beforeEach(() => {
  for (const key of Object.keys(mockSyncStore)) {
    delete mockSyncStore[key];
  }

  mockTestConnection.mockReset();
  mockTestConnection.mockResolvedValue(true);

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

  it("calls VaultClient.testConnection on test button click", async () => {
    mockSyncStore["vaultApiKey"] = "existing-key";
    render(<Settings />);

    // Wait for config to load before interacting
    await waitFor(() => {
      expect(screen.getByLabelText("Obsidian Vault API Key")).toHaveValue(
        "existing-key"
      );
    });

    fireEvent.click(screen.getByText("Test Connection"));

    await waitFor(() => {
      expect(mockTestConnection).toHaveBeenCalled();
    });
  });

  it("shows success status on successful connection test", async () => {
    mockTestConnection.mockResolvedValue(true);
    mockSyncStore["vaultApiKey"] = "existing-key";
    render(<Settings />);

    // Wait for config to load before interacting
    await waitFor(() => {
      expect(screen.getByLabelText("Obsidian Vault API Key")).toHaveValue(
        "existing-key"
      );
    });

    fireEvent.click(screen.getByText("Test Connection"));

    await waitFor(() => {
      expect(screen.getByText("Connected")).toBeInTheDocument();
    });
  });

  it("shows error status on failed connection test", async () => {
    mockTestConnection.mockResolvedValue(false);
    render(<Settings />);

    fireEvent.change(screen.getByLabelText("Obsidian Vault API Key"), {
      target: { value: "bad-key" },
    });
    fireEvent.click(screen.getByText("Test Connection"));

    await waitFor(() => {
      expect(screen.getByText("Connection failed")).toBeInTheDocument();
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
