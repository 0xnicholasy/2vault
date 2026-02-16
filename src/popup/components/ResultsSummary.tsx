import { useState } from "react";
import { IoRefresh, IoBookmarks, IoTrashOutline, IoOpenOutline } from "react-icons/io5";
import type { ProcessingResult } from "@/core/types";
import { formatUrl, buildObsidianUri } from "@/popup/utils/processing-ui";

type Filter = "all" | "failures";

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

  if (results.length === 0) {
    return (
      <div className="results-summary">
        <div className="empty-state">No processing history yet</div>
      </div>
    );
  }

  const failedResults = results.filter((r) => r.status === "failed");
  const failedUrls = failedResults.map((r) => r.url);
  const allFailed = failedResults.length === results.length;
  const hasFailures = failedResults.length > 0;

  const displayed = filter === "failures" ? failedResults : results;

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
          {displayed.map((result) => (
            <tr key={result.url}>
              <td title={result.url}>{formatUrl(result.url)}</td>
              <td>{result.folder ?? "-"}</td>
              <td>
                <span className={`status-badge status-badge-${result.status}`}>
                  {result.status}
                </span>
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
          ))}
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
