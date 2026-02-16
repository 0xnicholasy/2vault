import type { ExtractedContent, ProcessingResult } from "@/core/types.ts";

/** Per-URL processing status in the batch */
export type UrlStatus =
  | "queued"
  | "extracting"
  | "processing"
  | "creating"
  | "done"
  | "failed";

/** Persisted processing state in chrome.storage.local */
export interface ProcessingState {
  active: boolean;
  urls: string[];
  results: ProcessingResult[];
  currentIndex: number;
  currentUrl: string;
  currentStatus: UrlStatus;
  startedAt: number;
  cancelled: boolean;
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
