import type { ExtractedContent, ProcessingResult } from "@/core/types.ts";

/** Per-URL processing status in the batch */
export type UrlStatus =
  | "queued"
  | "checking"
  | "extracting"
  | "retrying"
  | "processing"
  | "creating"
  | "done"
  | "failed"
  | "skipped"
  | "review"
  | "timeout"
  | "cancelled";

/** Persisted processing state in chrome.storage.local */
export interface ProcessingState {
  active: boolean;
  urls: string[];
  results: ProcessingResult[];
  urlStatuses: Record<string, UrlStatus>;
  startedAt: number;
  cancelled: boolean;
  error?: string;
}

/** Messages from popup -> service worker */
export type PopupMessage =
  | { type: "START_PROCESSING"; urls: string[] }
  | { type: "CANCEL_PROCESSING" };

/** Response from service worker -> popup */
export type ServiceWorkerResponse =
  | { type: "PROCESSING_STARTED" }
  | { type: "PROCESSING_ALREADY_ACTIVE" }
  | { type: "PROCESSING_CANCELLED" }
  | { type: "ERROR"; error: string };

/** Message from service worker -> content script (request extraction) */
export interface ExtractContentMessage {
  type: "EXTRACT_CONTENT";
}

/** Response from content script -> service worker (extraction result) */
export interface ExtractionResultMessage {
  type: "EXTRACTION_RESULT";
  data: ExtractedContent;
}
