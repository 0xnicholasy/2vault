import { useState, useEffect, useCallback } from "react";
import { IoEye, IoEyeOff } from "react-icons/io5";
import { VaultClient } from "@/core/vault-client";
import { testOpenRouterConnection } from "@/core/openrouter-provider";
import { getConfig, setSyncStorage } from "@/utils/storage";
import {
  DEFAULT_VAULT_URL,
  DEFAULT_FOLDER,
  PARA_DESCRIPTIONS,
  VAULT_URL_PRESETS,
} from "@/utils/config";
import type { VaultOrganization, TagGroup } from "@/core/types";
import { TagGroupEditor } from "@/popup/components/TagGroupEditor";
import { validateOpenRouterKey, validateVaultApiKey } from "@/utils/validation";

type ConnectionStatus = "idle" | "testing" | "success" | "error";
type SaveStatus = "idle" | "saving" | "saved";

export function Settings() {
  const [apiKey, setApiKey] = useState("");
  const [vaultUrl, setVaultUrl] = useState(DEFAULT_VAULT_URL);
  const [vaultApiKey, setVaultApiKey] = useState("");
  const [defaultFolder, setDefaultFolder] = useState(DEFAULT_FOLDER);
  const [vaultName, setVaultName] = useState("");
  const [vaultOrganization, setVaultOrganization] =
    useState<VaultOrganization>("para");
  const [tagGroups, setTagGroups] = useState<TagGroup[]>([]);

  const [showApiKey, setShowApiKey] = useState(false);
  const [showVaultApiKey, setShowVaultApiKey] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string>();
  const [vaultApiKeyError, setVaultApiKeyError] = useState<string>();
  const [vaultUrlPreset, setVaultUrlPreset] = useState(DEFAULT_VAULT_URL);

  const [llmStatus, setLlmStatus] = useState<ConnectionStatus>("idle");
  const [vaultStatus, setVaultStatus] = useState<ConnectionStatus>("idle");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    getConfig().then((config) => {
      setApiKey(config.apiKey);
      setVaultUrl(config.vaultUrl);
      setVaultApiKey(config.vaultApiKey);
      setDefaultFolder(config.defaultFolder);
      setVaultName(config.vaultName);
      setVaultOrganization(config.vaultOrganization);
      setTagGroups(config.tagGroups);
      // Derive preset from stored URL
      const matchingPreset = VAULT_URL_PRESETS.find(
        (p) => p.value === config.vaultUrl
      );
      setVaultUrlPreset(matchingPreset ? matchingPreset.value : "custom");
    });
  }, []);

  const markDirty = useCallback(() => {
    setDirty(true);
    setSaveStatus("idle");
    setLlmStatus("idle");
    setVaultStatus("idle");
  }, []);

  const handleTestConnection = useCallback(async () => {
    setLlmStatus("testing");
    setVaultStatus("testing");

    const [llmOk, vaultOk] = await Promise.all([
      apiKey
        ? testOpenRouterConnection(apiKey).catch(() => false)
        : Promise.resolve(false),
      vaultApiKey
        ? new VaultClient(vaultUrl, vaultApiKey)
            .testConnection()
            .catch(() => false)
        : Promise.resolve(false),
    ]);

    setLlmStatus(llmOk ? "success" : "error");
    setVaultStatus(vaultOk ? "success" : "error");
  }, [apiKey, vaultUrl, vaultApiKey]);

  const handleSave = useCallback(async () => {
    setSaveStatus("saving");
    await Promise.all([
      setSyncStorage("apiKey", apiKey),
      setSyncStorage("vaultUrl", vaultUrl),
      setSyncStorage("vaultApiKey", vaultApiKey),
      setSyncStorage("defaultFolder", defaultFolder),
      setSyncStorage("vaultName", vaultName),
      setSyncStorage("vaultOrganization", vaultOrganization),
      setSyncStorage("tagGroups", tagGroups),
    ]);
    setDirty(false);
    setSaveStatus("saved");
  }, [
    apiKey,
    vaultUrl,
    vaultApiKey,
    defaultFolder,
    vaultName,
    vaultOrganization,
    tagGroups,
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
        <label htmlFor="vaultUrlPreset">Obsidian Vault URL</label>
        <select
          id="vaultUrlPreset"
          value={vaultUrlPreset}
          onChange={(e) => {
            const selected = e.target.value;
            setVaultUrlPreset(selected);
            if (selected !== "custom") {
              setVaultUrl(selected);
            }
            markDirty();
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
            value={vaultUrl}
            onChange={(e) => {
              setVaultUrl(e.target.value);
              markDirty();
            }}
            placeholder="https://your-obsidian-url:port"
          />
        )}
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
        <label htmlFor="defaultFolder">Default Folder</label>
        <input
          id="defaultFolder"
          type="text"
          value={defaultFolder}
          onChange={(e) => {
            setDefaultFolder(e.target.value);
            markDirty();
          }}
          placeholder={DEFAULT_FOLDER}
        />
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
        <label>Tag Groups</label>
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

      <div className="form-actions">
        <button
          className="btn btn-secondary"
          onClick={handleTestConnection}
          disabled={llmStatus === "testing" || vaultStatus === "testing"}
        >
          {llmStatus === "testing" || vaultStatus === "testing"
            ? "Testing..."
            : "Test Connections"}
        </button>
      </div>

      {(llmStatus !== "idle" || vaultStatus !== "idle") && (
        <div className="connection-results">
          <div className="connection-result">
            <span>OpenRouter API:</span>
            {llmStatus === "testing" && (
              <span className="status-testing">Testing...</span>
            )}
            {llmStatus === "success" && (
              <span className="status-success">Connected</span>
            )}
            {llmStatus === "error" && (
              <span className="status-error">
                {apiKey ? "Connection failed" : "No API key"}
              </span>
            )}
          </div>
          <div className="connection-result">
            <span>Obsidian Vault:</span>
            {vaultStatus === "testing" && (
              <span className="status-testing">Testing...</span>
            )}
            {vaultStatus === "success" && (
              <span className="status-success">Connected</span>
            )}
            {vaultStatus === "error" && (
              <span className="status-error">
                {vaultApiKey ? "Connection failed" : "No API key"}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="form-actions">
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={
            saveStatus === "saving" ||
            !dirty ||
            !!apiKeyError ||
            !!vaultApiKeyError
          }
        >
          {saveStatus === "saving" ? "Saving..." : "Save Settings"}
        </button>

        {saveStatus === "saved" && (
          <span className="status-success">Saved</span>
        )}
      </div>
    </div>
  );
}
