import { describe, it, expect } from "vitest";
import {
  categorizeError,
  categorizeExtractionError,
  buildErrorMetadata,
  isRetryable,
  getSuggestedAction,
} from "@/core/error-categorizer";
import { VaultClientError, LLMProcessingError } from "@/core/types";

describe("categorizeError", () => {
  describe("network errors", () => {
    it("should categorize TypeError with 'fetch' as network error", () => {
      const error = new TypeError("Failed to fetch");
      expect(categorizeError(error)).toBe("network");
    });

    it("should categorize connection errors as network error", () => {
      const error = new Error("ERR_INTERNET_DISCONNECTED");
      expect(categorizeError(error)).toBe("network");
    });

    it("should categorize DNS errors as network error", () => {
      const error = new Error("ERR_NAME_NOT_RESOLVED");
      expect(categorizeError(error)).toBe("network");
    });

    it("should categorize SSL/TLS errors as network error", () => {
      const error = new Error("SSL certificate error");
      expect(categorizeError(error)).toBe("network");
    });
  });

  describe("timeout errors", () => {
    it("should categorize timeout errors", () => {
      const error = new Error("Request timed out");
      expect(categorizeError(error)).toBe("timeout");
    });

    it("should categorize AbortError as timeout", () => {
      const error = new Error("Aborted");
      error.name = "AbortError";
      expect(categorizeError(error)).toBe("timeout");
    });
  });

  describe("HTTP status-based categorization", () => {
    it("should categorize 401 as login-required", () => {
      expect(categorizeError(new Error("HTTP 401 Unauthorized"))).toBe("login-required");
    });

    it("should categorize 403 as login-required", () => {
      expect(categorizeError(new Error("HTTP 403 Forbidden"))).toBe("login-required");
    });

    it("should categorize 404 as page-not-found", () => {
      expect(categorizeError(new Error("HTTP 404 Not Found"))).toBe("page-not-found");
    });

    it("should categorize 410 as page-not-found", () => {
      expect(categorizeError(new Error("HTTP 410 Gone"))).toBe("page-not-found");
    });

    it("should categorize 500 as page-not-found", () => {
      expect(categorizeError(new Error("HTTP 500 Internal Server Error"))).toBe("page-not-found");
    });

    it("should use context httpStatus for 401", () => {
      expect(categorizeError(new Error("Error"), { httpStatus: 401 })).toBe("login-required");
    });

    it("should use context httpStatus for 404", () => {
      expect(categorizeError(new Error("Error"), { httpStatus: 404 })).toBe("page-not-found");
    });
  });

  describe("bot protection errors", () => {
    it("should categorize Cloudflare errors", () => {
      expect(categorizeError(new Error("Blocked by Cloudflare"))).toBe("bot-protection");
    });

    it("should categorize CAPTCHA errors", () => {
      expect(categorizeError(new Error("reCAPTCHA verification required"))).toBe("bot-protection");
    });

    it("should categorize access denied errors", () => {
      expect(categorizeError(new Error("Access denied - bot detected"))).toBe("bot-protection");
    });
  });

  describe("login-required errors", () => {
    it("should categorize sign-in errors", () => {
      expect(categorizeError(new Error("Please sign in to continue"))).toBe("login-required");
    });

    it("should categorize authentication required errors", () => {
      expect(categorizeError(new Error("Authentication required"))).toBe("login-required");
    });
  });

  describe("extraction errors", () => {
    it("should categorize Readability parsing failures", () => {
      expect(categorizeError(new Error("Readability could not parse content"))).toBe("extraction");
    });

    it("should categorize empty content errors", () => {
      expect(categorizeError(new Error("Extracted content is empty"))).toBe("extraction");
    });

    it("should categorize non-HTML content errors", () => {
      expect(categorizeError(new Error("Non-HTML content-type: application/pdf"))).toBe("extraction");
    });
  });

  describe("vault errors", () => {
    it("should categorize VaultClientError instances", () => {
      const error = new VaultClientError("Connection failed", 500, "/vault/");
      expect(categorizeError(error)).toBe("vault");
    });

    it("should categorize Obsidian-related errors", () => {
      expect(categorizeError(new Error("Obsidian REST API connection failed"))).toBe("vault");
    });
  });

  describe("LLM errors", () => {
    it("should categorize LLMProcessingError instances", () => {
      const error = new LLMProcessingError("Summarization failed", "summarization");
      expect(categorizeError(error)).toBe("llm");
    });

    it("should categorize OpenRouter errors", () => {
      expect(categorizeError(new Error("OpenRouter API key invalid"))).toBe("llm");
    });

    it("should categorize rate limit errors", () => {
      expect(categorizeError(new Error("Rate limit exceeded"))).toBe("llm");
    });

    it("should categorize quota exceeded errors", () => {
      expect(categorizeError(new Error("Quota exceeded"))).toBe("llm");
    });
  });

  describe("unknown errors", () => {
    it("should default to unknown for unrecognized errors", () => {
      expect(categorizeError(new Error("Something completely unexpected"))).toBe("unknown");
    });

    it("should categorize non-Error objects as unknown", () => {
      expect(categorizeError("string error")).toBe("unknown");
    });
  });
});

describe("categorizeExtractionError", () => {
  it("should categorize HTTP 401 from error message", () => {
    expect(categorizeExtractionError("HTTP 401 Unauthorized")).toBe("login-required");
  });

  it("should categorize HTTP 404 from error message", () => {
    expect(categorizeExtractionError("HTTP 404 Not Found")).toBe("page-not-found");
  });

  it("should categorize timeout errors", () => {
    expect(categorizeExtractionError("Request timed out")).toBe("timeout");
  });

  it("should categorize network errors", () => {
    expect(categorizeExtractionError("Fetch failed: network error")).toBe("network");
  });

  it("should categorize Readability failures", () => {
    expect(categorizeExtractionError("Readability could not parse content")).toBe("extraction");
  });

  it("should categorize empty content", () => {
    expect(categorizeExtractionError("Extracted content is empty")).toBe("extraction");
  });

  it("should categorize non-HTML content", () => {
    expect(categorizeExtractionError("Non-HTML content-type: application/json")).toBe("extraction");
  });

  it("should default to extraction for unrecognized errors", () => {
    expect(categorizeExtractionError("Unknown extraction failure")).toBe("extraction");
  });
});

describe("buildErrorMetadata", () => {
  it("should build metadata for network errors", () => {
    const metadata = buildErrorMetadata("network", "Failed to fetch");

    expect(metadata.category).toBe("network");
    expect(metadata.technicalDetails).toBe("Failed to fetch");
    expect(metadata.isRetryable).toBe(true);
    expect(metadata.suggestedAction).toBe("retry");
    expect(metadata.userMessage).toContain("internet connection");
    expect(metadata.timestamp).toBeDefined();
  });

  it("should build metadata for login-required errors", () => {
    const metadata = buildErrorMetadata("login-required", "HTTP 401");

    expect(metadata.category).toBe("login-required");
    expect(metadata.isRetryable).toBe(false);
    expect(metadata.suggestedAction).toBe("open");
    expect(metadata.userMessage).toContain("logged in");
  });

  it("should build metadata for bot-protection errors", () => {
    const metadata = buildErrorMetadata("bot-protection", "Cloudflare blocked");

    expect(metadata.category).toBe("bot-protection");
    expect(metadata.isRetryable).toBe(false);
    expect(metadata.suggestedAction).toBe("open");
    expect(metadata.userMessage).toContain("security technology");
  });

  it("should build metadata for page-not-found errors", () => {
    const metadata = buildErrorMetadata("page-not-found", "HTTP 404");

    expect(metadata.category).toBe("page-not-found");
    expect(metadata.isRetryable).toBe(false);
    expect(metadata.suggestedAction).toBe("skip");
    expect(metadata.userMessage).toContain("deleted");
  });

  it("should build metadata for extraction errors", () => {
    const metadata = buildErrorMetadata("extraction", "Readability failed");

    expect(metadata.category).toBe("extraction");
    expect(metadata.isRetryable).toBe(true);
    expect(metadata.suggestedAction).toBe("retry");
    expect(metadata.userMessage).toContain("readable content");
  });

  it("should build metadata for LLM errors", () => {
    const metadata = buildErrorMetadata("llm", "API key invalid");

    expect(metadata.category).toBe("llm");
    expect(metadata.isRetryable).toBe(true);
    expect(metadata.suggestedAction).toBe("settings");
    expect(metadata.userMessage).toContain("OpenRouter API");
  });

  it("should build metadata for vault errors", () => {
    const metadata = buildErrorMetadata("vault", "Connection failed");

    expect(metadata.category).toBe("vault");
    expect(metadata.isRetryable).toBe(true);
    expect(metadata.suggestedAction).toBe("settings");
    expect(metadata.userMessage).toContain("Obsidian");
  });

  it("should build metadata for timeout errors", () => {
    const metadata = buildErrorMetadata("timeout", "Timed out after 30s");

    expect(metadata.category).toBe("timeout");
    expect(metadata.isRetryable).toBe(true);
    expect(metadata.suggestedAction).toBe("retry");
    expect(metadata.userMessage).toContain("too long");
  });

  it("should build metadata for unknown errors", () => {
    const metadata = buildErrorMetadata("unknown", "Something went wrong");

    expect(metadata.category).toBe("unknown");
    expect(metadata.isRetryable).toBe(true);
    expect(metadata.suggestedAction).toBe("retry");
    expect(metadata.userMessage).toContain("unexpected");
  });

  it("should include retry count when provided", () => {
    const metadata = buildErrorMetadata("network", "Failed", 3);

    expect(metadata.retryCount).toBe(3);
  });
});

describe("isRetryable", () => {
  it("should mark network errors as retriable", () => {
    expect(isRetryable("network")).toBe(true);
  });

  it("should mark extraction errors as retriable", () => {
    expect(isRetryable("extraction")).toBe(true);
  });

  it("should mark LLM errors as retriable", () => {
    expect(isRetryable("llm")).toBe(true);
  });

  it("should mark vault errors as retriable", () => {
    expect(isRetryable("vault")).toBe(true);
  });

  it("should mark timeout errors as retriable", () => {
    expect(isRetryable("timeout")).toBe(true);
  });

  it("should mark unknown errors as retriable", () => {
    expect(isRetryable("unknown")).toBe(true);
  });

  it("should mark login-required errors as non-retriable", () => {
    expect(isRetryable("login-required")).toBe(false);
  });

  it("should mark bot-protection errors as non-retriable", () => {
    expect(isRetryable("bot-protection")).toBe(false);
  });

  it("should mark page-not-found errors as non-retriable", () => {
    expect(isRetryable("page-not-found")).toBe(false);
  });
});

describe("getSuggestedAction", () => {
  it("should suggest retry for network errors", () => {
    expect(getSuggestedAction("network")).toBe("retry");
  });

  it("should suggest retry for timeout errors", () => {
    expect(getSuggestedAction("timeout")).toBe("retry");
  });

  it("should suggest retry for extraction errors", () => {
    expect(getSuggestedAction("extraction")).toBe("retry");
  });

  it("should suggest retry for unknown errors", () => {
    expect(getSuggestedAction("unknown")).toBe("retry");
  });

  it("should suggest open for login-required errors", () => {
    expect(getSuggestedAction("login-required")).toBe("open");
  });

  it("should suggest open for bot-protection errors", () => {
    expect(getSuggestedAction("bot-protection")).toBe("open");
  });

  it("should suggest skip for page-not-found errors", () => {
    expect(getSuggestedAction("page-not-found")).toBe("skip");
  });

  it("should suggest settings for LLM errors", () => {
    expect(getSuggestedAction("llm")).toBe("settings");
  });

  it("should suggest settings for vault errors", () => {
    expect(getSuggestedAction("vault")).toBe("settings");
  });
});
