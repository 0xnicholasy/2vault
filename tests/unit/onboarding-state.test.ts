// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useOnboardingState } from "@/onboarding/hooks/useOnboardingState";
import type { VaultOrganization, TagGroup } from "@/core/types";

// Mock chrome storage
const mockSyncStore: Record<string, unknown> = {};

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
    },
  });
}

beforeEach(() => {
  // Clear storage
  Object.keys(mockSyncStore).forEach((key) => delete mockSyncStore[key]);

  setupChromeMock();
});

describe("useOnboardingState - State Management", () => {
  describe("Happy path: Normal state operations", () => {
    it("initializes with default data", async () => {
      const { result } = renderHook(() => useOnboardingState());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.currentStep).toBe(0);
      expect(result.current.data).toEqual({
        vaultUrl: "http://localhost:27123",
        vaultApiKey: "",
        openRouterKey: "",
        vaultOrganization: "para",
        tagGroups: [],
        vaultName: "",
      });
    });

    it("shows loading state initially", () => {
      const { result } = renderHook(() => useOnboardingState());

      expect(result.current.loading).toBe(true);
    });

    it("updates data via updateData", async () => {
      const { result } = renderHook(() => useOnboardingState());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.updateData({ vaultApiKey: "test-key-123" });
      });

      expect(result.current.data.vaultApiKey).toBe("test-key-123");
    });

    it("updates multiple fields at once", async () => {
      const { result } = renderHook(() => useOnboardingState());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.updateData({
          vaultApiKey: "vault-key",
          openRouterKey: "sk-or-test",
          vaultName: "Test Vault",
        });
      });

      expect(result.current.data.vaultApiKey).toBe("vault-key");
      expect(result.current.data.openRouterKey).toBe("sk-or-test");
      expect(result.current.data.vaultName).toBe("Test Vault");
    });

    it("advances to next step via goToStep", async () => {
      const { result } = renderHook(() => useOnboardingState());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.goToStep(1);
      });

      expect(result.current.currentStep).toBe(1);
    });

    it("goes back to previous step", async () => {
      mockSyncStore["onboardingStep"] = 2;

      const { result } = renderHook(() => useOnboardingState());

      await waitFor(() => {
        expect(result.current.currentStep).toBe(2);
      });

      act(() => {
        result.current.goToStep(1);
      });

      expect(result.current.currentStep).toBe(1);
    });

    it("persists step to chrome.storage when changed", async () => {
      const { result } = renderHook(() => useOnboardingState());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.goToStep(1);
      });

      await waitFor(() => {
        expect(chrome.storage.sync.set).toHaveBeenCalledWith({
          onboardingStep: 1,
        });
      });
    });

    it("completes onboarding and saves all settings", async () => {
      const { result } = renderHook(() => useOnboardingState());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.updateData({
          vaultUrl: "https://localhost:27124",
          vaultApiKey: "vault-key",
          openRouterKey: "sk-or-key",
          vaultName: "My Vault",
          vaultOrganization: "para",
          tagGroups: [{ name: "Test", tags: ["tag1", "tag2"] }],
        });
      });

      await act(async () => {
        await result.current.completeOnboarding();
      });

      await waitFor(() => {
        expect(chrome.storage.sync.set).toHaveBeenCalledWith({
          vaultUrl: "https://localhost:27124",
        });
        expect(chrome.storage.sync.set).toHaveBeenCalledWith({
          vaultApiKey: "vault-key",
        });
        expect(chrome.storage.sync.set).toHaveBeenCalledWith({
          apiKey: "sk-or-key",
        });
        expect(chrome.storage.sync.set).toHaveBeenCalledWith({
          vaultName: "My Vault",
        });
        expect(chrome.storage.sync.set).toHaveBeenCalledWith({
          vaultOrganization: "para",
        });
        expect(chrome.storage.sync.set).toHaveBeenCalledWith({
          onboardingComplete: true,
        });
      });
    });
  });

  describe("Expected failures: Invalid states", () => {
    it("loads saved step from storage on mount", async () => {
      mockSyncStore["onboardingStep"] = 1;

      const { result } = renderHook(() => useOnboardingState());

      await waitFor(() => {
        expect(result.current.currentStep).toBe(1);
      });
    });

    it("defaults to step 0 when saved step is invalid (too high)", async () => {
      mockSyncStore["onboardingStep"] = 99;

      const { result } = renderHook(() => useOnboardingState());

      await waitFor(() => {
        expect(result.current.currentStep).toBe(0);
      });
    });

    it("defaults to step 0 when saved step is invalid (negative)", async () => {
      mockSyncStore["onboardingStep"] = -1;

      const { result } = renderHook(() => useOnboardingState());

      await waitFor(() => {
        expect(result.current.currentStep).toBe(0);
      });
    });

    it("defaults to step 0 when saved step is undefined", async () => {
      delete mockSyncStore["onboardingStep"];

      const { result } = renderHook(() => useOnboardingState());

      await waitFor(() => {
        expect(result.current.currentStep).toBe(0);
      });
    });
  });

  describe("Edge cases: Partial updates and persistence", () => {
    it("preserves existing data when updating subset of fields", async () => {
      const { result } = renderHook(() => useOnboardingState());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.updateData({
          vaultApiKey: "key1",
          openRouterKey: "key2",
        });
      });

      act(() => {
        result.current.updateData({ vaultApiKey: "key3" });
      });

      expect(result.current.data.vaultApiKey).toBe("key3");
      expect(result.current.data.openRouterKey).toBe("key2"); // Preserved
    });

    it("allows updating vaultOrganization", async () => {
      const { result } = renderHook(() => useOnboardingState());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.updateData({
          vaultOrganization: "custom" as VaultOrganization,
        });
      });

      expect(result.current.data.vaultOrganization).toBe("custom");
    });

    it("allows updating tagGroups", async () => {
      const { result } = renderHook(() => useOnboardingState());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const tagGroups: TagGroup[] = [
        { name: "Group1", tags: ["tag1", "tag2"] },
        { name: "Group2", tags: ["tag3"] },
      ];

      act(() => {
        result.current.updateData({ tagGroups });
      });

      expect(result.current.data.tagGroups).toEqual(tagGroups);
    });

    it("saves tag groups during completion", async () => {
      const { result } = renderHook(() => useOnboardingState());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const tagGroups: TagGroup[] = [
        { name: "Tech", tags: ["programming", "ai"] },
      ];

      act(() => {
        result.current.updateData({
          vaultUrl: "https://localhost:27124",
          vaultApiKey: "key",
          openRouterKey: "sk-or-key",
          tagGroups,
        });
      });

      await act(async () => {
        await result.current.completeOnboarding();
      });

      await waitFor(() => {
        expect(chrome.storage.sync.set).toHaveBeenCalledWith({
          tagGroups,
        });
      });
    });

    it("handles empty tag groups", async () => {
      const { result } = renderHook(() => useOnboardingState());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.updateData({ tagGroups: [] });
      });

      await act(async () => {
        await result.current.completeOnboarding();
      });

      await waitFor(() => {
        expect(chrome.storage.sync.set).toHaveBeenCalledWith({
          tagGroups: [],
        });
      });
    });

    it("handles empty vaultName", async () => {
      const { result } = renderHook(() => useOnboardingState());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.updateData({
          vaultUrl: "https://localhost:27124",
          vaultApiKey: "key",
          openRouterKey: "sk-or-key",
          vaultName: "",
        });
      });

      await act(async () => {
        await result.current.completeOnboarding();
      });

      await waitFor(() => {
        expect(chrome.storage.sync.set).toHaveBeenCalledWith({
          vaultName: "",
        });
      });
    });

    it("allows jumping to specific step", async () => {
      const { result } = renderHook(() => useOnboardingState());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.goToStep(2);
      });

      expect(result.current.currentStep).toBe(2);

      await waitFor(() => {
        expect(chrome.storage.sync.set).toHaveBeenCalledWith({
          onboardingStep: 2,
        });
      });
    });

    it("allows going back from step 2 to step 0", async () => {
      mockSyncStore["onboardingStep"] = 2;

      const { result } = renderHook(() => useOnboardingState());

      await waitFor(() => {
        expect(result.current.currentStep).toBe(2);
      });

      act(() => {
        result.current.goToStep(0);
      });

      expect(result.current.currentStep).toBe(0);
    });

    it("handles multiple rapid state updates", async () => {
      const { result } = renderHook(() => useOnboardingState());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.updateData({ vaultApiKey: "key1" });
        result.current.updateData({ openRouterKey: "key2" });
        result.current.updateData({ vaultName: "name" });
      });

      expect(result.current.data.vaultApiKey).toBe("key1");
      expect(result.current.data.openRouterKey).toBe("key2");
      expect(result.current.data.vaultName).toBe("name");
    });

    it("completeOnboarding saves apiKey under correct storage key", async () => {
      const { result } = renderHook(() => useOnboardingState());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.updateData({
          vaultUrl: "https://localhost:27124",
          vaultApiKey: "vault-key",
          openRouterKey: "sk-or-my-key",
        });
      });

      await act(async () => {
        await result.current.completeOnboarding();
      });

      // OpenRouter key should be saved as "apiKey" (not "openRouterKey")
      await waitFor(() => {
        expect(chrome.storage.sync.set).toHaveBeenCalledWith({
          apiKey: "sk-or-my-key",
        });
      });
    });
  });
});
