import { useState, useCallback, useEffect, useRef } from "react";
import type { FormEvent } from "react";
import {
  IoEye,
  IoEyeOff,
  IoCheckmarkCircle,
  IoChevronDown,
  IoChevronUp,
} from "react-icons/io5";
import { VaultClient } from "@/core/vault-client";
import { VaultClientError } from "@/core/types";
import { VAULT_URL_PRESETS, DEFAULT_VAULT_URL } from "@/utils/config";
import { validateVaultApiKey } from "@/utils/validation";
import type { OnboardingData } from "../hooks/useOnboardingState";

type ConnectionStatus = "idle" | "testing" | "success" | "error";
type SubStepId = 1 | 2 | 3 | 4;

interface Props {
  data: OnboardingData;
  onUpdate: (partial: Partial<OnboardingData>) => void;
  onValidChange: (valid: boolean) => void;
}

function categorizeVaultError(err: VaultClientError): string {
  if (err.statusCode === 401 || err.message.includes("authentication failed")) {
    return "Authentication failed: API key doesn't match. In Obsidian: Settings > Local REST API > copy the exact key shown there.";
  }
  if (err.message.includes("Network error")) {
    return "Could not reach Obsidian. Make sure: 1) Obsidian is open, 2) Local REST API plugin is installed, enabled, and toggled on.";
  }
  return `Connection failed: ${err.message}`;
}

export function ObsidianConnectionStep({
  data,
  onUpdate,
  onValidChange,
}: Props) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string>();
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("idle");
  const [connectionError, setConnectionError] = useState<string>();
  const [checkedSteps, setCheckedSteps] = useState<Set<SubStepId>>(new Set());
  const [step3Completed, setStep3Completed] = useState(
    data.vaultApiKey.length >= 5
  );
  const [obsidianDetected, setObsidianDetected] = useState(false);
  const [expandedStep, setExpandedStep] = useState<SubStepId | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);
  // Fixed URL - no presets needed since we only support HTTP
  const vaultUrl = DEFAULT_VAULT_URL;

  // Ensure vault URL is set to default on mount
  useEffect(() => {
    if (data.vaultUrl !== DEFAULT_VAULT_URL) {
      onUpdate({ vaultUrl: DEFAULT_VAULT_URL });
    }
  }, []); // Only run on mount

  // Determine which steps are completed
  const isStepCompleted = useCallback(
    (step: SubStepId): boolean => {
      switch (step) {
        case 1:
        case 2:
          return checkedSteps.has(step);
        case 3:
          return step3Completed;
        case 4:
          return connectionStatus === "success";
      }
    },
    [checkedSteps, step3Completed, connectionStatus]
  );

  // Active step = first uncompleted step
  const computedActiveStep: SubStepId = isStepCompleted(1)
    ? isStepCompleted(2)
      ? isStepCompleted(3)
        ? 4
        : 3
      : 2
    : 1;

  // Allow manually expanding a completed step to edit it
  const activeStep = expandedStep ?? computedActiveStep;

  // Clear expandedStep when it matches the computed step (no longer an override)
  useEffect(() => {
    if (expandedStep !== null && expandedStep === computedActiveStep) {
      setExpandedStep(null);
    }
  }, [expandedStep, computedActiveStep]);

  // Auto-detect Obsidian connection by polling GET / (unauthenticated)
  useEffect(() => {
    if (connectionStatus === "success") {
      // Stop polling once authenticated connection succeeds
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    const checkServer = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      try {
        const response = await fetch(`${data.vaultUrl}/`, {
          method: "GET",
          signal: controller.signal,
        });
        if (response.status === 200 || response.status === 401) {
          setObsidianDetected(true);
        }
      } catch {
        setObsidianDetected(false);
      } finally {
        clearTimeout(timeoutId);
      }
    };

    checkServer();
    pollRef.current = setInterval(checkServer, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [data.vaultUrl, connectionStatus]);

  const handleTestConnection = useCallback(async () => {
    setConnectionStatus("testing");
    setConnectionError(undefined);

    const client = new VaultClient(data.vaultUrl, data.vaultApiKey);
    try {
      const result = await client.testConnection();
      if (result.ok && result.authenticated) {
        setConnectionStatus("success");
        onValidChange(true);
      } else if (result.ok && !result.authenticated) {
        setConnectionStatus("error");
        setConnectionError(
          "Connected but authentication failed. Check your API key in Obsidian: Settings > Local REST API."
        );
        onValidChange(false);
      } else {
        // result.ok is false - show the error message
        setConnectionStatus("error");
        const errorMsg = ("error" in result && result.error) || "Could not connect to Obsidian";
        // Show clearer message for authentication failures
        if (errorMsg.includes("authentication failed") || errorMsg.includes("API key")) {
          setConnectionError("Authentication failed: Wrong API key. In Obsidian: Settings > Local REST API > copy the exact key.");
        } else {
          setConnectionError(errorMsg);
        }
        onValidChange(false);
      }
    } catch (err) {
      setConnectionStatus("error");
      if (err instanceof VaultClientError) {
        setConnectionError(categorizeVaultError(err));
      } else {
        setConnectionError(
          err instanceof Error ? err.message : "Connection failed"
        );
      }
      onValidChange(false);
    }
  }, [data.vaultUrl, data.vaultApiKey, onValidChange]);

  const toggleManualStep = (step: 1 | 2) => {
    setCheckedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(step)) {
        next.delete(step);
      } else {
        next.add(step);
      }
      return next;
    });
  };

  const handleStep3Done = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const result = validateVaultApiKey(data.vaultApiKey);
      setApiKeyError(result.error);
      if (!result.valid || !data.vaultApiKey) return;
      setStep3Completed(true);
      setExpandedStep(null);
    },
    [data.vaultApiKey]
  );

  const renderStepBadge = (step: SubStepId) => {
    if (isStepCompleted(step)) {
      return (
        <span className="sub-step-badge sub-step-badge-completed">
          <IoCheckmarkCircle />
        </span>
      );
    }
    return (
      <span
        className={`sub-step-badge ${step === activeStep ? "sub-step-badge-active" : ""}`}
      >
        {step}
      </span>
    );
  };

  const getStepState = (step: SubStepId) => {
    if (step === expandedStep) return "active";
    if (isStepCompleted(step)) return "completed";
    if (step === activeStep) return "active";
    return "pending";
  };

  return (
    <div className="step-content">
      <h2>Connect to Obsidian</h2>
      <p className="step-description">
        Follow these steps to link 2Vault with your Obsidian vault.
      </p>

      {obsidianDetected && connectionStatus !== "success" && (
        <div className="detection-banner">Obsidian detected!</div>
      )}

      <ol className="sub-step-list">
        {/* Step 1: Open Obsidian */}
        <li className={`sub-step sub-step-${getStepState(1)}`}>
          <button
            type="button"
            className="sub-step-header"
            onClick={() => {
              if (expandedStep === 1) setExpandedStep(null);
              else if (activeStep === 1) toggleManualStep(1);
              else if (isStepCompleted(1)) setExpandedStep(1);
            }}
            disabled={getStepState(1) === "pending"}
          >
            {renderStepBadge(1)}
            <span className="sub-step-title">Open Obsidian</span>
            {isStepCompleted(1) && (
              <span className="sub-step-check-indicator" />
            )}
          </button>
          {activeStep === 1 && (
            <div className="sub-step-body">
              <p>Make sure Obsidian is running with your vault open.</p>
              <div className="sub-step-actions">
                <a
                  href="obsidian://"
                  className="btn btn-secondary btn-sm"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open Obsidian
                </a>
                <label className="sub-step-checkbox">
                  <input
                    type="checkbox"
                    checked={checkedSteps.has(1)}
                    onChange={() => toggleManualStep(1)}
                  />
                  <span>Done</span>
                </label>
              </div>
            </div>
          )}
        </li>

        {/* Step 2: Install Plugin */}
        <li className={`sub-step sub-step-${getStepState(2)}`}>
          <button
            type="button"
            className="sub-step-header"
            onClick={() => {
              if (expandedStep === 2) setExpandedStep(null);
              else if (activeStep === 2) toggleManualStep(2);
              else if (isStepCompleted(2)) setExpandedStep(2);
            }}
            disabled={getStepState(2) === "pending"}
          >
            {renderStepBadge(2)}
            <span className="sub-step-title">
              Install the Local REST API plugin
            </span>
          </button>
          {activeStep === 2 && (
            <div className="sub-step-body">
              <p>
                This plugin lets 2Vault communicate with your vault.
              </p>
              <div className="sub-step-actions">
                <a
                  href="obsidian://show-plugin?id=obsidian-local-rest-api"
                  className="btn btn-secondary btn-sm"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Install Plugin
                </a>
              </div>
              <p className="sub-step-hint">
                After installing, enable the plugin in Obsidian's settings.
              </p>
              <label className="sub-step-checkbox">
                <input
                  type="checkbox"
                  checked={checkedSteps.has(2)}
                  onChange={() => toggleManualStep(2)}
                />
                <span>Done</span>
              </label>
            </div>
          )}
        </li>

        {/* Step 3: Copy API Key */}
        <li className={`sub-step sub-step-${getStepState(3)}`}>
          <button
            type="button"
            className="sub-step-header"
            onClick={() => {
              if (expandedStep === 3) setExpandedStep(null);
              else if (isStepCompleted(3)) setExpandedStep(3);
            }}
            disabled={getStepState(3) === "pending"}
          >
            {renderStepBadge(3)}
            <span className="sub-step-title">Copy your API key</span>
          </button>
          {activeStep === 3 && (
            <div className="sub-step-body">
              <p>
                In Obsidian: Settings &gt; Local REST API. Copy the API key.
              </p>
              <form onSubmit={handleStep3Done}>
                <div className="form-group">
                  <label htmlFor="vaultApiKey">API Key</label>
                  <div className="input-with-toggle">
                    <input
                      id="vaultApiKey"
                      type={showApiKey ? "text" : "password"}
                      value={data.vaultApiKey}
                      onChange={(e) => {
                        const val = e.target.value;
                        onUpdate({ vaultApiKey: val });
                        setStep3Completed(false);
                        const result = validateVaultApiKey(val);
                        setApiKeyError(result.error);
                        setConnectionStatus("idle");
                        onValidChange(false);
                      }}
                      placeholder="Paste your API key here"
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
                  {apiKeyError && (
                    <span className="form-error">{apiKeyError}</span>
                  )}
                </div>
                <div className="sub-step-actions" style={{ marginTop: '6px' }}>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={!data.vaultApiKey || !!apiKeyError}
                  >
                    Done
                  </button>
                </div>
              </form>
            </div>
          )}
        </li>

        {/* Step 4: Test Connection */}
        <li className={`sub-step sub-step-${getStepState(4)}`}>
          <button
            type="button"
            className="sub-step-header"
            disabled={getStepState(4) === "pending"}
          >
            {renderStepBadge(4)}
            <span className="sub-step-title">Test connection</span>
          </button>
          {activeStep === 4 && (
            <div className="sub-step-body">
              <p>Verify 2Vault can reach your vault.</p>

              <div className="form-actions">
                <button
                  className="btn btn-primary"
                  onClick={handleTestConnection}
                  disabled={
                    connectionStatus === "testing" || !data.vaultApiKey
                  }
                >
                  {connectionStatus === "testing"
                    ? "Testing..."
                    : "Test Connection"}
                </button>
              </div>

              {connectionStatus === "success" && (
                <div className="status-banner status-banner-success">
                  Connected to Obsidian vault successfully.
                </div>
              )}

              {connectionStatus === "error" && connectionError && (
                <div className="error-guidance">
                  <p>{connectionError}</p>
                </div>
              )}

              <div className="vault-url-display">
                <label>Vault URL</label>
                <code>{vaultUrl}</code>
                <p className="sub-step-hint" style={{ marginTop: '8px' }}>
                  Using HTTP (port 27123). HTTPS not supported in Chrome extensions with self-signed certificates.
                </p>
              </div>
            </div>
          )}
        </li>
      </ol>
    </div>
  );
}
