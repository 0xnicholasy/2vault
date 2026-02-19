import { useState, useCallback } from "react";
import { useOnboardingState } from "./hooks/useOnboardingState";
import { ObsidianConnectionStep } from "./steps/ObsidianConnectionStep";
import { OpenRouterStep } from "./steps/OpenRouterStep";
import { CompletionStep } from "./steps/CompletionStep";

const STEP_LABELS = ["Obsidian", "AI Key", "Done"];

export function OnboardingApp() {
  const { currentStep, data, loading, goToStep, updateData, completeOnboarding } =
    useOnboardingState();
  const [stepValid, setStepValid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const handleValidChange = useCallback((valid: boolean) => {
    setStepValid(valid);
  }, []);

  const handleNext = useCallback(() => {
    if (currentStep < 2) {
      setStepValid(false);
      goToStep(currentStep + 1);
    }
  }, [currentStep, goToStep]);

  const handleComplete = useCallback(async () => {
    setSaving(true);
    setError(undefined);
    try {
      await completeOnboarding();
      // Try to open popup, then close this tab
      chrome.runtime.sendMessage({ type: "OPEN_POPUP" });
      window.close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
      setSaving(false);
    }
  }, [completeOnboarding]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setStepValid(false);
      goToStep(currentStep - 1);
    }
  }, [currentStep, goToStep]);

  if (loading) {
    return (
      <div className="onboarding-container">
        <div className="onboarding-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="onboarding-container">
      <header className="onboarding-header">
        <h1>2Vault Onboarding</h1>
      </header>

      <div className="progress-steps">
        {STEP_LABELS.map((label, i) => (
          <div
            key={label}
            className={`progress-step ${i === currentStep ? "active" : ""} ${i < currentStep ? "completed" : ""}`}
          >
            <div className="step-dot">{i < currentStep ? "\u2713" : i + 1}</div>
            <span className="step-label">{label}</span>
          </div>
        ))}
      </div>

      <main className="onboarding-main">
        {currentStep === 0 && (
          <ObsidianConnectionStep
            data={data}
            onUpdate={updateData}
            onValidChange={handleValidChange}
          />
        )}
        {currentStep === 1 && (
          <OpenRouterStep
            data={data}
            onUpdate={updateData}
            onValidChange={handleValidChange}
          />
        )}
        {currentStep === 2 && (
          <CompletionStep data={data} />
        )}
      </main>

      <nav className="onboarding-nav">
        <button
          className="btn btn-secondary"
          onClick={handleBack}
          disabled={currentStep === 0 || saving}
        >
          Back
        </button>
        <button
          className="btn btn-primary"
          onClick={currentStep === 2 ? handleComplete : handleNext}
          disabled={(currentStep < 2 && !stepValid) || saving}
        >
          {currentStep === 2 && saving ? "Saving..." : "Next"}
        </button>
      </nav>
      {error && (
        <div className="error-guidance" style={{ marginTop: "1rem" }}>
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}
