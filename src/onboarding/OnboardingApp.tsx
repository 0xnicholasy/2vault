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

  const handleValidChange = useCallback((valid: boolean) => {
    setStepValid(valid);
  }, []);

  const handleNext = useCallback(() => {
    if (currentStep < 2) {
      setStepValid(false);
      goToStep(currentStep + 1);
    }
  }, [currentStep, goToStep]);

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
        <h1>2Vault</h1>
        <span className="onboarding-subtitle">Setup</span>
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
          <CompletionStep data={data} onComplete={completeOnboarding} />
        )}
      </main>

      {currentStep < 2 && (
        <nav className="onboarding-nav">
          <button
            className="btn btn-secondary"
            onClick={handleBack}
            disabled={currentStep === 0}
          >
            Back
          </button>
          <button
            className="btn btn-primary"
            onClick={handleNext}
            disabled={!stepValid}
          >
            Next
          </button>
        </nav>
      )}
    </div>
  );
}
