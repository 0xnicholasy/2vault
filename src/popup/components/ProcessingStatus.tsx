import { useState } from "react";
import { IoChevronDown, IoChevronForward, IoOpenOutline } from "react-icons/io5";
import type { ProcessingState } from "@/background/messages.ts";
import { StatusIcon, getUrlStatus, formatUrl, buildObsidianUri, statusDisplayLabel } from "@/popup/utils/processing-ui";

interface ProcessingStatusProps {
  state: ProcessingState;
  vaultName: string;
  onCancel: () => void;
}

export function ProcessingStatus({ state, vaultName, onCancel }: ProcessingStatusProps) {
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());

  const TERMINAL_STATUSES = new Set(["done", "failed", "skipped", "review", "timeout", "cancelled"]);
  const total = state.urls.length;
  const completed = state.urls.filter((url) => TERMINAL_STATUSES.has(state.urlStatuses[url] ?? "queued")).length;
  const successCount = state.urls.filter((url) => state.urlStatuses[url] === "done").length;
  const reviewCount = state.urls.filter((url) => state.urlStatuses[url] === "review").length;
  const failedCount = state.urls.filter((url) => state.urlStatuses[url] === "failed").length;
  const timeoutCount = state.urls.filter((url) => state.urlStatuses[url] === "timeout").length;
  const skippedCount = state.urls.filter((url) => state.urlStatuses[url] === "skipped").length;
  const cancelledCount = state.urls.filter((url) => state.urlStatuses[url] === "cancelled").length;
  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const isDone = !state.active;

  const toggleError = (url: string) => {
    setExpandedErrors((prev) => {
      const next = new Set(prev);
      if (next.has(url)) {
        next.delete(url);
      } else {
        next.add(url);
      }
      return next;
    });
  };

  return (
    <div className="processing-status">
      <h3 className="processing-status-title">
        {isDone ? (state.cancelled ? "Processing Cancelled" : "Processing Complete") : "Processing Bookmarks..."}
      </h3>

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
              {" "}- {successCount} saved{reviewCount > 0 ? `, ${reviewCount} saved (needs review)` : ""}{timeoutCount > 0 ? `, ${timeoutCount} timed out` : ""}{failedCount > 0 ? `, ${failedCount} failed` : ""}{skippedCount > 0 ? `, ${skippedCount} skipped` : ""}{cancelledCount > 0 ? `, ${cancelledCount} cancelled` : ""}
            </span>
          )}
        </div>
      </div>

      <div className="url-status-list">
        {state.urls.map((url, index) => {
          const status = getUrlStatus(url, state);
          const result = state.results.find((r) => r.url === url);
          const hasError = (result?.status === "failed" || result?.status === "timeout") && result.error;
          const isExpanded = expandedErrors.has(url);
          const isSuccess = result?.status === "success" || result?.status === "review";

          return (
            <div key={`${index}-${url}`} className={`url-status-row url-status-${status}`}>
              <div className="url-status-main">
                <StatusIcon status={status} />
                <span className="url-status-text">{formatUrl(url)}</span>
                <span className="url-status-label">{statusDisplayLabel(status)}</span>
                {hasError && (
                  <button
                    className="error-toggle"
                    onClick={() => toggleError(url)}
                    aria-label={isExpanded ? "Hide error details" : "Show error details"}
                  >
                    {isExpanded ? <IoChevronDown /> : <IoChevronForward />}
                  </button>
                )}
                {isSuccess && vaultName && result.note && (
                  <a
                    className="obsidian-link"
                    href={buildObsidianUri(
                      vaultName,
                      result.folder ?? result.note.suggestedFolder,
                      result.note.title
                    )}
                    title="View in Obsidian"
                  >
                    <IoOpenOutline />
                  </a>
                )}
              </div>
              {hasError && isExpanded && (
                <div className="error-details">{result.error}</div>
              )}
            </div>
          );
        })}
      </div>

      {state.active && (
        <div className="processing-status-actions">
          <button className="btn btn-secondary btn-sm" onClick={onCancel}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
