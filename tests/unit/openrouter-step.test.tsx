// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OpenRouterStep } from "@/onboarding/steps/OpenRouterStep";
import type { OnboardingData } from "@/onboarding/hooks/useOnboardingState";

// Hoisted mocks
const { mockTestOpenRouter } = vi.hoisted(() => ({
  mockTestOpenRouter: vi.fn(),
}));

// Mock testOpenRouterConnection
vi.mock("@/core/openrouter-provider", () => ({
  testOpenRouterConnection: mockTestOpenRouter,
}));

const defaultData: OnboardingData = {
  vaultUrl: "http://localhost:27123",
  vaultApiKey: "",
  openRouterKey: "",
  vaultOrganization: "para",
  tagGroups: [],
  vaultName: "",
};

const mockOnUpdate = vi.fn();
const mockOnValidChange = vi.fn();

beforeEach(() => {
  mockTestOpenRouter.mockReset();
  mockTestOpenRouter.mockResolvedValue(true);
  mockOnUpdate.mockReset();
  mockOnValidChange.mockReset();
});

describe("OpenRouterStep - API Key Validation", () => {
  describe("Happy path: Valid API key entry and testing", () => {
    it("renders the step with correct content", () => {
      render(
        <OpenRouterStep
          data={defaultData}
          onUpdate={mockOnUpdate}
          onValidChange={mockOnValidChange}
        />
      );

      expect(screen.getByText("Connect AI Provider")).toBeInTheDocument();
      expect(screen.getByText(/2Vault uses AI to summarize/)).toBeInTheDocument();
      expect(screen.getByLabelText("OpenRouter API Key")).toBeInTheDocument();
    });

    it("accepts valid API key input", async () => {
      render(
        <OpenRouterStep
          data={defaultData}
          onUpdate={mockOnUpdate}
          onValidChange={mockOnValidChange}
        />
      );

      const apiKeyInput = screen.getByLabelText("OpenRouter API Key");
      fireEvent.change(apiKeyInput, {
        target: { value: "sk-or-v1-12345678901234567890" },
      });

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalledWith({
          openRouterKey: "sk-or-v1-12345678901234567890",
        });
      });

      // No error shown
      expect(screen.queryByText(/too short/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Must start with/)).not.toBeInTheDocument();
    });

    it("enables Test Key button when valid key is entered", () => {
      render(
        <OpenRouterStep
          data={{ ...defaultData, openRouterKey: "sk-or-v1-12345678901234567890" }}
          onUpdate={mockOnUpdate}
          onValidChange={mockOnValidChange}
        />
      );

      const testButton = screen.getByText("Test Key");
      expect(testButton).not.toBeDisabled();
    });

    it("calls testOpenRouterConnection when Test Key is clicked", async () => {
      render(
        <OpenRouterStep
          data={{ ...defaultData, openRouterKey: "sk-or-v1-12345678901234567890" }}
          onUpdate={mockOnUpdate}
          onValidChange={mockOnValidChange}
        />
      );

      const testButton = screen.getByText("Test Key");
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(mockTestOpenRouter).toHaveBeenCalledWith(
          "sk-or-v1-12345678901234567890"
        );
      });
    });

    it("shows success message when API key is valid", async () => {
      mockTestOpenRouter.mockResolvedValue(true);

      render(
        <OpenRouterStep
          data={{ ...defaultData, openRouterKey: "sk-or-v1-12345678901234567890" }}
          onUpdate={mockOnUpdate}
          onValidChange={mockOnValidChange}
        />
      );

      fireEvent.click(screen.getByText("Test Key"));

      await waitFor(() => {
        expect(screen.getByText("API key verified successfully.")).toBeInTheDocument();
        expect(mockOnValidChange).toHaveBeenCalledWith(true);
      });
    });

    it("toggles API key visibility", async () => {
      render(
        <OpenRouterStep
          data={defaultData}
          onUpdate={mockOnUpdate}
          onValidChange={mockOnValidChange}
        />
      );

      const apiKeyInput = screen.getByLabelText("OpenRouter API Key") as HTMLInputElement;
      expect(apiKeyInput.type).toBe("password");

      const toggleButton = screen.getByLabelText("Show API key");
      fireEvent.click(toggleButton);

      await waitFor(() => {
        expect(apiKeyInput.type).toBe("text");
      });

      fireEvent.click(screen.getByLabelText("Hide API key"));

      await waitFor(() => {
        expect(apiKeyInput.type).toBe("password");
      });
    });
  });

  describe("Expected failures: Invalid API keys and network errors", () => {
    it("shows validation error for key with wrong prefix", async () => {
      render(
        <OpenRouterStep
          data={defaultData}
          onUpdate={mockOnUpdate}
          onValidChange={mockOnValidChange}
        />
      );

      const apiKeyInput = screen.getByLabelText("OpenRouter API Key");
      fireEvent.change(apiKeyInput, {
        target: { value: "sk-test-12345678901234567890" },
      });

      await waitFor(() => {
        expect(screen.getByText("Must start with 'sk-or-'")).toBeInTheDocument();
      });
    });

    it("shows validation error for too-short key", async () => {
      render(
        <OpenRouterStep
          data={defaultData}
          onUpdate={mockOnUpdate}
          onValidChange={mockOnValidChange}
        />
      );

      const apiKeyInput = screen.getByLabelText("OpenRouter API Key");
      fireEvent.change(apiKeyInput, { target: { value: "sk-or-short" } });

      await waitFor(() => {
        expect(screen.getByText("Key appears too short")).toBeInTheDocument();
      });
    });

    it("disables Test Key button when validation error exists", async () => {
      render(
        <OpenRouterStep
          data={defaultData}
          onUpdate={mockOnUpdate}
          onValidChange={mockOnValidChange}
        />
      );

      const apiKeyInput = screen.getByLabelText("OpenRouter API Key");
      fireEvent.change(apiKeyInput, { target: { value: "sk-or-short" } });

      await waitFor(() => {
        const testButton = screen.getByText("Test Key");
        expect(testButton).toBeDisabled();
      });
    });

    it("disables Test Key button when API key is empty", () => {
      render(
        <OpenRouterStep
          data={defaultData}
          onUpdate={mockOnUpdate}
          onValidChange={mockOnValidChange}
        />
      );

      const testButton = screen.getByText("Test Key");
      expect(testButton).toBeDisabled();
    });

    it("shows error message when API key test fails", async () => {
      mockTestOpenRouter.mockResolvedValue(false);

      render(
        <OpenRouterStep
          data={{ ...defaultData, openRouterKey: "sk-or-v1-12345678901234567890" }}
          onUpdate={mockOnUpdate}
          onValidChange={mockOnValidChange}
        />
      );

      fireEvent.click(screen.getByText("Test Key"));

      await waitFor(() => {
        expect(screen.getByText("Invalid API key. Check that you copied it correctly from OpenRouter.")).toBeInTheDocument();
        expect(mockOnValidChange).toHaveBeenCalledWith(false);
      });
    });

    it("shows connection error when network request fails", async () => {
      mockTestOpenRouter.mockRejectedValue(new Error("Network timeout"));

      render(
        <OpenRouterStep
          data={{ ...defaultData, openRouterKey: "sk-or-v1-12345678901234567890" }}
          onUpdate={mockOnUpdate}
          onValidChange={mockOnValidChange}
        />
      );

      fireEvent.click(screen.getByText("Test Key"));

      await waitFor(() => {
        expect(screen.getByText("Connection failed: Network timeout")).toBeInTheDocument();
        expect(mockOnValidChange).toHaveBeenCalledWith(false);
      });
    });

    it("shows generic error for non-Error exceptions", async () => {
      mockTestOpenRouter.mockRejectedValue("Unknown error");

      render(
        <OpenRouterStep
          data={{ ...defaultData, openRouterKey: "sk-or-v1-12345678901234567890" }}
          onUpdate={mockOnUpdate}
          onValidChange={mockOnValidChange}
        />
      );

      fireEvent.click(screen.getByText("Test Key"));

      await waitFor(() => {
        expect(screen.getByText("Connection failed")).toBeInTheDocument();
      });
    });
  });

  describe("Edge cases: State transitions and resets", () => {
    it("resets connection status to idle when API key changes", async () => {
      mockTestOpenRouter.mockResolvedValue(true);

      render(
        <OpenRouterStep
          data={{ ...defaultData, openRouterKey: "sk-or-v1-12345678901234567890" }}
          onUpdate={mockOnUpdate}
          onValidChange={mockOnValidChange}
        />
      );

      fireEvent.click(screen.getByText("Test Key"));

      await waitFor(() => {
        expect(screen.getByText("API key verified successfully.")).toBeInTheDocument();
      });

      // Change the key
      const apiKeyInput = screen.getByLabelText("OpenRouter API Key");
      fireEvent.change(apiKeyInput, {
        target: { value: "sk-or-v1-99999999999999999999" },
      });

      await waitFor(() => {
        expect(screen.queryByText("API key verified successfully.")).not.toBeInTheDocument();
        expect(mockOnValidChange).toHaveBeenCalledWith(false);
      });
    });

    it("shows Testing... state during validation", async () => {
      mockTestOpenRouter.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(true), 100))
      );

      render(
        <OpenRouterStep
          data={{ ...defaultData, openRouterKey: "sk-or-v1-12345678901234567890" }}
          onUpdate={mockOnUpdate}
          onValidChange={mockOnValidChange}
        />
      );

      fireEvent.click(screen.getByText("Test Key"));

      expect(screen.getByText("Testing...")).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText("API key verified successfully.")).toBeInTheDocument();
      }, { timeout: 200 });
    });

    it("disables Test Key button during testing", async () => {
      mockTestOpenRouter.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(true), 100))
      );

      render(
        <OpenRouterStep
          data={{ ...defaultData, openRouterKey: "sk-or-v1-12345678901234567890" }}
          onUpdate={mockOnUpdate}
          onValidChange={mockOnValidChange}
        />
      );

      fireEvent.click(screen.getByText("Test Key"));

      const testButton = screen.getByText("Testing...");
      expect(testButton).toBeDisabled();

      await waitFor(() => {
        expect(screen.getByText("Test Key")).not.toBeDisabled();
      }, { timeout: 200 });
    });

    it("loads existing API key from data prop", () => {
      render(
        <OpenRouterStep
          data={{ ...defaultData, openRouterKey: "sk-or-existing-key-1234567890" }}
          onUpdate={mockOnUpdate}
          onValidChange={mockOnValidChange}
        />
      );

      const apiKeyInput = screen.getByLabelText("OpenRouter API Key") as HTMLInputElement;
      expect(apiKeyInput.value).toBe("sk-or-existing-key-1234567890");
    });

    it("clears error message when starting new test", async () => {
      mockTestOpenRouter.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

      render(
        <OpenRouterStep
          data={{ ...defaultData, openRouterKey: "sk-or-v1-12345678901234567890" }}
          onUpdate={mockOnUpdate}
          onValidChange={mockOnValidChange}
        />
      );

      // First test fails
      fireEvent.click(screen.getByText("Test Key"));

      await waitFor(() => {
        expect(screen.getByText(/Invalid API key/)).toBeInTheDocument();
      });

      // Test again (should clear previous error)
      fireEvent.click(screen.getByText("Test Key"));

      await waitFor(() => {
        expect(screen.getByText("API key verified successfully.")).toBeInTheDocument();
        expect(screen.queryByText(/Invalid API key/)).not.toBeInTheDocument();
      });
    });

    it("allows empty API key (not yet configured)", () => {
      render(
        <OpenRouterStep
          data={defaultData}
          onUpdate={mockOnUpdate}
          onValidChange={mockOnValidChange}
        />
      );

      const apiKeyInput = screen.getByLabelText("OpenRouter API Key");
      expect(apiKeyInput).toHaveValue("");

      // No validation error for empty
      expect(screen.queryByText(/too short/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Must start with/)).not.toBeInTheDocument();
    });

    it("renders link to get API key", () => {
      render(
        <OpenRouterStep
          data={defaultData}
          onUpdate={mockOnUpdate}
          onValidChange={mockOnValidChange}
        />
      );

      const link = screen.getByText("Get a free API key");
      expect(link).toHaveAttribute("href", "https://openrouter.ai/keys");
      expect(link).toHaveAttribute("target", "_blank");
    });

    it("renders OpenRouter link in description", () => {
      render(
        <OpenRouterStep
          data={defaultData}
          onUpdate={mockOnUpdate}
          onValidChange={mockOnValidChange}
        />
      );

      const link = screen.getByText("OpenRouter");
      expect(link).toHaveAttribute("href", "https://openrouter.ai/keys");
      expect(link).toHaveAttribute("target", "_blank");
    });
  });
});
