import { useState, useCallback } from "react";
import { IoEye, IoEyeOff } from "react-icons/io5";
import { testOpenRouterConnection } from "@/core/openrouter-provider";
import { validateOpenRouterKey } from "@/utils/validation";
import type { OnboardingData } from "../hooks/useOnboardingState";

type ConnectionStatus = "idle" | "testing" | "success" | "error";

interface Props {
  data: OnboardingData;
  onUpdate: (partial: Partial<OnboardingData>) => void;
  onValidChange: (valid: boolean) => void;
}

export function OpenRouterStep({ data, onUpdate, onValidChange }: Props) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string>();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [connectionError, setConnectionError] = useState<string>();

  const handleTestKey = useCallback(async () => {
    setConnectionStatus("testing");
    setConnectionError(undefined);

    try {
      const ok = await testOpenRouterConnection(data.openRouterKey);
      if (ok) {
        setConnectionStatus("success");
        onValidChange(true);
      } else {
        setConnectionStatus("error");
        setConnectionError("Invalid API key. Check that you copied it correctly from OpenRouter.");
        onValidChange(false);
      }
    } catch (err) {
      setConnectionStatus("error");
      setConnectionError(
        err instanceof Error ? `Connection failed: ${err.message}` : "Connection failed"
      );
      onValidChange(false);
    }
  }, [data.openRouterKey, onValidChange]);

  return (
    <div className="step-content">
      <h2>Connect AI Provider</h2>
      <p className="step-description">
        2Vault uses AI to summarize and categorize your bookmarks. Get a free API key from{" "}
        <a
          href="https://openrouter.ai/keys"
          target="_blank"
          rel="noopener noreferrer"
        >
          OpenRouter
        </a>{" "}
        (supports many models, pay-per-use).
      </p>

      <div className="form-group">
        <label htmlFor="openRouterKey">OpenRouter API Key</label>
        <div className="input-with-toggle">
          <input
            id="openRouterKey"
            type={showApiKey ? "text" : "password"}
            value={data.openRouterKey}
            onChange={(e) => {
              const val = e.target.value;
              onUpdate({ openRouterKey: val });
              const result = validateOpenRouterKey(val);
              setApiKeyError(result.error);
              setConnectionStatus("idle");
              onValidChange(false);
            }}
            placeholder="sk-or-..."
          />
          <button
            type="button"
            className="toggle-visibility"
            onClick={() => setShowApiKey((v) => !v)}
            aria-label={showApiKey ? "Hide API key" : "Show API key"}
          >
            {showApiKey ? <IoEyeOff /> : <IoEye />}
          </button>
        </div>
        {apiKeyError && <span className="form-error">{apiKeyError}</span>}
      </div>

      <div className="form-actions">
        <button
          className="btn btn-primary"
          onClick={handleTestKey}
          disabled={connectionStatus === "testing" || !data.openRouterKey || !!apiKeyError}
        >
          {connectionStatus === "testing" ? "Testing..." : "Test Key"}
        </button>
        <a
          href="https://openrouter.ai/keys"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondary"
        >
          Get a free API key
        </a>
      </div>

      {connectionStatus === "success" && (
        <div className="status-banner status-banner-success">
          API key verified successfully.
        </div>
      )}

      {connectionStatus === "error" && connectionError && (
        <div className="error-guidance">
          <p>{connectionError}</p>
        </div>
      )}
    </div>
  );
}
