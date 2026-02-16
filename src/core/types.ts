export interface ExtractedContent {
  url: string;
  title: string;
  content: string;
  author: string | null;
  datePublished: string | null;
  wordCount: number;
  type: "article" | "social-media";
  platform: "web" | "x" | "linkedin";
  status: "success" | "failed";
  error?: string;
}

export interface VaultContext {
  folders: string[];
  tags: string[];
  recentNotes: NotePreview[];
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
  platform: "web" | "x" | "linkedin";
  source: ExtractedContent;
}

export interface ProcessingResult {
  url: string;
  status: "success" | "failed";
  note?: ProcessedNote;
  folder?: string;
  error?: string;
}

export interface LLMProvider {
  processContent(
    content: ExtractedContent,
    vaultContext: VaultContext
  ): Promise<ProcessedNote>;
}

export interface Config {
  apiKey: string;
  llmProvider: "anthropic" | "openai";
  vaultUrl: string;
  vaultApiKey: string;
  defaultFolder: string;
}

/** Raw file entry from Obsidian Local REST API */
export interface VaultFileEntry {
  path: string;
  stat: { ctime: number; mtime: number; size: number };
  tags?: string[];
}

/** Response from GET /vault/ and GET /vault/{dir}/ */
export interface VaultListResponse {
  files: VaultFileEntry[];
}

/** Response from GET / (health check) */
export interface VaultHealthResponse {
  authenticated: boolean;
  ok: boolean;
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
