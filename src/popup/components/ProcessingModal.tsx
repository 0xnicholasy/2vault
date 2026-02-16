import { useState, useEffect, useCallback } from "react";
import type { ProcessingState } from "@/background/messages.ts";
import { getProcessingState } from "@/utils/storage";
import { StatusIcon, getUrlStatus, formatUrl } from "@/popup/utils/processing-ui";

interface ProcessingModalProps {
  initialState: ProcessingState;
  onClose: () => void;
}

export function ProcessingModal({ initialState, onClose }: ProcessingModalProps) {
  const [state, setState] = useState<ProcessingState>(initialState);

  useEffect(() => {
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string
    ) => {
      if (area === "local" && changes["processingState"]?.newValue) {
        setState(changes["processingState"].newValue as ProcessingState);
      }
    };

    chrome.storage.onChanged.addListener(listener);

    // Also poll once on mount in case we missed an update
    getProcessingState().then((s) => {
      if (s) setState(s);
    });

    return () => {
      chrome.storage.onChanged.removeListener(listener);
    };
  }, []);

  const handleCancel = useCallback(() => {
    chrome.runtime.sendMessage({ type: "CANCEL_PROCESSING" });
  }, []);

  const completed = state.results.length;
  const total = state.urls.length;
  const successCount = state.results.filter((r) => r.status === "success").length;
  const failedCount = state.results.filter((r) => r.status === "failed").length;
  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const isDone = !state.active;

  return (
    <div className="processing-modal-backdrop">
      <div className="processing-modal">
        <div className="processing-modal-header">
          <h2>{isDone ? "Processing Complete" : "Processing Bookmarks"}</h2>
        </div>

        {state.error && (
          <div className="batch-error-banner" role="alert">
            Processing failed: {state.error}
          </div>
        )}

        <div className="progress-section">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="progress-text">
            {completed} / {total} URLs
            {isDone && (
              <span className="progress-summary">
                {" "}- {successCount} saved, {failedCount} failed
              </span>
            )}
          </div>
        </div>

        <div className="url-status-list">
          {state.urls.map((url, index) => {
            const status = getUrlStatus(url, index, state);
            const result = state.results.find((r) => r.url === url);
            const errorMsg = result?.status === "failed" ? result.error : undefined;
            return (
              <div key={`${index}-${url}`} className={`url-status-row url-status-${status}`}>
                <div className="url-status-main">
                  <StatusIcon status={status} />
                  <span className="url-status-text">{formatUrl(url)}</span>
                  <span className="url-status-label">{status}</span>
                </div>
                {errorMsg && (
                  <div className="error-details">{errorMsg}</div>
                )}
              </div>
            );
          })}
        </div>

        <div className="processing-modal-actions">
          {state.active ? (
            <button className="btn btn-secondary" onClick={handleCancel}>
              Cancel
            </button>
          ) : (
            <button className="btn btn-primary" onClick={onClose}>
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
