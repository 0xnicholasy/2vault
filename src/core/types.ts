export type Platform = "web" | "x" | "linkedin" | "reddit";

export interface ExtractedContent {
  url: string;
  title: string;
  content: string;
  author: string | null;
  datePublished: string | null;
  wordCount: number;
  type: "article" | "social-media";
  platform: Platform;
  status: "success" | "failed" | "review"; // review = partial extraction, needs user verification
  error?: string;
}

export type VaultOrganization = "para" | "custom";

export type SummaryDetailLevel = "brief" | "standard" | "detailed";

export interface TagGroup {
  name: string;
  tags: string[];
}

export interface VaultContext {
  folders: string[];
  tags: string[];
  recentNotes: NotePreview[];
  tagGroups: TagGroup[];
  organization: VaultOrganization;
}

export interface NotePreview {
  folder: string;
  title: string;
  tags: string[];
}

export interface ProcessedNote {
  title: string;
  summary: string;
  keyTakeaways: string[];
  suggestedFolder: string;
  suggestedTags: string[];
  type: "article" | "social-media";
  platform: Platform;
  source: ExtractedContent;
}

/** Specific error categories for better UX organization */
export type ErrorCategory =
  | "network"        // Connection timeout, DNS, SSL, offline
  | "login-required" // 401/403, auth wall, requires login
  | "bot-protection" // Cloudflare, reCAPTCHA, anti-bot detected
  | "page-not-found" // 404, 410, deleted content
  | "extraction"     // Could not parse content (not login/bot/404)
  | "llm"            // AI service errors, API key issues, 500+
  | "vault"          // Obsidian connection failed
  | "timeout"        // Processing timeout (>30s)
  | "unknown";       // Catch-all for unexpected errors

/** Suggested action for each error type */
export type SuggestedAction = "retry" | "open" | "skip" | "settings";

/** Comprehensive error metadata for user-facing display */
export interface ErrorMetadata {
  category: ErrorCategory;
  userMessage: string;        // Plain-English explanation
  technicalDetails: string;   // Error message, status codes, etc.
  suggestedAction: SuggestedAction;
  isRetryable: boolean;
  retryCount?: number;
  timestamp: string;          // ISO timestamp
}

export type ContentQualityReason =
  | "login-wall"
  | "bot-protection"
  | "soft-404"
  | "deleted-content"
  | "insufficient-content"
  | "error-page";

export interface ContentQuality {
  isLowQuality: boolean;
  reason?: ContentQualityReason;
  detail?: string;
}

export interface ProcessingResult {
  url: string;
  status: "success" | "failed" | "skipped" | "review" | "timeout" | "cancelled";
  note?: ProcessedNote;
  folder?: string;
  error?: string;
  errorCategory?: ErrorCategory;
  errorMetadata?: ErrorMetadata; // New: comprehensive error context
  skipReason?: string;
  contentQuality?: ContentQuality;
}

export interface SearchResult {
  filename: string;
  score: number;
}

export interface LLMProvider {
  processContent(
    content: ExtractedContent,
    vaultContext: VaultContext
  ): Promise<ProcessedNote>;
}

export interface Config {
  apiKey: string;
  llmProvider: "openrouter";
  vaultUrl: string;
  vaultApiKey: string;
  vaultName: string;
  vaultOrganization: VaultOrganization;
  tagGroups: TagGroup[];
  summaryDetailLevel: SummaryDetailLevel;
}

/** Response from GET /vault/ and GET /vault/{dir}/ - returns plain string paths */
export interface VaultListResponse {
  files: string[];
}

/** Response from GET / (health check) */
export interface VaultHealthResponse {
  authenticated: boolean;
  status: string;
  service: string;
  versions: Record<string, string>;
}

/** Error from VaultClient (carries HTTP context) */
export class VaultClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number | null,
    public readonly endpoint: string
  ) {
    super(message);
    this.name = "VaultClientError";
  }
}

/** Error from LLM processing (carries which stage failed) */
export class LLMProcessingError extends Error {
  public readonly stage: "summarization" | "categorization";

  constructor(
    message: string,
    stage: "summarization" | "categorization",
    cause?: Error
  ) {
    super(message, { cause });
    this.name = "LLMProcessingError";
    this.stage = stage;
  }
}
