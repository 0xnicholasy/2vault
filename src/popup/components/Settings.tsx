import { useState, useEffect, useCallback } from "react";
import { IoEye, IoEyeOff } from "react-icons/io5";
import { VaultClient } from "@/core/vault-client";
import { testOpenRouterConnection } from "@/core/openrouter-provider";
import { getConfig, setSyncStorage } from "@/utils/storage";
import {
  DEFAULT_VAULT_URL,
  PARA_DESCRIPTIONS,
  VAULT_URL_PRESETS,
  SUMMARY_DETAIL_OPTIONS,
} from "@/utils/config";
import type { VaultOrganization, TagGroup, SummaryDetailLevel } from "@/core/types";
import { TagGroupEditor } from "@/popup/components/TagGroupEditor";
import { validateOpenRouterKey, validateVaultApiKey } from "@/utils/validation";

type ConnectionStatus = "idle" | "testing" | "success" | "error";
type SaveStatus = "idle" | "saving" | "saved";

export function Settings() {
  const [apiKey, setApiKey] = useState("");
  const [vaultUrl, setVaultUrl] = useState(DEFAULT_VAULT_URL);
  const [vaultApiKey, setVaultApiKey] = useState("");
  const [vaultName, setVaultName] = useState("");
  const [vaultOrganization, setVaultOrganization] =
    useState<VaultOrganization>("para");
  const [tagGroups, setTagGroups] = useState<TagGroup[]>([]);
  const [summaryDetailLevel, setSummaryDetailLevel] =
    useState<SummaryDetailLevel>("standard");

  const [showApiKey, setShowApiKey] = useState(false);
  const [showVaultApiKey, setShowVaultApiKey] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string>();
  const [vaultApiKeyError, setVaultApiKeyError] = useState<string>();

  const [llmStatus, setLlmStatus] = useState<ConnectionStatus>("idle");
  const [vaultStatus, setVaultStatus] = useState<ConnectionStatus>("idle");
  const [vaultErrorMsg, setVaultErrorMsg] = useState<string>();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    getConfig().then((config) => {
      setApiKey(config.apiKey);
      // Always use default HTTP URL
      setVaultUrl(DEFAULT_VAULT_URL);
      setVaultApiKey(config.vaultApiKey);
      setVaultName(config.vaultName);
      setVaultOrganization(config.vaultOrganization);
      setTagGroups(config.tagGroups);
      setSummaryDetailLevel(config.summaryDetailLevel);
    });
  }, []);

  const markDirty = useCallback(() => {
    setDirty(true);
    setSaveStatus("idle");
    setLlmStatus("idle");
    setVaultStatus("idle");
    setVaultErrorMsg(undefined);
  }, []);

  const handleSaveSettings = useCallback(async () => {
    // Start testing
    setSaveStatus("saving");
    setLlmStatus("testing");
    setVaultStatus("testing");
    setVaultErrorMsg(undefined);

    // Test connections
    const [llmOk, vaultResult] = await Promise.all([
      apiKey
        ? testOpenRouterConnection(apiKey).catch(() => false)
        : Promise.resolve(false),
      vaultApiKey
        ? new VaultClient(vaultUrl, vaultApiKey)
            .testConnection()
            .then((r) => r)
            .catch(() => ({ ok: false, error: "Connection failed" }))
        : Promise.resolve({ ok: false, error: "No API key" }),
    ]);

    // Update connection status
    setLlmStatus(llmOk ? "success" : "error");

    let vaultOk = false;
    if (vaultResult.ok) {
      if ("authenticated" in vaultResult && vaultResult.authenticated) {
        setVaultStatus("success");
        setVaultErrorMsg(undefined);
        vaultOk = true;
      } else {
        setVaultStatus("error");
        setVaultErrorMsg("Authentication failed");
      }
    } else {
      setVaultStatus("error");
      const errorMsg = ("error" in vaultResult && vaultResult.error) || "Connection failed";
      // Show clearer message for authentication failures
      if (errorMsg.includes("authentication failed") || errorMsg.includes("API key")) {
        setVaultErrorMsg("Authentication failed");
      } else {
        setVaultErrorMsg(errorMsg);
      }
    }

    // Only save if both connections succeed
    if (llmOk && vaultOk) {
      await Promise.all([
        setSyncStorage("apiKey", apiKey),
        setSyncStorage("vaultUrl", vaultUrl),
        setSyncStorage("vaultApiKey", vaultApiKey),
        setSyncStorage("vaultName", vaultName),
        setSyncStorage("vaultOrganization", vaultOrganization),
        setSyncStorage("tagGroups", tagGroups),
        setSyncStorage("summaryDetailLevel", summaryDetailLevel),
      ]);
      setDirty(false);
      setSaveStatus("saved");
    } else {
      // Reset save status on connection failure
      setSaveStatus("idle");
    }
  }, [
    apiKey,
    vaultUrl,
    vaultApiKey,
    vaultName,
    vaultOrganization,
    tagGroups,
    summaryDetailLevel,
  ]);

  return (
    <div className="settings">
      <div className="form-group">
        <label htmlFor="apiKey">OpenRouter API Key</label>
        <div className="input-with-toggle">
          <input
            id="apiKey"
            type={showApiKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => {
              const val = e.target.value;
              setApiKey(val);
              const result = validateOpenRouterKey(val);
              setApiKeyError(result.error);
              markDirty();
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

      <div className="form-group">
        <label>Obsidian Vault URL</label>
        <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px', fontFamily: 'monospace', fontSize: '13px' }}>
          {DEFAULT_VAULT_URL}
        </div>
        <span className="form-hint">
          Using HTTP (port 27123). HTTPS not supported in Chrome extensions with self-signed certificates.
        </span>
      </div>

      <div className="form-group">
        <label htmlFor="vaultApiKey">Obsidian Vault API Key</label>
        <div className="input-with-toggle">
          <input
            id="vaultApiKey"
            type={showVaultApiKey ? "text" : "password"}
            value={vaultApiKey}
            onChange={(e) => {
              const val = e.target.value;
              setVaultApiKey(val);
              const result = validateVaultApiKey(val);
              setVaultApiKeyError(result.error);
              markDirty();
            }}
            placeholder="Enter vault API key"
          />
          <button
            type="button"
            className="toggle-visibility"
            onClick={() => setShowVaultApiKey((v) => !v)}
            aria-label={
              showVaultApiKey ? "Hide vault API key" : "Show vault API key"
            }
          >
            {showVaultApiKey ? <IoEyeOff /> : <IoEye />}
          </button>
        </div>
        {vaultApiKeyError && (
          <span className="form-error">{vaultApiKeyError}</span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="vaultName">Vault Name</label>
        <input
          id="vaultName"
          type="text"
          value={vaultName}
          onChange={(e) => {
            setVaultName(e.target.value);
            markDirty();
          }}
          placeholder="My Vault"
        />
        <span className="form-hint">
          Used for "View in Obsidian" links. Must match your vault name exactly.
        </span>
      </div>

      <div className="form-group">
        <label>Vault Organization</label>
        <div className="radio-group">
          <label className="radio-option">
            <input
              type="radio"
              name="vaultOrganization"
              value="para"
              checked={vaultOrganization === "para"}
              onChange={() => {
                setVaultOrganization("para");
                markDirty();
              }}
            />
            <span>PARA</span>
          </label>
          <label className="radio-option">
            <input
              type="radio"
              name="vaultOrganization"
              value="custom"
              checked={vaultOrganization === "custom"}
              onChange={() => {
                setVaultOrganization("custom");
                markDirty();
              }}
            />
            <span>Custom</span>
          </label>
        </div>
        {vaultOrganization === "para" && (
          <div className="para-description">
            {Object.entries(PARA_DESCRIPTIONS).map(([folder, desc]) => (
              <div key={folder} className="para-folder-desc">
                <strong>{folder}</strong>: {desc}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="form-group">
        <label>Summary Detail Level</label>
        <div className="radio-group summary-detail-group">
          {SUMMARY_DETAIL_OPTIONS.map((option) => (
            <label key={option.value} className="radio-option summary-detail-option">
              <input
                type="radio"
                name="summaryDetailLevel"
                value={option.value}
                checked={summaryDetailLevel === option.value}
                onChange={() => {
                  setSummaryDetailLevel(option.value);
                  markDirty();
                }}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
        <span className="form-hint">
          {SUMMARY_DETAIL_OPTIONS.find((o) => o.value === summaryDetailLevel)?.description}
        </span>
      </div>

      <div className="form-group">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <label>Tag Groups</label>
          <a
            href="https://2vault.dev/#tag-groups"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:text-primary-hover"
            style={{ fontSize: '13px', textDecoration: 'none' }}
          >
            Learn more →
          </a>
        </div>
        <span className="form-hint">
          Define tag groups for consistent categorization. The AI will prefer
          tags from these groups.
        </span>
        <TagGroupEditor
          tagGroups={tagGroups}
          onChange={(groups) => {
            setTagGroups(groups);
            markDirty();
          }}
        />
      </div>

      {(llmStatus === "error" || vaultStatus === "error") && (
        <div className="connection-results">
          {llmStatus === "error" && (
            <div className="connection-result">
              <span>OpenRouter API:</span>
              <span className="status-error">
                {apiKey ? "Connection failed" : "No API key"}
              </span>
            </div>
          )}
          {vaultStatus === "error" && (
            <div className="connection-result">
              <span>Obsidian Vault:</span>
              <span className="status-error">
                {vaultApiKey ? (vaultErrorMsg || "Connection failed") : "No API key"}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="form-actions">
        <button
          className="btn btn-primary"
          onClick={handleSaveSettings}
          disabled={
            saveStatus === "saving" ||
            llmStatus === "testing" ||
            vaultStatus === "testing" ||
            !!apiKeyError ||
            !!vaultApiKeyError
          }
        >
          {saveStatus === "saving" || llmStatus === "testing" || vaultStatus === "testing"
            ? "Saving..."
            : "Save Settings"}
        </button>

        {saveStatus === "saved" && (
          <span className="status-success">Settings saved successfully</span>
        )}
      </div>
    </div>
  );
}
