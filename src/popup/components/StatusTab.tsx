import { useState, useEffect, useCallback } from "react";
import type { ProcessingState } from "@/background/messages";
import type { ProcessingResult } from "@/core/types";
import { getConfig, getProcessingHistory, clearProcessingHistory } from "@/utils/storage";
import { ProcessingStatus } from "./ProcessingStatus";
import { ResultsSummary } from "./ResultsSummary";

type Tab = "settings" | "bookmarks" | "status";

interface StatusTabProps {
  processingState: ProcessingState | null;
  onProcess: (urls: string[]) => void;
  onSwitchTab: (tab: Tab) => void;
}

export function StatusTab({ processingState, onProcess, onSwitchTab }: StatusTabProps) {
  const [history, setHistory] = useState<ProcessingResult[]>([]);
  const [vaultName, setVaultName] = useState("");
  const [configValid, setConfigValid] = useState(true);

  useEffect(() => {
    getConfig().then((config) => {
      setVaultName(config.vaultName);
      setConfigValid(!!config.apiKey && !!config.vaultApiKey);
    });
    getProcessingHistory().then(setHistory);
  }, []);

  // Refresh history when processing state changes
  useEffect(() => {
    if (processingState && !processingState.active) {
      getProcessingHistory().then(setHistory);
    }
  }, [processingState]);

  // Listen for storage changes to history
  useEffect(() => {
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string
    ) => {
      if (area === "local" && changes["processingHistory"]?.newValue) {
        setHistory(changes["processingHistory"].newValue as ProcessingResult[]);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const handleCancel = useCallback(() => {
    chrome.runtime.sendMessage({ type: "CANCEL_PROCESSING" });
  }, []);

  const handleRetry = useCallback(
    (urls: string[]) => {
      onProcess(urls);
    },
    [onProcess]
  );

  const handleProcessMore = useCallback(() => {
    onSwitchTab("bookmarks");
  }, [onSwitchTab]);

  const handleClearHistory = useCallback(() => {
    clearProcessingHistory().then(() => setHistory([]));
  }, []);

  if (!configValid) {
    return (
      <div className="config-guard-inline">
        <p>Configure your API keys to start processing bookmarks.</p>
        <button className="btn btn-primary btn-sm" onClick={() => onSwitchTab("settings")}>
          Go to Settings
        </button>
      </div>
    );
  }

  return (
    <div className="status-tab">
      {processingState?.active && (
        <ProcessingStatus
          state={processingState}
          vaultName={vaultName}
          onCancel={handleCancel}
        />
      )}
      <ResultsSummary
        results={history}
        vaultName={vaultName}
        onRetry={handleRetry}
        onProcessMore={handleProcessMore}
        onClearHistory={handleClearHistory}
      />
    </div>
  );
}
