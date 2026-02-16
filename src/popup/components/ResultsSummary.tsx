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
import type { ProcessingResult } from "@/core/types";
import { formatUrl, buildObsidianUri } from "@/popup/utils/processing-ui";
import { ERROR_SUGGESTIONS } from "@/utils/error-suggestions";

type Filter = "all" | "failures" | "skipped";

interface ResultsSummaryProps {
  results: ProcessingResult[];
  vaultName: string;
  onRetry: (urls: string[]) => void;
  onProcessMore: () => void;
  onClearHistory: () => void;
}

export function ResultsSummary({
  results,
  vaultName,
  onRetry,
  onProcessMore,
  onClearHistory,
}: ResultsSummaryProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  if (results.length === 0) {
    return (
      <div className="results-summary">
        <div className="empty-state">No processing history yet</div>
      </div>
    );
  }

  const failedResults = results.filter((r) => r.status === "failed");
  const skippedResults = results.filter((r) => r.status === "skipped");
  const failedUrls = failedResults.map((r) => r.url);
  const allFailed = failedResults.length === results.length;
  const hasFailures = failedResults.length > 0;
  const hasSkipped = skippedResults.length > 0;

  const displayed =
    filter === "failures"
      ? failedResults
      : filter === "skipped"
        ? skippedResults
        : results;

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
              onClick={() => onRetry(failedUrls)}
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
            const isFailed = result.status === "failed";
            const isExpanded = expandedRows.has(index);
            const category = result.errorCategory ?? "unknown";

            return (
              <tr
                key={`${index}-${result.url}`}
                className={isFailed ? "error-row-expandable" : ""}
                title={isFailed ? "Click to expand error details" : undefined}
                onClick={isFailed ? () => toggleRow(index) : undefined}
              >
                <td title={result.url}>{formatUrl(result.url)}</td>
                <td>{result.folder ?? "-"}</td>
                <td>
                  <span
                    className={`status-badge status-badge-${isFailed ? category : result.status}`}
                  >
                    {isFailed ? category : result.status}
                  </span>
                  {isFailed && (
                    <span className="error-toggle-icon">
                      {isExpanded ? (
                        <IoChevronDown />
                      ) : (
                        <IoChevronForward />
                      )}
                    </span>
                  )}
                  {isFailed && isExpanded && (
                    <div className="error-expanded-details">
                      <div className="error-message">{result.error}</div>
                      <div className="error-suggestion">
                        {ERROR_SUGGESTIONS[category]}
                      </div>
                      <div className="error-actions">
                        <button
                          className="copy-url-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(result.url);
                          }}
                        >
                          <IoCopy /> Copy URL
                        </button>
                      </div>
                    </div>
                  )}
                </td>
                {vaultName && (
                  <td>
                    {result.status === "success" && result.note && (
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
        {hasFailures && !allFailed && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onRetry(failedUrls)}
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
