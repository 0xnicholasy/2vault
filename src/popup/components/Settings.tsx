import { useState, useEffect, useCallback } from "react";
import { IoEye, IoEyeOff } from "react-icons/io5";
import { VaultClient } from "@/core/vault-client";
import { getConfig, setSyncStorage } from "@/utils/storage";
import { DEFAULT_VAULT_URL, DEFAULT_FOLDER } from "@/utils/config";

type ConnectionStatus = "idle" | "testing" | "success" | "error";
type SaveStatus = "idle" | "saving" | "saved";

export function Settings() {
  const [apiKey, setApiKey] = useState("");
  const [vaultUrl, setVaultUrl] = useState(DEFAULT_VAULT_URL);
  const [vaultApiKey, setVaultApiKey] = useState("");
  const [defaultFolder, setDefaultFolder] = useState(DEFAULT_FOLDER);

  const [showApiKey, setShowApiKey] = useState(false);
  const [showVaultApiKey, setShowVaultApiKey] = useState(false);

  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("idle");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    getConfig().then((config) => {
      setApiKey(config.apiKey);
      setVaultUrl(config.vaultUrl);
      setVaultApiKey(config.vaultApiKey);
      setDefaultFolder(config.defaultFolder);
    });
  }, []);

  const markDirty = useCallback(() => {
    setDirty(true);
    setSaveStatus("idle");
  }, []);

  const handleTestConnection = useCallback(async () => {
    setConnectionStatus("testing");
    try {
      const client = new VaultClient(vaultUrl, vaultApiKey);
      const ok = await client.testConnection();
      setConnectionStatus(ok ? "success" : "error");
    } catch {
      setConnectionStatus("error");
    }
  }, [vaultUrl, vaultApiKey]);

  const handleSave = useCallback(async () => {
    setSaveStatus("saving");
    await Promise.all([
      setSyncStorage("apiKey", apiKey),
      setSyncStorage("vaultUrl", vaultUrl),
      setSyncStorage("vaultApiKey", vaultApiKey),
      setSyncStorage("defaultFolder", defaultFolder),
    ]);
    setDirty(false);
    setSaveStatus("saved");
  }, [apiKey, vaultUrl, vaultApiKey, defaultFolder]);

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
              setApiKey(e.target.value);
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
      </div>

      <div className="form-group">
        <label htmlFor="vaultUrl">Obsidian Vault URL</label>
        <input
          id="vaultUrl"
          type="text"
          value={vaultUrl}
          onChange={(e) => {
            setVaultUrl(e.target.value);
            markDirty();
          }}
          placeholder={DEFAULT_VAULT_URL}
        />
      </div>

      <div className="form-group">
        <label htmlFor="vaultApiKey">Obsidian Vault API Key</label>
        <div className="input-with-toggle">
          <input
            id="vaultApiKey"
            type={showVaultApiKey ? "text" : "password"}
            value={vaultApiKey}
            onChange={(e) => {
              setVaultApiKey(e.target.value);
              markDirty();
              setConnectionStatus("idle");
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

      <div className="form-actions">
        <button
          className="btn btn-secondary"
          onClick={handleTestConnection}
          disabled={connectionStatus === "testing" || !vaultUrl || !vaultApiKey}
        >
          {connectionStatus === "testing" ? "Testing..." : "Test Connection"}
        </button>

        {connectionStatus === "success" && (
          <span className="status-success">Connected</span>
        )}
        {connectionStatus === "error" && (
          <span className="status-error">Connection failed</span>
        )}
      </div>

      <div className="form-actions">
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saveStatus === "saving" || !dirty}
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
