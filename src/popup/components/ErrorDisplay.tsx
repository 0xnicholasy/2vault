import { IoRefresh, IoCopy, IoTrash, IoSettings, IoOpenOutline } from "react-icons/io5";
import type { ErrorCategory, ContentQualityReason } from "@/core/types";

export interface ErrorDisplayProps {
  category: ErrorCategory;
  errorMessage: string;
  url: string;
  isRetryable: boolean;
  onRetry?: () => void;
  onSkip?: () => void;
  onOpenUrl?: () => void;
  onRemove?: () => void;
  onGoToSettings?: () => void;
}

export interface ReviewDisplayProps {
  qualityReason: ContentQualityReason;
  qualityDetail?: string;
  url: string;
  onSkip?: () => void;
  onRemove?: () => void;
  onOpenUrl?: () => void;
}

// Error message mapping based on ERROR-MESSAGES-REFERENCE.md
const ERROR_MESSAGES: Record<ErrorCategory, {
  label: string;
  userMessage: string;
  steps: string[];
  helpLink?: string;
}> = {
  network: {
    label: "Connection Error",
    userMessage: "Your device couldn't reach the URL. This usually means:",
    steps: [
      "Your internet connection is offline or unstable",
      "The website is temporarily down",
      "The website blocked this request",
      "The URL might be invalid or have a typo"
    ],
    helpLink: "#"
  },
  "login-required": {
    label: "Login Required",
    userMessage: "This webpage requires you to be logged in. We can't access content that's behind a login wall.",
    steps: [
      "Log in to the website in your browser",
      "Select and copy the article text or content",
      "Use the Direct URL input in the extension",
      "Use the keyboard shortcut Cmd+Shift+Z while reading the page"
    ],
    helpLink: "#"
  },
  "bot-protection": {
    label: "Bot Protection Blocked",
    userMessage: "This website uses security technology (Cloudflare, reCAPTCHA, etc.) that blocked our automated access.",
    steps: [
      "Use the keyboard shortcut Cmd+Shift+Z while viewing the page in your browser",
      "Select and copy the text, then use Direct URL input",
      "Check if the website offers an RSS feed",
      "Contact the website owner if you think this is a mistake"
    ],
    helpLink: "#"
  },
  "page-not-found": {
    label: "Page Not Found",
    userMessage: "The URL doesn't exist or was deleted. (Error: 404)",
    steps: [
      "Try opening the URL in your browser",
      "Check if the URL is correct (typo, trailing slash, etc.)",
      "Try the website's homepage to see if it's still running",
      "Check the Wayback Machine (archive.org) to see if the page was archived"
    ],
    helpLink: "#"
  },
  extraction: {
    label: "Couldn't Read Page",
    userMessage: "We downloaded the page but couldn't extract readable content.",
    steps: [
      "The page requires JavaScript to load content (we don't render JS)",
      "The page has minimal text content (mostly images)",
      "The page uses unusual formatting or layout",
      "The page is intentionally obfuscated"
    ],
    helpLink: "#"
  },
  llm: {
    label: "API Error",
    userMessage: "2Vault couldn't process this content with the OpenRouter API.",
    steps: [
      "Your API key is invalid or expired",
      "Your account ran out of credits",
      "You've hit the API rate limit",
      "OpenRouter service is temporarily down"
    ],
    helpLink: "#"
  },
  vault: {
    label: "Vault Error",
    userMessage: "2Vault couldn't connect to your Obsidian vault.",
    steps: [
      "Obsidian isn't running",
      "The Local REST API plugin is disabled",
      "Your vault URL or API key is wrong in Settings",
      "Your vault is read-only"
    ],
    helpLink: "#"
  },
  timeout: {
    label: "Timed Out",
    userMessage: "The webpage took too long to load and we gave up after 30 seconds.",
    steps: [
      "The website is very slow or temporarily down",
      "The page loads heavy JavaScript or many images",
      "Your internet connection is slow",
      "The site is rate-limiting requests (as a protection measure)"
    ],
    helpLink: "#"
  },
  unknown: {
    label: "Unknown Error",
    userMessage: "Something unexpected happened. We're not sure why.",
    steps: [
      "Retry this URL (might have been a temporary glitch)",
      "Copy this error code for your bug report",
      "Check if other URLs process normally",
      "Report this on GitHub if it keeps happening"
    ],
    helpLink: "#"
  }
};

// Quality reason message mapping
const QUALITY_MESSAGES: Record<ContentQualityReason, {
  label: string;
  userMessage: string;
  steps: string[];
}> = {
  "login-wall": {
    label: "Requires Login",
    userMessage: "We extracted some content, but the page seems to require login.",
    steps: [
      "Log in to the website in your browser",
      "Select and copy the article text or content",
      "Use the Direct URL input in the extension",
      "Use the keyboard shortcut Cmd+Shift+Z while reading the page"
    ]
  },
  "bot-protection": {
    label: "Bot Protection Detected",
    userMessage: "We extracted content, but the page appears to have bot protection.",
    steps: [
      "Try the keyboard shortcut Cmd+Shift+Z (while viewing in browser)",
      "Or manually copy-paste better content and use Direct URL input"
    ]
  },
  "soft-404": {
    label: "Page Not Found",
    userMessage: "This page appears to be deleted or no longer exists.",
    steps: [
      "Check the Wayback Machine to see older versions",
      "Skip it",
      "Review and save anyway"
    ]
  },
  "deleted-content": {
    label: "Content Deleted",
    userMessage: "The original content appears to have been removed from the website.",
    steps: [
      "Skip it",
      "Review and save the partial content",
      "Check archive.org for the full version"
    ]
  },
  "insufficient-content": {
    label: "Very Little Content",
    userMessage: "We extracted very little readable content from this page.",
    steps: [
      "Review what we extracted",
      "Copy-paste better content yourself",
      "Skip it"
    ]
  },
  "error-page": {
    label: "Error Page Detected",
    userMessage: "The page returned an error instead of content.",
    steps: [
      "Retry later (site might be back up)",
      "Check the URL in your browser",
      "Skip for now"
    ]
  }
};

export function ErrorDisplay({
  category,
  errorMessage,
  url,
  isRetryable,
  onRetry,
  onSkip,
  onOpenUrl,
  onRemove,
  onGoToSettings
}: ErrorDisplayProps) {
  const errorInfo = ERROR_MESSAGES[category];
  const showSettingsButton = category === "llm" || category === "vault";

  return (
    <div className="error-expanded-details">
      <div className="error-header">
        <strong>Error: {errorInfo.label}</strong>
      </div>

      <div className="error-body">
        <p>{errorInfo.userMessage}</p>

        {errorInfo.steps.length > 0 && (
          <ul className="error-steps">
            {errorInfo.steps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ul>
        )}

        <div className="error-technical">
          <strong>Technical details:</strong>
          <div className="error-message">{errorMessage}</div>
        </div>

        {errorInfo.helpLink && (
          <a href={errorInfo.helpLink} className="error-help-link" target="_blank" rel="noopener noreferrer">
            Learn more →
          </a>
        )}
      </div>

      <div className="error-actions">
        {isRetryable && onRetry && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              onRetry();
            }}
            title="Retry processing this URL"
          >
            <IoRefresh /> Retry
          </button>
        )}

        {onOpenUrl && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              onOpenUrl();
            }}
            title="Open URL in new tab"
          >
            <IoOpenOutline /> Open
          </button>
        )}

        <button
          className="copy-url-btn"
          onClick={(e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(url);
          }}
          title="Copy URL to clipboard"
        >
          <IoCopy /> Copy URL
        </button>

        {showSettingsButton && onGoToSettings && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              onGoToSettings();
            }}
            title="Go to Settings to fix configuration"
          >
            <IoSettings /> Settings
          </button>
        )}

        {onSkip && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              onSkip();
            }}
            title="Skip this URL"
          >
            Skip
          </button>
        )}

        {onRemove && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            title="Remove from results"
          >
            <IoTrash /> Remove
          </button>
        )}
      </div>
    </div>
  );
}

export function ReviewDisplay({
  qualityReason,
  qualityDetail,
  url,
  onSkip,
  onRemove,
  onOpenUrl
}: ReviewDisplayProps) {
  const qualityInfo = QUALITY_MESSAGES[qualityReason];

  return (
    <div className="review-expanded-details">
      <div className="review-header">
        <strong>Status: {qualityInfo.label}</strong>
      </div>

      <div className="review-body">
        <p>{qualityInfo.userMessage}</p>

        {qualityDetail && (
          <div className="review-detail">{qualityDetail}</div>
        )}

        {qualityInfo.steps.length > 0 && (
          <div className="review-suggestions">
            <strong>You can:</strong>
            <ol className="review-steps">
              {qualityInfo.steps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          </div>
        )}
      </div>

      <div className="error-actions">
        {onOpenUrl && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              onOpenUrl();
            }}
            title="Open URL in new tab"
          >
            <IoOpenOutline /> Open
          </button>
        )}

        <button
          className="copy-url-btn"
          onClick={(e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(url);
          }}
          title="Copy URL to clipboard"
        >
          <IoCopy /> Copy URL
        </button>

        {onSkip && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              onSkip();
            }}
            title="Skip this URL"
          >
            Skip
          </button>
        )}

        {onRemove && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            title="Remove from results"
          >
            <IoTrash /> Remove
          </button>
        )}
      </div>
    </div>
  );
}
