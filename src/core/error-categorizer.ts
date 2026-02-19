/**
 * Error categorization utility
 * Maps raw errors to specific ErrorCategory with comprehensive metadata
 */

import type { ErrorCategory, ErrorMetadata, SuggestedAction } from "@/core/types";
import { VaultClientError, LLMProcessingError } from "@/core/types";

/**
 * Categorize an error into a specific ErrorCategory based on error type,
 * message content, and context.
 */
export function categorizeError(
  err: unknown,
  context?: {
    url?: string;
    httpStatus?: number;
    errorMessage?: string;
  }
): ErrorCategory {
  // Use provided HTTP status first if available
  if (context?.httpStatus) {
    if (context.httpStatus === 401 || context.httpStatus === 403) {
      return "login-required";
    }
    if (context.httpStatus === 404 || context.httpStatus === 410) {
      return "page-not-found";
    }
  }

  // Check error message patterns for specific categories
  const errorMessage = context?.errorMessage ?? (err instanceof Error ? err.message : String(err));
  const lowerMessage = errorMessage.toLowerCase();

  // Network errors (connection, DNS, SSL, timeout)
  if (
    err instanceof TypeError &&
    (lowerMessage.includes("fetch") ||
     lowerMessage.includes("network") ||
     lowerMessage.includes("connection"))
  ) {
    return "network";
  }

  if (
    lowerMessage.includes("failed to fetch") ||
    lowerMessage.includes("network request failed") ||
    lowerMessage.includes("err_internet_disconnected") ||
    lowerMessage.includes("err_name_not_resolved") ||
    lowerMessage.includes("err_connection") ||
    lowerMessage.includes("dns") ||
    lowerMessage.includes("ssl") ||
    lowerMessage.includes("tls")
  ) {
    return "network";
  }

  // Timeout errors
  if (
    lowerMessage.includes("timeout") ||
    lowerMessage.includes("timed out") ||
    lowerMessage.includes("aborted") ||
    (err instanceof Error && err.name === "AbortError")
  ) {
    return "timeout";
  }

  // HTTP status-based categorization from error messages
  if (lowerMessage.includes("http 401") || lowerMessage.includes("http 403")) {
    return "login-required";
  }

  if (lowerMessage.includes("http 404") || lowerMessage.includes("http 410")) {
    return "page-not-found";
  }

  if (
    lowerMessage.includes("http 500") ||
    lowerMessage.includes("http 502") ||
    lowerMessage.includes("http 503")
  ) {
    return "page-not-found"; // Server errors treated as page unavailable
  }

  // Bot protection patterns
  if (
    lowerMessage.includes("cloudflare") ||
    lowerMessage.includes("captcha") ||
    lowerMessage.includes("bot protection") ||
    lowerMessage.includes("access denied") ||
    lowerMessage.includes("blocked")
  ) {
    return "bot-protection";
  }

  // Login/auth required patterns
  if (
    lowerMessage.includes("sign in") ||
    lowerMessage.includes("log in") ||
    lowerMessage.includes("authentication required") ||
    lowerMessage.includes("unauthorized")
  ) {
    return "login-required";
  }

  // Extraction failures (content parsing)
  if (
    lowerMessage.includes("readability could not parse") ||
    lowerMessage.includes("extracted content is empty") ||
    lowerMessage.includes("extraction failed") ||
    lowerMessage.includes("non-html content")
  ) {
    return "extraction";
  }

  // Vault errors
  if (err instanceof VaultClientError) {
    return "vault";
  }

  if (
    lowerMessage.includes("vault") ||
    lowerMessage.includes("obsidian") ||
    lowerMessage.includes("rest api")
  ) {
    return "vault";
  }

  // LLM errors
  if (err instanceof LLMProcessingError) {
    return "llm";
  }

  if (
    lowerMessage.includes("openrouter") ||
    lowerMessage.includes("api key") ||
    lowerMessage.includes("rate limit") ||
    lowerMessage.includes("quota exceeded") ||
    lowerMessage.includes("model") ||
    lowerMessage.includes("llm")
  ) {
    return "llm";
  }

  // Default to unknown
  return "unknown";
}

/**
 * Build comprehensive ErrorMetadata for user-facing error display
 */
export function buildErrorMetadata(
  category: ErrorCategory,
  technicalDetails: string,
  retryCount?: number
): ErrorMetadata {
  const timestamp = new Date().toISOString();

  switch (category) {
    case "network":
      return {
        category,
        userMessage: "Your device couldn't reach the URL. This usually means your internet connection is offline or unstable, the website is temporarily down, or the URL is invalid.",
        technicalDetails,
        suggestedAction: "retry",
        isRetryable: true,
        retryCount,
        timestamp,
      };

    case "login-required":
      return {
        category,
        userMessage: "This webpage requires you to be logged in. We can't access content that's behind a login wall.",
        technicalDetails,
        suggestedAction: "open",
        isRetryable: false,
        retryCount,
        timestamp,
      };

    case "bot-protection":
      return {
        category,
        userMessage: "This website uses security technology (Cloudflare, reCAPTCHA, etc.) that blocked our automated access. We can't bypass it.",
        technicalDetails,
        suggestedAction: "open",
        isRetryable: false,
        retryCount,
        timestamp,
      };

    case "page-not-found":
      return {
        category,
        userMessage: "The URL doesn't exist or was deleted. This usually means the link is broken and can't be recovered by trying again.",
        technicalDetails,
        suggestedAction: "skip",
        isRetryable: false,
        retryCount,
        timestamp,
      };

    case "extraction":
      return {
        category,
        userMessage: "We downloaded the page but couldn't extract readable content. This usually means the page uses heavy JavaScript or has unusual formatting.",
        technicalDetails,
        suggestedAction: "retry",
        isRetryable: true,
        retryCount,
        timestamp,
      };

    case "llm":
      return {
        category,
        userMessage: "2Vault couldn't process this content with the OpenRouter API. This could mean your API key is invalid, your account ran out of credits, you've hit the rate limit, or the service is temporarily down.",
        technicalDetails,
        suggestedAction: "settings",
        isRetryable: true,
        retryCount,
        timestamp,
      };

    case "vault":
      return {
        category,
        userMessage: "2Vault couldn't connect to your Obsidian vault. This usually means Obsidian isn't running, the Local REST API plugin is disabled, or your vault URL/API key is wrong.",
        technicalDetails,
        suggestedAction: "settings",
        isRetryable: true,
        retryCount,
        timestamp,
      };

    case "timeout":
      return {
        category,
        userMessage: "The webpage took too long to load and we gave up after 30 seconds. This usually means the website is very slow, temporarily down, or has heavy JavaScript.",
        technicalDetails,
        suggestedAction: "retry",
        isRetryable: true,
        retryCount,
        timestamp,
      };

    case "unknown":
      return {
        category,
        userMessage: "Something unexpected happened. We're not sure why.",
        technicalDetails,
        suggestedAction: "retry",
        isRetryable: true,
        retryCount,
        timestamp,
      };
  }
}

/**
 * Categorize extraction-specific errors from ExtractedContent with "failed" status
 */
export function categorizeExtractionError(errorMessage: string): ErrorCategory {
  const lower = errorMessage.toLowerCase();

  // HTTP status codes
  if (lower.includes("http 401") || lower.includes("http 403")) {
    return "login-required";
  }

  if (lower.includes("http 404") || lower.includes("http 410")) {
    return "page-not-found";
  }

  if (
    lower.includes("http 500") ||
    lower.includes("http 502") ||
    lower.includes("http 503") ||
    lower.includes("http 504")
  ) {
    return "page-not-found"; // Server errors = page unavailable
  }

  // Timeout
  if (lower.includes("timed out") || lower.includes("timeout")) {
    return "timeout";
  }

  // Network
  if (
    lower.includes("fetch failed") ||
    lower.includes("network") ||
    lower.includes("connection")
  ) {
    return "network";
  }

  // Extraction failures (content parsing, empty content, non-HTML)
  if (
    lower.includes("readability could not parse") ||
    lower.includes("extracted content is empty") ||
    lower.includes("extraction failed") ||
    lower.includes("non-html content") ||
    lower.includes("empty response")
  ) {
    return "extraction";
  }

  // Default to extraction category for unrecognized extraction errors
  return "extraction";
}

/**
 * Determine if an error is retriable based on its category
 */
export function isRetryable(category: ErrorCategory): boolean {
  switch (category) {
    case "network":
    case "extraction":
    case "llm":
    case "vault":
    case "timeout":
    case "unknown": // Allow retry for unknown errors (might be temporary)
      return true;

    case "login-required":
    case "bot-protection":
    case "page-not-found":
      return false;
  }
}

/**
 * Get suggested action for an error category
 */
export function getSuggestedAction(category: ErrorCategory): SuggestedAction {
  switch (category) {
    case "network":
    case "timeout":
      return "retry";

    case "login-required":
    case "bot-protection":
      return "open";

    case "page-not-found":
      return "skip";

    case "llm":
    case "vault":
      return "settings";

    case "extraction":
    case "unknown":
      return "retry";
  }
}
