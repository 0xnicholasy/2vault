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
