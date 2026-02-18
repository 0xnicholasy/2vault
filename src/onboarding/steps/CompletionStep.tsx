import { useState, useCallback } from "react";
import { IoCheckmarkCircle } from "react-icons/io5";
import type { OnboardingData } from "../hooks/useOnboardingState";

interface Props {
  data: OnboardingData;
  onComplete: () => Promise<void>;
}

export function CompletionStep({ data, onComplete }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const handleOpen2Vault = useCallback(async () => {
    setSaving(true);
    setError(undefined);
    try {
      await onComplete();
      // Try to open popup, then close this tab
      chrome.runtime.sendMessage({ type: "OPEN_POPUP" });
      window.close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
      setSaving(false);
    }
  }, [onComplete]);

  return (
    <div className="step-content">
      <h2>You're all set!</h2>

      <div className="completion-checklist">
        <div className="checklist-item">
          <IoCheckmarkCircle className="checklist-icon" />
          <span>Obsidian vault connected at {data.vaultUrl}</span>
        </div>
        <div className="checklist-item">
          <IoCheckmarkCircle className="checklist-icon" />
          <span>AI provider configured (OpenRouter)</span>
        </div>
        <div className="checklist-item">
          <IoCheckmarkCircle className="checklist-icon" />
          <span>Organization: {data.vaultOrganization === "para" ? "PARA" : "Custom"}</span>
        </div>
        <div className="checklist-item">
          <IoCheckmarkCircle className="checklist-icon" />
          <span>Summary detail: Standard</span>
        </div>
      </div>

      <div className="completion-nudge">
        <p>
          Pick a small bookmark folder (5-10 bookmarks) and click <strong>Process</strong> to see 2Vault in action. You can adjust summary detail level and other settings anytime.
        </p>
      </div>

      {error && (
        <div className="error-guidance">
          <p>{error}</p>
        </div>
      )}

      <div className="form-actions completion-actions">
        <button
          className="btn btn-primary btn-lg"
          onClick={handleOpen2Vault}
          disabled={saving}
        >
          {saving ? "Saving..." : "Open 2Vault"}
        </button>
      </div>
    </div>
  );
}
