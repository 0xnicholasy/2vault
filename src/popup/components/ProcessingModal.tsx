import { useState, useEffect, useCallback } from "react";
import type { ProcessingState } from "@/background/messages.ts";
import { getProcessingState } from "@/utils/storage";
import { StatusIcon, getUrlStatus, formatUrl, statusDisplayLabel } from "@/popup/utils/processing-ui";

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

  const TERMINAL_STATUSES = new Set(["done", "failed", "skipped", "review", "timeout", "cancelled"]);
  const total = state.urls.length;
  const completed = state.urls.filter((url) => TERMINAL_STATUSES.has(state.urlStatuses[url] ?? "queued")).length;
  const successCount = state.urls.filter((url) => state.urlStatuses[url] === "done").length;
  const reviewCount = state.urls.filter((url) => state.urlStatuses[url] === "review").length;
  const failedCount = state.urls.filter((url) => state.urlStatuses[url] === "failed").length;
  const timeoutCount = state.urls.filter((url) => state.urlStatuses[url] === "timeout").length;
  const cancelledCount = state.urls.filter((url) => state.urlStatuses[url] === "cancelled").length;
  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const isDone = !state.active;

  return (
    <div className="processing-modal-backdrop">
      <div className="processing-modal">
        <div className="processing-modal-header">
          <h2>{isDone ? (state.cancelled ? "Processing Cancelled" : "Processing Complete") : "Processing Bookmarks"}</h2>
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
                {" "}- {successCount} saved{reviewCount > 0 ? `, ${reviewCount} needs review` : ""}{timeoutCount > 0 ? `, ${timeoutCount} timed out` : ""}{failedCount > 0 ? `, ${failedCount} failed` : ""}{cancelledCount > 0 ? `, ${cancelledCount} cancelled` : ""}
              </span>
            )}
          </div>
        </div>

        <div className="url-status-list">
          {state.urls.map((url, index) => {
            const status = getUrlStatus(url, state);
            const result = state.results.find((r) => r.url === url);
            const errorMsg = (result?.status === "failed" || result?.status === "timeout") ? result.error : undefined;
            return (
              <div key={`${index}-${url}`} className={`url-status-row url-status-${status}`}>
                <div className="url-status-main">
                  <StatusIcon status={status} />
                  <span className="url-status-text">{formatUrl(url)}</span>
                  <span className="url-status-label">{statusDisplayLabel(status)}</span>
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
