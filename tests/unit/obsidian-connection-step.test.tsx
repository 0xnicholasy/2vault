// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { ObsidianConnectionStep } from "@/onboarding/steps/ObsidianConnectionStep";
import type { OnboardingData } from "@/onboarding/hooks/useOnboardingState";
import { VaultClientError } from "@/core/types";

// Hoisted mocks
const { mockTestConnection, mockFetch } = vi.hoisted(() => {
  const mockTestConnection = vi.fn();
  const mockFetch = vi.fn();

  return { mockTestConnection, mockFetch };
});

vi.mock("@/core/vault-client", () => ({
  VaultClient: class MockVaultClient {
    testConnection = mockTestConnection;
  },
}));

// Mock fetch for Obsidian detection polling
vi.stubGlobal("fetch", mockFetch);

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
  mockTestConnection.mockReset();
  mockTestConnection.mockResolvedValue({ ok: true, authenticated: true });
  mockOnUpdate.mockReset();
  mockOnValidChange.mockReset();
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({
    status: 200,
    ok: true,
  });
});

/** Helper: navigate to step 4 by checking steps 1, 2 and entering API key */
async function navigateToStep4(
  data: OnboardingData = { ...defaultData, vaultApiKey: "test-key-12345" }
) {
  const result = render(
    <ObsidianConnectionStep
      data={data}
      onUpdate={mockOnUpdate}
      onValidChange={mockOnValidChange}
    />
  );

  // Check step 1
  fireEvent.click(screen.getByRole("checkbox"));

  // Check step 2
  await waitFor(() => {
    expect(screen.getByText("Install the Local REST API plugin")).toBeInTheDocument();
  });
  fireEvent.click(screen.getByRole("checkbox"));

  // Wait for step 4 (API key already present, so step 3 auto-completes)
  await waitFor(() => {
    expect(screen.getByText("Test Connection")).toBeInTheDocument();
  });

  return result;
}

describe("ObsidianConnectionStep - Sub-step Navigation", () => {
  describe("Happy path: Normal flow through 4 sub-steps", () => {
    it("renders step 1 (Open Obsidian) as active initially", async () => {
      render(
        <ObsidianConnectionStep
          data={defaultData}
          onUpdate={mockOnUpdate}
          onValidChange={mockOnValidChange}
        />
      );

      // The step body should be visible with the description text
      await waitFor(() => {
        expect(screen.getByText("Make sure Obsidian is running with your vault open.")).toBeInTheDocument();
      });
    });

    it("advances to step 2 when step 1 is checked", async () => {
      render(
        <ObsidianConnectionStep
          data={defaultData}
          onUpdate={mockOnUpdate}
          onValidChange={mockOnValidChange}
        />
      );

      const checkbox = screen.getByRole("checkbox");
      fireEvent.click(checkbox);

      await waitFor(() => {
        expect(screen.getByText("Install the Local REST API plugin")).toBeInTheDocument();
        expect(screen.getByText("This plugin lets 2Vault communicate with your vault.")).toBeInTheDocument();
      });
    });

    it("advances to step 3 when steps 1 and 2 are checked", async () => {
      render(
        <ObsidianConnectionStep
          data={defaultData}
          onUpdate={mockOnUpdate}
          onValidChange={mockOnValidChange}
        />
      );

      // Check step 1
      fireEvent.click(screen.getByRole("checkbox"));

      await waitFor(() => {
        expect(screen.getByText("Install the Local REST API plugin")).toBeInTheDocument();
      });

      // Check step 2
      fireEvent.click(screen.getByRole("checkbox"));

      await waitFor(() => {
        expect(screen.getByText("Copy your API key")).toBeInTheDocument();
        expect(screen.getByLabelText("API Key")).toBeInTheDocument();
      });
    });

    it("advances to step 4 when API key is entered and submitted", async () => {
      const { rerender } = render(
        <ObsidianConnectionStep
          data={defaultData}
          onUpdate={mockOnUpdate}
          onValidChange={mockOnValidChange}
        />
      );

      // Check steps 1 and 2
      fireEvent.click(screen.getByRole("checkbox"));

      await waitFor(() => {
        expect(screen.getByText("Install the Local REST API plugin")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole("checkbox"));

      await waitFor(() => {
        expect(screen.getByLabelText("API Key")).toBeInTheDocument();
      });

      // Enter API key
      fireEvent.change(screen.getByLabelText("API Key"), {
        target: { value: "test-key-12345" },
      });

      // Verify onUpdate was called with the new key
      expect(mockOnUpdate).toHaveBeenCalledWith({ vaultApiKey: "test-key-12345" });

      // Simulate parent updating the data prop (controlled component pattern)
      rerender(
        <ObsidianConnectionStep
          data={{ ...defaultData, vaultApiKey: "test-key-12345" }}
          onUpdate={mockOnUpdate}
          onValidChange={mockOnValidChange}
        />
      );

      // Submit step 3
      fireEvent.click(screen.getByRole("button", { name: "Done" }));

      await waitFor(() => {
        expect(screen.getByText("Test connection")).toBeInTheDocument();
        expect(screen.getByText("Verify 2Vault can reach your vault.")).toBeInTheDocument();
      });
    });

    it("completes wizard when connection test succeeds", async () => {
      await navigateToStep4();

      fireEvent.click(screen.getByText("Test Connection"));

      await waitFor(() => {
        expect(mockOnValidChange).toHaveBeenCalledWith(true);
        expect(screen.getByText("Connected to Obsidian vault successfully.")).toBeInTheDocument();
      });
    });
  });

  describe("Expected failures: Connection errors with HTTP/HTTPS distinction", () => {
    it("shows unauthenticated error when endpoint reports unauthenticated", async () => {
      mockTestConnection.mockResolvedValue({ ok: true, authenticated: false });

      await navigateToStep4();

      fireEvent.click(screen.getByText("Test Connection"));

      await waitFor(() => {
        expect(screen.getByText(/Connected but authentication failed/)).toBeInTheDocument();
        expect(mockOnValidChange).toHaveBeenCalledWith(false);
      });
    });

    it("shows unauthenticated error for HTTPS endpoint with wrong key", async () => {
      mockTestConnection.mockResolvedValue({ ok: true, authenticated: false });

      await navigateToStep4({
        ...defaultData,
        vaultUrl: "https://localhost:27124",
        vaultApiKey: "wrong-key-12345",
      });

      fireEvent.click(screen.getByText("Test Connection"));

      await waitFor(() => {
        expect(screen.getByText(/Connected but authentication failed/)).toBeInTheDocument();
        expect(screen.getByText(/Check your API key/)).toBeInTheDocument();
        expect(mockOnValidChange).toHaveBeenCalledWith(false);
      });
    });

    it("shows 401 error with API key mismatch message", async () => {
      mockTestConnection.mockRejectedValue(
        new VaultClientError("Unauthorized", 401, "/")
      );

      await navigateToStep4();

      fireEvent.click(screen.getByText("Test Connection"));

      await waitFor(() => {
        expect(screen.getByText(/API key doesn't match/)).toBeInTheDocument();
        expect(mockOnValidChange).toHaveBeenCalledWith(false);
      });
    });

    it("shows network error for connection failures", async () => {
      mockTestConnection.mockRejectedValue(
        new VaultClientError("Network error", null, "/")
      );

      await navigateToStep4();

      fireEvent.click(screen.getByText("Test Connection"));

      await waitFor(() => {
        expect(screen.getByText(/Could not reach Obsidian/)).toBeInTheDocument();
      });
    });

    it("handles connection failure when ok is false", async () => {
      mockTestConnection.mockResolvedValue({ ok: false });

      await navigateToStep4();

      fireEvent.click(screen.getByText("Test Connection"));

      await waitFor(() => {
        expect(screen.getByText(/Could not connect to Obsidian/)).toBeInTheDocument();
        expect(mockOnValidChange).toHaveBeenCalledWith(false);
      });
    });
  });

  describe("Edge cases: Re-expanding completed steps, state transitions", () => {
    it("allows re-expanding step 1 after completion to edit", async () => {
      render(
        <ObsidianConnectionStep
          data={defaultData}
          onUpdate={mockOnUpdate}
          onValidChange={mockOnValidChange}
        />
      );

      // Complete step 1
      fireEvent.click(screen.getByRole("checkbox"));

      await waitFor(() => {
        expect(screen.getByText("Install the Local REST API plugin")).toBeInTheDocument();
      });

      // Click on step 1 header to re-expand
      const step1Header = screen.getByRole("button", { name: /Open Obsidian/ });
      fireEvent.click(step1Header);

      await waitFor(() => {
        expect(screen.getByText("Make sure Obsidian is running with your vault open.")).toBeInTheDocument();
      });
    });

    it("allows unchecking completed step 1", async () => {
      render(
        <ObsidianConnectionStep
          data={defaultData}
          onUpdate={mockOnUpdate}
          onValidChange={mockOnValidChange}
        />
      );

      // Check step 1
      fireEvent.click(screen.getByRole("checkbox"));

      await waitFor(() => {
        expect(screen.getByText("Install the Local REST API plugin")).toBeInTheDocument();
      });

      // Re-expand step 1
      const step1Header = screen.getByRole("button", { name: /Open Obsidian/ });
      fireEvent.click(step1Header);

      await waitFor(() => {
        expect(screen.getByText("Make sure Obsidian is running with your vault open.")).toBeInTheDocument();
      });

      // Uncheck it
      const checkbox = screen.getByRole("checkbox");
      expect((checkbox as HTMLInputElement).checked).toBe(true);
      fireEvent.click(checkbox);

      // Should go back to step 1 as active
      await waitFor(() => {
        expect(screen.getByText("Make sure Obsidian is running with your vault open.")).toBeInTheDocument();
      });
    });

    it("allows re-expanding step 3 to change API key after entering it", async () => {
      await navigateToStep4({ ...defaultData, vaultApiKey: "initial-key-abc" });

      // Click on step 3 header
      const step3Header = screen.getByRole("button", { name: /Copy your API key/ });
      fireEvent.click(step3Header);

      await waitFor(() => {
        const apiKeyInput = screen.getByLabelText("API Key");
        expect(apiKeyInput).toHaveValue("initial-key-abc");
      });
    });

    it("returns to step 4 after editing key in step 3 and clicking Done", async () => {
      const { rerender } = await navigateToStep4({
        ...defaultData,
        vaultApiKey: "initial-key-abc",
      });

      const step3Header = screen.getByRole("button", { name: /Copy your API key/ });
      fireEvent.click(step3Header);

      await waitFor(() => {
        expect(screen.getByLabelText("API Key")).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText("API Key"), {
        target: { value: "corrected-key-xyz" },
      });

      rerender(
        <ObsidianConnectionStep
          data={{ ...defaultData, vaultApiKey: "corrected-key-xyz" }}
          onUpdate={mockOnUpdate}
          onValidChange={mockOnValidChange}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Done" }));

      await waitFor(() => {
        expect(screen.getByText("Test connection")).toBeInTheDocument();
        expect(screen.getByText("Verify 2Vault can reach your vault.")).toBeInTheDocument();
      });
    });

    it("resets connection status when API key changes", async () => {
      await navigateToStep4({ ...defaultData, vaultApiKey: "test-key-12345" });

      fireEvent.click(screen.getByText("Test Connection"));

      await waitFor(() => {
        expect(screen.getByText("Connected to Obsidian vault successfully.")).toBeInTheDocument();
      });

      // Re-expand step 3 and change API key
      const step3Header = screen.getByRole("button", { name: /Copy your API key/ });
      fireEvent.click(step3Header);

      await waitFor(() => {
        const apiKeyInput = screen.getByLabelText("API Key");
        fireEvent.change(apiKeyInput, { target: { value: "new-key-67890" } });
      });

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalledWith({ vaultApiKey: "new-key-67890" });
        expect(mockOnValidChange).toHaveBeenCalledWith(false);
      });

      // Success message should be gone
      expect(screen.queryByText("Connected to Obsidian vault successfully.")).not.toBeInTheDocument();
    });

    it("disables Test Connection button when API key is empty", async () => {
      // Start with API key already set so we can reach step 4
      await navigateToStep4({ ...defaultData, vaultApiKey: "test-key-12345" });

      // The Test Connection button should be enabled
      expect(screen.getByText("Test Connection")).not.toBeDisabled();

      // Re-expand step 3 to clear the key
      const step3Header = screen.getByRole("button", { name: /Copy your API key/ });
      fireEvent.click(step3Header);

      await waitFor(() => {
        const apiKeyInput = screen.getByLabelText("API Key");
        fireEvent.change(apiKeyInput, { target: { value: "" } });
      });

      // onUpdate should have been called to clear the key
      expect(mockOnUpdate).toHaveBeenCalledWith({ vaultApiKey: "" });
    });

    it("shows validation error for too-short API key", async () => {
      render(
        <ObsidianConnectionStep
          data={defaultData}
          onUpdate={mockOnUpdate}
          onValidChange={mockOnValidChange}
        />
      );

      // Navigate to step 3
      fireEvent.click(screen.getByRole("checkbox"));
      await waitFor(() => {
        expect(screen.getByText("Install the Local REST API plugin")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole("checkbox"));

      await waitFor(() => {
        expect(screen.getByLabelText("API Key")).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText("API Key"), {
        target: { value: "abc" },
      });

      await waitFor(() => {
        expect(screen.getByText("Key appears too short")).toBeInTheDocument();
      });
    });

    it("shows Testing... state during connection test", async () => {
      mockTestConnection.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ ok: true, authenticated: true }), 100))
      );

      await navigateToStep4({ ...defaultData, vaultApiKey: "test-key-12345" });

      fireEvent.click(screen.getByText("Test Connection"));

      expect(screen.getByText("Testing...")).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText("Connected to Obsidian vault successfully.")).toBeInTheDocument();
      }, { timeout: 200 });
    });

    it("toggles API key visibility", async () => {
      render(
        <ObsidianConnectionStep
          data={defaultData}
          onUpdate={mockOnUpdate}
          onValidChange={mockOnValidChange}
        />
      );

      // Navigate to step 3
      fireEvent.click(screen.getByRole("checkbox"));
      await waitFor(() => {
        expect(screen.getByText("Install the Local REST API plugin")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole("checkbox"));

      await waitFor(() => {
        const apiKeyInput = screen.getByLabelText("API Key") as HTMLInputElement;
        expect(apiKeyInput.type).toBe("password");
      });

      const toggleButton = screen.getByLabelText("Show API key");
      fireEvent.click(toggleButton);

      await waitFor(() => {
        const apiKeyInput = screen.getByLabelText("API Key") as HTMLInputElement;
        expect(apiKeyInput.type).toBe("text");
      });
    });
  });

  describe("Edge cases: Obsidian detection polling", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.runOnlyPendingTimers();
      vi.useRealTimers();
    });

    it("shows detection banner when Obsidian responds with 200", async () => {
      mockFetch.mockResolvedValue({ status: 200, ok: true });

      await act(async () => {
        render(
          <ObsidianConnectionStep
            data={defaultData}
            onUpdate={mockOnUpdate}
            onValidChange={mockOnValidChange}
          />
        );
      });

      // Wait for initial poll to complete
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(screen.getByText("Obsidian detected!")).toBeInTheDocument();
    });

    it("shows detection banner when Obsidian responds with 401 (unauthenticated but running)", async () => {
      mockFetch.mockResolvedValue({ status: 401, ok: false });

      await act(async () => {
        render(
          <ObsidianConnectionStep
            data={defaultData}
            onUpdate={mockOnUpdate}
            onValidChange={mockOnValidChange}
          />
        );
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(screen.getByText("Obsidian detected!")).toBeInTheDocument();
    });

    it("hides detection banner when Obsidian is not running", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      await act(async () => {
        render(
          <ObsidianConnectionStep
            data={defaultData}
            onUpdate={mockOnUpdate}
            onValidChange={mockOnValidChange}
          />
        );
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(screen.queryByText("Obsidian detected!")).not.toBeInTheDocument();
    });

    it("polls every 3 seconds when connection not established", async () => {
      mockFetch.mockResolvedValue({ status: 200 });

      await act(async () => {
        render(
          <ObsidianConnectionStep
            data={defaultData}
            onUpdate={mockOnUpdate}
            onValidChange={mockOnValidChange}
          />
        );
      });

      // Initial call
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
      const call1Count = mockFetch.mock.calls.length;

      // Wait 3 seconds
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
      const call2Count = mockFetch.mock.calls.length;

      expect(call2Count).toBeGreaterThan(call1Count);
    });
  });

  // URL configuration tests removed - now using fixed HTTP URL only
});
