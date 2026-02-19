// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OnboardingApp } from "@/onboarding/OnboardingApp";

// Hoisted mocks
const { mockTestConnection, mockTestOpenRouter, mockFetch } = vi.hoisted(() => {
  const mockTestConnection = vi.fn();
  const mockTestOpenRouter = vi.fn();
  const mockFetch = vi.fn();

  return { mockTestConnection, mockTestOpenRouter, mockFetch };
});

vi.mock("@/core/vault-client", () => ({
  VaultClient: class MockVaultClient {
    testConnection = mockTestConnection;
  },
}));

// Mock OpenRouter
vi.mock("@/core/openrouter-provider", () => ({
  testOpenRouterConnection: mockTestOpenRouter,
}));

// Mock fetch
vi.stubGlobal("fetch", mockFetch);

// Mock chrome storage
const mockSyncStore: Record<string, unknown> = {};
const mockLocalStore: Record<string, unknown> = {};

function setupChromeMock() {
  vi.stubGlobal("chrome", {
    storage: {
      sync: {
        get: vi.fn((key: string | string[]) => {
          if (Array.isArray(key)) {
            const result: Record<string, unknown> = {};
            key.forEach((k) => {
              if (mockSyncStore[k] !== undefined) {
                result[k] = mockSyncStore[k];
              }
            });
            return Promise.resolve(result);
          }
          return Promise.resolve({ [key]: mockSyncStore[key] });
        }),
        set: vi.fn((obj: Record<string, unknown>) => {
          Object.assign(mockSyncStore, obj);
          return Promise.resolve();
        }),
      },
      local: {
        get: vi.fn((key: string | string[]) => {
          if (Array.isArray(key)) {
            const result: Record<string, unknown> = {};
            key.forEach((k) => {
              if (mockLocalStore[k] !== undefined) {
                result[k] = mockLocalStore[k];
              }
            });
            return Promise.resolve(result);
          }
          return Promise.resolve({ [key]: mockLocalStore[key] });
        }),
        set: vi.fn((obj: Record<string, unknown>) => {
          Object.assign(mockLocalStore, obj);
          return Promise.resolve();
        }),
      },
    },
    runtime: {
      sendMessage: vi.fn(),
    },
  });
}

beforeEach(() => {
  // Clear storage
  Object.keys(mockSyncStore).forEach((key) => delete mockSyncStore[key]);
  Object.keys(mockLocalStore).forEach((key) => delete mockLocalStore[key]);

  // Reset mocks
  mockTestConnection.mockReset();
  mockTestConnection.mockResolvedValue({ ok: true, authenticated: true });
  mockTestOpenRouter.mockReset();
  mockTestOpenRouter.mockResolvedValue(true);
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ status: 200, ok: true });

  setupChromeMock();
});

describe("OnboardingApp - Navigation", () => {
  describe("Happy path: Normal wizard flow", () => {
    it("renders with step 0 (Obsidian) by default", async () => {
      render(<OnboardingApp />);

      await waitFor(() => {
        expect(screen.getByText("Connect to Obsidian")).toBeInTheDocument();
      });
    });

    it("shows loading state initially", () => {
      render(<OnboardingApp />);

      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("disables Next button by default (step not valid)", async () => {
      render(<OnboardingApp />);

      await waitFor(() => {
        expect(screen.getByText("Next")).toBeDisabled();
      });
    });

    it("disables Back button on first step", async () => {
      render(<OnboardingApp />);

      await waitFor(() => {
        expect(screen.getByText("Back")).toBeDisabled();
      });
    });

    it("goes back to step 0 when Back is clicked from step 1", async () => {
      mockSyncStore["onboardingStep"] = 1;

      render(<OnboardingApp />);

      await waitFor(() => {
        expect(screen.getByText("Connect AI Provider")).toBeInTheDocument();
      });

      // Back button enabled
      expect(screen.getByText("Back")).not.toBeDisabled();

      fireEvent.click(screen.getByText("Back"));

      await waitFor(() => {
        expect(screen.getByText("Connect to Obsidian")).toBeInTheDocument();
      });
    });

    it("advances to completion step from AI Key step", async () => {
      mockSyncStore["onboardingStep"] = 1;
      render(<OnboardingApp />);

      await waitFor(() => {
        expect(screen.getByText("Connect AI Provider")).toBeInTheDocument();
      });

      // Enter valid API key
      const apiKeyInput = screen.getByLabelText("OpenRouter API Key");
      fireEvent.change(apiKeyInput, {
        target: { value: "sk-or-test-12345678901234567890" },
      });

      // Test key succeeds
      const testButton = screen.getByText("Test Key");
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(screen.getByText("Next")).not.toBeDisabled();
      });

      // Click Next
      fireEvent.click(screen.getByText("Next"));

      await waitFor(() => {
        expect(screen.getByText("You're all set!")).toBeInTheDocument();
      });
    });

    it("shows navigation buttons on completion step with Next button", async () => {
      mockSyncStore["onboardingStep"] = 2;
      render(<OnboardingApp />);

      await waitFor(() => {
        expect(screen.getByText("You're all set!")).toBeInTheDocument();
      });

      // Navigation buttons should be visible on completion step
      expect(screen.getByText("Back")).toBeInTheDocument();
      expect(screen.getByText("Next")).toBeInTheDocument();
      expect(screen.getByText("Back")).not.toBeDisabled();
      expect(screen.getByText("Next")).not.toBeDisabled();
    });

    it("completes onboarding and opens popup when Next is clicked on completion step", async () => {
      mockSyncStore["onboardingStep"] = 2;
      mockSyncStore["vaultUrl"] = "https://localhost:27124";
      mockSyncStore["vaultApiKey"] = "test-key";
      mockSyncStore["apiKey"] = "sk-or-test";

      const mockWindowClose = vi.fn();
      Object.defineProperty(window, "close", {
        value: mockWindowClose,
        writable: true,
      });

      render(<OnboardingApp />);

      await waitFor(() => {
        expect(screen.getByText("You're all set!")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Next"));

      await waitFor(() => {
        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: "OPEN_POPUP" });
        expect(mockWindowClose).toHaveBeenCalled();
      });
    });

    it("shows Saving... state on completion step while saving", async () => {
      mockSyncStore["onboardingStep"] = 2;

      // Make chrome.storage.sync.set slow
      let resolveSet: () => void;
      vi.mocked(chrome.storage.sync.set).mockImplementation(
        () => new Promise((resolve) => {
          resolveSet = resolve as () => void;
        })
      );

      render(<OnboardingApp />);

      await waitFor(() => {
        expect(screen.getByText("You're all set!")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Next"));

      await waitFor(() => {
        expect(screen.getByText("Saving...")).toBeInTheDocument();
      });

      // Cleanup - resolve the promise
      resolveSet!();
    });

    it("disables buttons during save on completion step", async () => {
      mockSyncStore["onboardingStep"] = 2;

      // Make chrome.storage.sync.set slow
      vi.mocked(chrome.storage.sync.set).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<OnboardingApp />);

      await waitFor(() => {
        expect(screen.getByText("You're all set!")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Next"));

      await waitFor(() => {
        expect(screen.getByText("Back")).toBeDisabled();
        expect(screen.getByText("Saving...")).toBeDisabled();
      });
    });
  });

  describe("Expected failures: Completion errors", () => {
    it("shows error when save fails on completion step", async () => {
      mockSyncStore["onboardingStep"] = 2;

      // Make chrome.storage.sync.set fail
      vi.mocked(chrome.storage.sync.set).mockRejectedValue(new Error("Storage quota exceeded"));

      render(<OnboardingApp />);

      await waitFor(() => {
        expect(screen.getByText("You're all set!")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Next"));

      await waitFor(() => {
        expect(screen.getByText("Storage quota exceeded")).toBeInTheDocument();
      });
    });

    it("re-enables buttons after save error", async () => {
      mockSyncStore["onboardingStep"] = 2;

      vi.mocked(chrome.storage.sync.set).mockRejectedValue(new Error("Save failed"));

      render(<OnboardingApp />);

      await waitFor(() => {
        expect(screen.getByText("You're all set!")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Next"));

      await waitFor(() => {
        expect(screen.getByText("Save failed")).toBeInTheDocument();
      });

      // Buttons should be enabled again
      expect(screen.getByText("Back")).not.toBeDisabled();
      expect(screen.getByText("Next")).not.toBeDisabled();
    });

    it("does not close window when save fails", async () => {
      mockSyncStore["onboardingStep"] = 2;

      const mockWindowClose = vi.fn();
      Object.defineProperty(window, "close", {
        value: mockWindowClose,
        writable: true,
      });

      vi.mocked(chrome.storage.sync.set).mockRejectedValue(new Error("Save failed"));

      render(<OnboardingApp />);

      await waitFor(() => {
        expect(screen.getByText("You're all set!")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Next"));

      await waitFor(() => {
        expect(screen.getByText("Save failed")).toBeInTheDocument();
      });

      expect(mockWindowClose).not.toHaveBeenCalled();
    });
  });

  describe("Expected failures: Invalid states", () => {
    it("cannot advance without completing current step", async () => {
      render(<OnboardingApp />);

      await waitFor(() => {
        expect(screen.getByText("Connect to Obsidian")).toBeInTheDocument();
      });

      // Next button disabled
      expect(screen.getByText("Next")).toBeDisabled();

      // Clicking does nothing
      fireEvent.click(screen.getByText("Next"));

      // Still on step 0
      expect(screen.getByText("Connect to Obsidian")).toBeInTheDocument();
    });

    it("resets stepValid to false when navigating between steps", async () => {
      mockSyncStore["onboardingStep"] = 1;
      render(<OnboardingApp />);

      await waitFor(() => {
        expect(screen.getByText("Connect AI Provider")).toBeInTheDocument();
      });

      // Enter valid key
      const apiKeyInput = screen.getByLabelText("OpenRouter API Key");
      fireEvent.change(apiKeyInput, {
        target: { value: "sk-or-test-12345678901234567890" },
      });

      fireEvent.click(screen.getByText("Test Key"));

      await waitFor(() => {
        expect(screen.getByText("Next")).not.toBeDisabled();
      });

      // Go back
      fireEvent.click(screen.getByText("Back"));

      await waitFor(() => {
        expect(screen.getByText("Connect to Obsidian")).toBeInTheDocument();
      });

      // Next should be disabled again
      expect(screen.getByText("Next")).toBeDisabled();
    });
  });

  describe("Edge cases: Step boundaries and persistence", () => {
    it("loads saved step from chrome.storage on mount", async () => {
      mockSyncStore["onboardingStep"] = 1;

      render(<OnboardingApp />);

      await waitFor(() => {
        expect(screen.getByText("Connect AI Provider")).toBeInTheDocument();
      });
    });

    it("clamps invalid saved step to valid range", async () => {
      mockSyncStore["onboardingStep"] = 99;

      render(<OnboardingApp />);

      // Should render step 0 (default) since 99 is out of range
      await waitFor(() => {
        expect(screen.getByText("Connect to Obsidian")).toBeInTheDocument();
      });
    });

    it("handles negative saved step gracefully", async () => {
      mockSyncStore["onboardingStep"] = -1;

      render(<OnboardingApp />);

      await waitFor(() => {
        expect(screen.getByText("Connect to Obsidian")).toBeInTheDocument();
      });
    });

    it("shows correct progress indicator states", async () => {
      mockSyncStore["onboardingStep"] = 1;
      const { container } = render(<OnboardingApp />);

      await waitFor(() => {
        expect(screen.getByText("Connect AI Provider")).toBeInTheDocument();
      });

      // Step 0 should show checkmark (completed)
      const progressSteps = container.querySelectorAll(".progress-step");
      expect(progressSteps[0]?.textContent).toContain("\u2713");

      // Step 1 should be active
      expect(progressSteps[1]?.className).toContain("active");

      // Step 2 should be pending (no active, no completed)
      expect(progressSteps[2]?.className).not.toContain("active");
      expect(progressSteps[2]?.className).not.toContain("completed");
    });

    it("renders all three progress labels", async () => {
      const { container } = render(<OnboardingApp />);

      await waitFor(() => {
        expect(screen.getByText("Connect to Obsidian")).toBeInTheDocument();
      });

      const stepLabels = container.querySelectorAll(".step-label");
      expect(stepLabels[0]?.textContent).toBe("Obsidian");
      expect(stepLabels[1]?.textContent).toBe("AI Key");
      expect(stepLabels[2]?.textContent).toBe("Done");
    });
  });
});
