import { useState, useCallback } from "react";
import { IoEye, IoEyeOff } from "react-icons/io5";
import { VaultClient } from "@/core/vault-client";
import { VaultClientError } from "@/core/types";
import { VAULT_URL_PRESETS, DEFAULT_VAULT_URL } from "@/utils/config";
import { validateVaultApiKey } from "@/utils/validation";
import type { OnboardingData } from "../hooks/useOnboardingState";

type ConnectionStatus = "idle" | "testing" | "success" | "error";

interface Props {
  data: OnboardingData;
  onUpdate: (partial: Partial<OnboardingData>) => void;
  onValidChange: (valid: boolean) => void;
}

function categorizeVaultError(err: VaultClientError, url: string): string {
  if (err.statusCode === 401) {
    return "Authentication failed. Check that your API key matches the one in Obsidian's Local REST API settings.";
  }
  if (err.message.includes("Network error") && url.startsWith("https://")) {
    return "SSL certificate error. This is expected with the self-signed certificate. Open the vault URL below in a new browser tab first and accept the certificate, then try again.";
  }
  if (err.message.includes("Network error")) {
    return "Could not connect. Make sure Obsidian is running and the Local REST API plugin is enabled.";
  }
  return `Connection failed: ${err.message}. Try switching between HTTP and HTTPS.`;
}

export function ObsidianConnectionStep({ data, onUpdate, onValidChange }: Props) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string>();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [connectionError, setConnectionError] = useState<string>();
  const [vaultUrlPreset, setVaultUrlPreset] = useState<string>(() => {
    const match = VAULT_URL_PRESETS.find((p) => p.value === data.vaultUrl);
    return match ? match.value : "custom";
  });

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
        setConnectionError("Connected but authentication failed. Check your API key.");
        onValidChange(false);
      }
    } catch (err) {
      setConnectionStatus("error");
      if (err instanceof VaultClientError) {
        setConnectionError(categorizeVaultError(err, data.vaultUrl));
      } else {
        setConnectionError(err instanceof Error ? err.message : "Connection failed");
      }
      onValidChange(false);
    }
  }, [data.vaultUrl, data.vaultApiKey, onValidChange]);

  return (
    <div className="step-content">
      <h2>Connect to Obsidian</h2>
      <p className="step-description">
        2Vault saves content directly to your Obsidian vault using the{" "}
        <a
          href="obsidian://show-plugin?id=obsidian-local-rest-api"
          target="_blank"
          rel="noopener noreferrer"
        >
          Local REST API plugin
        </a>
        . Install and enable it first, then enter the connection details below.
      </p>

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
              onValidChange(false);
            }}
            placeholder="https://your-obsidian-url:port"
          />
        )}
      </div>

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
            placeholder="Copy from Obsidian REST API settings"
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
          onClick={handleTestConnection}
          disabled={connectionStatus === "testing" || !data.vaultApiKey}
        >
          {connectionStatus === "testing" ? "Testing..." : "Test Connection"}
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
          {connectionError.includes("SSL") && (
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
    </div>
  );
}
