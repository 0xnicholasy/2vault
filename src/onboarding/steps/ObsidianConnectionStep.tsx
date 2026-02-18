import { useState, useCallback, useEffect, useRef } from "react";
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

function categorizeVaultError(err: VaultClientError, url: string): string {
  if (err.statusCode === 401) {
    return "API key doesn't match. In Obsidian: Settings > Local REST API > copy the key shown there.";
  }
  if (err.message.includes("Network error") && url.startsWith("https://")) {
    return (
      "Could not reach Obsidian. Make sure: 1) Obsidian is open, 2) Local REST API plugin is installed and enabled. " +
      `You may need to accept the certificate: open ${url} in a new tab and click Advanced > Proceed.`
    );
  }
  if (err.message.includes("Network error")) {
    return "Could not reach Obsidian. Make sure: 1) Obsidian is open, 2) Local REST API plugin is installed, enabled, and toggled on.";
  }
  return `Connection failed: ${err.message}. Try switching between HTTP and HTTPS in Advanced settings below.`;
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
  const [showUrlConfig, setShowUrlConfig] = useState(false);
  const [obsidianDetected, setObsidianDetected] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const [vaultUrlPreset, setVaultUrlPreset] = useState<string>(() => {
    const match = VAULT_URL_PRESETS.find((p) => p.value === data.vaultUrl);
    return match ? match.value : "custom";
  });

  // Determine which steps are completed
  const isStepCompleted = useCallback(
    (step: SubStepId): boolean => {
      switch (step) {
        case 1:
        case 2:
          return checkedSteps.has(step);
        case 3:
          return data.vaultApiKey.length >= 5;
        case 4:
          return connectionStatus === "success";
      }
    },
    [checkedSteps, data.vaultApiKey, connectionStatus]
  );

  // Active step = first uncompleted step
  const activeStep: SubStepId = isStepCompleted(1)
    ? isStepCompleted(2)
      ? isStepCompleted(3)
        ? 4
        : 3
      : 2
    : 1;

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
      const healthy = await client.testConnection();
      if (healthy) {
        setConnectionStatus("success");
        onValidChange(true);
      } else {
        setConnectionStatus("error");
        setConnectionError(
          "Connected but authentication failed. Check your API key."
        );
        onValidChange(false);
      }
    } catch (err) {
      setConnectionStatus("error");
      if (err instanceof VaultClientError) {
        setConnectionError(categorizeVaultError(err, data.vaultUrl));
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
              if (activeStep === 1) toggleManualStep(1);
            }}
            disabled={getStepState(1) === "pending"}
          >
            {renderStepBadge(1)}
            <span className="sub-step-title">Open Obsidian</span>
            {isStepCompleted(1) && (
              <span className="sub-step-check-indicator" />
            )}
          </button>
          {activeStep === 1 && !isStepCompleted(1) && (
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
              if (activeStep === 2) toggleManualStep(2);
            }}
            disabled={getStepState(2) === "pending"}
          >
            {renderStepBadge(2)}
            <span className="sub-step-title">
              Install the Local REST API plugin
            </span>
          </button>
          {activeStep === 2 && !isStepCompleted(2) && (
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
            disabled={getStepState(3) === "pending"}
          >
            {renderStepBadge(3)}
            <span className="sub-step-title">Copy your API key</span>
          </button>
          {activeStep === 3 && !isStepCompleted(3) && (
            <div className="sub-step-body">
              <p>
                In Obsidian: Settings &gt; Local REST API. Copy the API key.
              </p>
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
                  {connectionError.includes("certificate") && (
                    <a
                      href={data.vaultUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm"
                    >
                      Open vault URL to accept certificate
                    </a>
                  )}
                </div>
              )}

              <button
                type="button"
                className="url-config-toggle"
                onClick={() => setShowUrlConfig((v) => !v)}
              >
                {showUrlConfig ? <IoChevronUp /> : <IoChevronDown />}
                <span>Advanced: change URL</span>
              </button>

              {showUrlConfig && (
                <div className="form-group">
                  <label htmlFor="vaultUrlPreset">Vault URL</label>
                  <select
                    id="vaultUrlPreset"
                    value={vaultUrlPreset}
                    onChange={(e) => {
                      const selected = e.target.value;
                      setVaultUrlPreset(selected);
                      if (selected !== "custom") {
                        onUpdate({ vaultUrl: selected });
                      }
                      setConnectionStatus("idle");
                      setObsidianDetected(false);
                      onValidChange(false);
                    }}
                  >
                    {VAULT_URL_PRESETS.map((preset) => (
                      <option key={preset.value} value={preset.value}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                  {vaultUrlPreset === "custom" && (
                    <input
                      id="vaultUrl"
                      type="text"
                      value={data.vaultUrl}
                      onChange={(e) => {
                        onUpdate({ vaultUrl: e.target.value });
                        setConnectionStatus("idle");
                        setObsidianDetected(false);
                        onValidChange(false);
                      }}
                      placeholder="http://your-obsidian-url:port"
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </li>
      </ol>
    </div>
  );
}
