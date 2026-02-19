import { useState } from "react";
import {
  IoRefresh,
  IoBookmarks,
  IoTrashOutline,
  IoOpenOutline,
  IoCopy,
  IoChevronDown,
  IoChevronForward,
} from "react-icons/io5";
import type { ProcessingResult, ContentQualityReason } from "@/core/types";
import { formatUrl, buildObsidianUri } from "@/popup/utils/processing-ui";
import { ErrorDisplay, ReviewDisplay } from "./ErrorDisplay";

type Filter = "all" | "failures" | "timeout" | "skipped" | "review";
type Tab = "settings" | "bookmarks" | "status";

interface ResultsSummaryProps {
  results: ProcessingResult[];
  vaultName: string;
  onRetry: (urls: string[]) => void;
  onProcessMore: () => void;
  onClearHistory: () => void;
  onSwitchTab?: (tab: Tab) => void;
  onRemoveResult?: (url: string) => void;
  onSkipResult?: (url: string) => void;
}

export function ResultsSummary({
  results,
  vaultName,
  onRetry,
  onProcessMore,
  onClearHistory,
  onSwitchTab,
  onRemoveResult,
  onSkipResult,
}: ResultsSummaryProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  if (results.length === 0) {
    return (
      <div className="results-summary">
        <div className="empty-state">No processing history yet</div>
      </div>
    );
  }

  const failedResults = results.filter((r) => r.status === "failed");
  const timeoutResults = results.filter((r) => r.status === "timeout");
  const skippedResults = results.filter((r) => r.status === "skipped");
  const reviewResults = results.filter((r) => r.status === "review");
  const retryUrls = [...failedResults, ...timeoutResults].map((r) => r.url);
  const allFailed = failedResults.length === results.length;
  const hasFailures = failedResults.length > 0;
  const hasTimeout = timeoutResults.length > 0;
  const hasSkipped = skippedResults.length > 0;
  const hasReview = reviewResults.length > 0;

  const displayed =
    filter === "failures"
      ? failedResults
      : filter === "timeout"
        ? timeoutResults
        : filter === "skipped"
          ? skippedResults
          : filter === "review"
            ? reviewResults
            : results;

  const handleCopyUrl = (url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const toggleRow = (index: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleOpenUrl = (url: string) => {
    chrome.tabs.create({ url });
  };

  const handleGoToSettings = () => {
    if (onSwitchTab) {
      onSwitchTab("settings");
    }
  };

  const handleSkip = (url: string) => {
    if (onSkipResult) {
      onSkipResult(url);
    }
  };

  const handleRemove = (url: string) => {
    if (onRemoveResult) {
      onRemoveResult(url);
    }
  };

  const handleRetryUrl = (url: string) => {
    onRetry([url]);
  };

  // Helper to determine if an error is retriable
  const isRetriableError = (category: string): boolean => {
    return ["network", "timeout", "llm", "vault", "unknown", "extraction"].includes(category);
  };

  // Helper to get user-friendly status label
  const getStatusLabel = (result: ProcessingResult): string => {
    if (result.status === "failed" || result.status === "timeout") {
      const category = result.errorCategory ?? "unknown";

      // Map error categories to user-friendly labels
      const labelMap: Record<string, string> = {
        network: "Connection Error",
        "login-required": "Login Required",
        "bot-protection": "Bot Protection",
        "page-not-found": "Page Not Found",
        extraction: "Couldn't Read Page",
        llm: "API Error",
        vault: "Vault Error",
        timeout: "Timed Out",
        unknown: "Unknown Error"
      };

      return labelMap[category] || category;
    }

    if (result.status === "review" && result.contentQuality?.reason) {
      const reasonMap: Record<string, string> = {
        "login-wall": "Requires Login",
        "bot-protection": "Bot Protection",
        "soft-404": "Page Not Found",
        "deleted-content": "Content Deleted",
        "insufficient-content": "Very Little Content",
        "error-page": "Error Page"
      };

      return reasonMap[result.contentQuality.reason] || "Review";
    }

    // Capitalize first letter for other statuses
    return result.status.charAt(0).toUpperCase() + result.status.slice(1);
  };

  return (
    <div className="results-summary">
      {allFailed && (
        <div className="all-failed-banner">
          <p>All URLs failed to process</p>
          <ul>
            <li>Check your OpenRouter API key in Settings</li>
            <li>Verify Obsidian is running with the REST API plugin</li>
            <li>Check your internet connection</li>
          </ul>
          <div className="all-failed-banner-actions">
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onRetry(retryUrls)}
            >
              <IoRefresh /> Retry All
            </button>
          </div>
        </div>
      )}

      <div className="results-summary-header">
        <h3>Results ({results.length})</h3>
        <div className="results-filters">
          <button
            className={`filter-btn ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All
          </button>
          <button
            className={`filter-btn ${filter === "failures" ? "active" : ""}`}
            onClick={() => setFilter("failures")}
          >
            Failures ({failedResults.length})
          </button>
          {hasTimeout && (
            <button
              className={`filter-btn ${filter === "timeout" ? "active" : ""}`}
              onClick={() => setFilter("timeout")}
            >
              Timed Out ({timeoutResults.length})
            </button>
          )}
          {hasReview && (
            <button
              className={`filter-btn ${filter === "review" ? "active" : ""}`}
              onClick={() => setFilter("review")}
            >
              Review ({reviewResults.length})
            </button>
          )}
          {hasSkipped && (
            <button
              className={`filter-btn ${filter === "skipped" ? "active" : ""}`}
              onClick={() => setFilter("skipped")}
            >
              Skipped ({skippedResults.length})
            </button>
          )}
        </div>
      </div>

      <table className="results-table">
        <thead>
          <tr>
            <th>URL</th>
            <th>Folder</th>
            <th>Status</th>
            {vaultName && <th></th>}
          </tr>
        </thead>
        <tbody>
          {displayed.map((result, index) => {
            const isFailed = result.status === "failed" || result.status === "timeout";
            const isReview = result.status === "review";
            const isSkipped = result.status === "skipped";
            const isExpandable = isFailed || isReview || (isSkipped && result.skipReason);
            const isExpanded = expandedRows.has(index);
            const category = result.errorCategory ?? "unknown";
            const qualityReason = result.contentQuality?.reason;

            return (
              <tr
                key={`${index}-${result.url}`}
                className={isExpandable ? "error-row-expandable" : ""}
                title={isExpandable ? "Click to expand details" : undefined}
                onClick={isExpandable ? () => toggleRow(index) : undefined}
              >
                <td
                  className="url-cell"
                  title={result.url}
                  onClick={(e) => handleCopyUrl(result.url, e)}
                >
                  {copiedUrl === result.url ? (
                    <span className="url-copied">Copied!</span>
                  ) : (
                    formatUrl(result.url)
                  )}
                </td>
                <td>{result.folder ?? "-"}</td>
                <td>
                  <span
                    className={`status-badge status-badge-${isFailed ? category : result.status}`}
                  >
                    {getStatusLabel(result)}
                  </span>
                  {isExpandable && (
                    <span className="error-toggle-icon">
                      {isExpanded ? (
                        <IoChevronDown />
                      ) : (
                        <IoChevronForward />
                      )}
                    </span>
                  )}
                  {isFailed && isExpanded && (
                    <ErrorDisplay
                      category={category}
                      errorMessage={result.error || "No error message available"}
                      url={result.url}
                      isRetryable={isRetriableError(category)}
                      onRetry={() => handleRetryUrl(result.url)}
                      onSkip={() => handleSkip(result.url)}
                      onOpenUrl={() => handleOpenUrl(result.url)}
                      onRemove={() => handleRemove(result.url)}
                      onGoToSettings={handleGoToSettings}
                    />
                  )}
                  {isReview && isExpanded && qualityReason && (
                    <ReviewDisplay
                      qualityReason={qualityReason}
                      qualityDetail={result.contentQuality?.detail}
                      url={result.url}
                      onSkip={() => handleSkip(result.url)}
                      onRemove={() => handleRemove(result.url)}
                      onOpenUrl={() => handleOpenUrl(result.url)}
                    />
                  )}
                  {isSkipped && isExpanded && result.skipReason && (
                    <div className="skip-expanded-details">
                      <div className="skip-reason-text">{result.skipReason}</div>
                      <div className="error-actions">
                        {onRemoveResult && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemove(result.url);
                            }}
                            title="Remove from results"
                          >
                            <IoTrashOutline /> Remove
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </td>
                {vaultName && (
                  <td>
                    {(result.status === "success" || result.status === "review") && result.note && (
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
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="results-actions">
        {(hasFailures || hasTimeout) && !allFailed && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onRetry(retryUrls)}
          >
            <IoRefresh /> Retry Failed
          </button>
        )}
        <button className="btn btn-secondary btn-sm" onClick={onProcessMore}>
          <IoBookmarks /> Process More
        </button>
        <button className="btn btn-secondary btn-sm" onClick={onClearHistory}>
          <IoTrashOutline /> Clear History
        </button>
      </div>
    </div>
  );
}
