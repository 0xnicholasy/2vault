// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CompletionStep } from "@/onboarding/steps/CompletionStep";
import type { OnboardingData } from "@/onboarding/hooks/useOnboardingState";

const defaultData: OnboardingData = {
  vaultUrl: "https://localhost:27124",
  vaultApiKey: "test-vault-key",
  openRouterKey: "sk-or-test-key",
  vaultOrganization: "para",
  tagGroups: [],
  vaultName: "My Vault",
};

describe("CompletionStep - Final Step", () => {
  describe("Happy path: Display completion UI", () => {
    it("renders completion message", () => {
      render(<CompletionStep data={defaultData} />);

      expect(screen.getByText("You're all set!")).toBeInTheDocument();
    });

    it("displays all configured settings in checklist", () => {
      render(<CompletionStep data={defaultData} />);

      expect(screen.getByText(/Obsidian vault connected at https:\/\/localhost:27124/)).toBeInTheDocument();
      expect(screen.getByText(/AI provider configured \(OpenRouter\)/)).toBeInTheDocument();
      expect(screen.getByText(/Organization: PARA/)).toBeInTheDocument();
      expect(screen.getByText(/Summary detail: Standard/)).toBeInTheDocument();
    });

    it("shows Custom organization when vaultOrganization is custom", () => {
      render(
        <CompletionStep data={{ ...defaultData, vaultOrganization: "custom" }} />
      );

      expect(screen.getByText(/Organization: Custom/)).toBeInTheDocument();
    });

    it("shows usage nudge with actionable next steps", () => {
      render(<CompletionStep data={defaultData} />);

      expect(screen.getByText(/Pick a small bookmark folder/)).toBeInTheDocument();
      expect(screen.getByText(/Process/)).toBeInTheDocument();
    });

    it("displays all checkmark icons", () => {
      const { container } = render(<CompletionStep data={defaultData} />);

      const checkmarks = container.querySelectorAll(".checklist-icon");
      expect(checkmarks.length).toBe(4);
    });

    it("renders completion nudge with bold Process text", () => {
      render(<CompletionStep data={defaultData} />);

      const processText = screen.getByText("Process");
      expect(processText.tagName).toBe("STRONG");
    });
  });

  describe("Edge cases: Display variations", () => {
    it("shows correct vault URL in checklist", () => {
      render(
        <CompletionStep data={{ ...defaultData, vaultUrl: "http://localhost:27123" }} />
      );

      expect(screen.getByText(/http:\/\/localhost:27123/)).toBeInTheDocument();
    });

    it("shows custom vault URL in checklist", () => {
      render(
        <CompletionStep data={{ ...defaultData, vaultUrl: "https://my-server:9999" }} />
      );

      expect(screen.getByText(/https:\/\/my-server:9999/)).toBeInTheDocument();
    });
  });
});
