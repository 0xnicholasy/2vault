import { useState, useEffect, useCallback } from "react";
import type { VaultOrganization, TagGroup } from "@/core/types";
import {
  setSyncStorage,
  getSyncStorage,
  markOnboardingComplete,
  setOnboardingStep as persistStep,
} from "@/utils/storage";
import { DEFAULT_VAULT_URL } from "@/utils/config";

export interface OnboardingData {
  vaultUrl: string;
  vaultApiKey: string;
  openRouterKey: string;
  vaultOrganization: VaultOrganization;
  tagGroups: TagGroup[];
  vaultName: string;
}

const DEFAULT_DATA: OnboardingData = {
  vaultUrl: DEFAULT_VAULT_URL,
  vaultApiKey: "",
  openRouterKey: "",
  vaultOrganization: "para",
  tagGroups: [],
  vaultName: "",
};

export function useOnboardingState() {
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<OnboardingData>(DEFAULT_DATA);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSyncStorage("onboardingStep").then((step) => {
      if (step !== undefined && step >= 0 && step <= 2) {
        setCurrentStep(step);
      }
      setLoading(false);
    });
  }, []);

  const goToStep = useCallback((step: number) => {
    setCurrentStep(step);
    persistStep(step);
  }, []);

  const updateData = useCallback((partial: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...partial }));
  }, []);

  const completeOnboarding = useCallback(async () => {
    await Promise.all([
      setSyncStorage("vaultUrl", data.vaultUrl),
      setSyncStorage("vaultApiKey", data.vaultApiKey),
      setSyncStorage("apiKey", data.openRouterKey),
      setSyncStorage("vaultOrganization", data.vaultOrganization),
      setSyncStorage("tagGroups", data.tagGroups),
      setSyncStorage("vaultName", data.vaultName),
      markOnboardingComplete(),
    ]);
  }, [data]);

  return { currentStep, data, loading, goToStep, updateData, completeOnboarding };
}
