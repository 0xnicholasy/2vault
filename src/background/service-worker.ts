import type { ProcessingState, UrlStatus, ExtractionResultMessage } from "@/background/messages.ts";
import type { ExtractedContent, ProcessingResult } from "@/core/types.ts";
import { processUrls, createDefaultProvider } from "@/core/orchestrator";
import { fetchAndExtract, createFailedExtraction } from "@/core/extractor";
import {
  getConfig,
  getProcessingState,
  setProcessingState,
  getLocalStorage,
  setLocalStorage,
} from "@/utils/storage";
import { MAX_HISTORY } from "@/utils/config";

let cancelRequested = false;

// -- Social media URL detection -----------------------------------------------

const SOCIAL_MEDIA_PATTERNS = [
  /^https?:\/\/(www\.)?x\.com\//,
  /^https?:\/\/(www\.)?twitter\.com\//,
  /^https?:\/\/(www\.)?linkedin\.com\//,
];

export function isSocialMediaUrl(url: string): boolean {
  return SOCIAL_MEDIA_PATTERNS.some((pattern) => pattern.test(url));
}

// -- Tab-based DOM extraction -------------------------------------------------

const DOM_EXTRACT_TIMEOUT_MS = 15_000;
const MAX_CONCURRENT_TABS = 2;

let activeTabExtractions = 0;

async function waitForTabSlot(): Promise<void> {
  while (activeTabExtractions >= MAX_CONCURRENT_TABS) {
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

export async function extractViaDom(url: string): Promise<ExtractedContent> {
  await waitForTabSlot();
  activeTabExtractions++;

  let tabId: number | undefined;

  try {
    const tab = await chrome.tabs.create({ url, active: false });
    tabId = tab.id;

    if (tabId === undefined) {
      return createFailedExtraction(url, "Failed to create tab");
    }

    // Wait for tab to finish loading
    await waitForTabLoad(tabId);

    // Request extraction from content script
    const response = await Promise.race([
      chrome.tabs.sendMessage(tabId, { type: "EXTRACT_CONTENT" }) as Promise<ExtractionResultMessage>,
      rejectAfterTimeout(DOM_EXTRACT_TIMEOUT_MS),
    ]);

    return response.data;
  } catch (err) {
    const message = err instanceof Error ? err.message : "DOM extraction failed";
    return createFailedExtraction(url, message);
  } finally {
    activeTabExtractions--;
    if (tabId !== undefined) {
      chrome.tabs.remove(tabId).catch(() => {
        // Tab may already be closed
      });
    }
  }
}

function waitForTabLoad(tabId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("Tab load timed out"));
    }, DOM_EXTRACT_TIMEOUT_MS);

    const listener = (
      updatedTabId: number,
      changeInfo: chrome.tabs.OnUpdatedInfo
    ) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };

    chrome.tabs.onUpdated.addListener(listener);
  });
}

function rejectAfterTimeout(ms: number): Promise<never> {
  return new Promise((_resolve, reject) => {
    setTimeout(() => reject(new Error("DOM extraction timed out")), ms);
  });
}

// -- Smart extraction routing -------------------------------------------------

export async function smartExtract(url: string): Promise<ExtractedContent> {
  if (isSocialMediaUrl(url)) {
    return extractViaDom(url);
  }
  return fetchAndExtract(url);
}

async function extractFromActiveTab(tabId: number, url: string): Promise<ExtractedContent> {
  try {
    const response = await Promise.race([
      chrome.tabs.sendMessage(tabId, { type: "EXTRACT_CONTENT" }) as Promise<ExtractionResultMessage>,
      rejectAfterTimeout(DOM_EXTRACT_TIMEOUT_MS),
    ]);
    return response.data;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Active tab extraction failed";
    return createFailedExtraction(url, message);
  }
}

// -- Batch processing ---------------------------------------------------------

function createInitialState(urls: string[]): ProcessingState {
  return {
    active: true,
    urls,
    results: [],
    currentIndex: 0,
    currentUrl: urls[0] ?? "",
    currentStatus: "queued",
    startedAt: Date.now(),
    cancelled: false,
  };
}

async function runBatchProcessing(urls: string[]): Promise<void> {
  cancelRequested = false;

  const state = createInitialState(urls);
  await setProcessingState(state);

  const results: ProcessingResult[] = [];
  let batchError: string | undefined;

  try {
    const config = await getConfig();
    const provider = createDefaultProvider(config);

    const onProgress = async (
      url: string,
      status: string,
      index: number,
      _total: number
    ) => {
      if (cancelRequested) return;
      await setProcessingState({
        ...state,
        currentIndex: index,
        currentUrl: url,
        currentStatus: status as UrlStatus,
        results,
      });
    };

    const allResults = await processUrls(
      urls,
      config,
      provider,
      onProgress,
      smartExtract
    );
    results.push(...allResults);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed";
    console.error("[2Vault] Batch processing error:", message);
    batchError = message;

    // Mark any remaining URLs (not yet in results) as failed
    const processedUrls = new Set(results.map((r) => r.url));
    for (const url of urls) {
      if (!processedUrls.has(url)) {
        results.push({ url, status: "failed", error: message });
      }
    }
  }

  // Save final state - always runs, even if getConfig/createDefaultProvider threw
  await setProcessingState({
    ...state,
    active: false,
    cancelled: cancelRequested,
    results,
    currentIndex: urls.length,
    currentUrl: "",
    currentStatus: "done",
    error: batchError,
  });

  // Append to processing history
  const history = (await getLocalStorage("processingHistory")) ?? [];
  const updated = [...results, ...history].slice(0, MAX_HISTORY);
  await setLocalStorage("processingHistory", updated);
}

async function handleSingleUrlCapture(
  url: string,
  activeTabId?: number
): Promise<void> {
  const config = await getConfig();
  if (!config.apiKey || !config.vaultApiKey) {
    console.warn("[2Vault] Missing API keys - configure in extension settings");
    return;
  }

  const provider = createDefaultProvider(config);

  // For social media on active tab, extract directly without opening a new tab
  let extractFn: ((u: string) => Promise<ExtractedContent>) | undefined;
  if (isSocialMediaUrl(url) && activeTabId !== undefined) {
    extractFn = (_u: string) => extractFromActiveTab(activeTabId, url);
  } else {
    extractFn = smartExtract;
  }

  const results = await processUrls([url], config, provider, undefined, extractFn);
  const result = results[0];

  if (result?.status === "success") {
    chrome.notifications.create({
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon-128.png"),
      title: "2Vault",
      message: `Saved to ${result.folder ?? "vault"}`,
    });
  } else {
    chrome.notifications.create({
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon-128.png"),
      title: "2Vault",
      message: `Failed: ${result?.error ?? "Unknown error"}`,
    });
  }

  // Append to history
  if (result) {
    const history = (await getLocalStorage("processingHistory")) ?? [];
    const updated = [result, ...history].slice(0, MAX_HISTORY);
    await setLocalStorage("processingHistory", updated);
  }
}

// Keyboard shortcut handler
chrome.commands.onCommand.addListener((command) => {
  if (command === "capture-current-page") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      const url = tab?.url;
      if (!url || url.startsWith("chrome://")) {
        console.warn("[2Vault] Cannot capture this page");
        return;
      }
      handleSingleUrlCapture(url, tab?.id).catch((err) => {
        console.error("[2Vault] Capture failed:", err);
      });
    });
  }
});

// Message handler for popup commands
chrome.runtime.onMessage.addListener(
  (message: { type: string; [key: string]: unknown }, _sender, sendResponse) => {
    if (message.type === "START_PROCESSING" && Array.isArray(message["urls"])) {
      const urls = message["urls"] as string[];
      getProcessingState().then((existing) => {
        if (existing?.active) {
          sendResponse({ type: "PROCESSING_ALREADY_ACTIVE" });
          return;
        }
        runBatchProcessing(urls).catch(async (err) => {
          // Last-resort handler: if runBatchProcessing itself throws
          // (e.g. setProcessingState fails), save error state so the UI can show it
          const message = err instanceof Error ? err.message : "Processing failed";
          console.error("[2Vault] Unhandled processing error:", message);
          try {
            await setProcessingState({
              active: false,
              urls,
              results: urls.map((u) => ({ url: u, status: "failed" as const, error: message })),
              currentIndex: urls.length,
              currentUrl: "",
              currentStatus: "done" as UrlStatus,
              startedAt: Date.now(),
              cancelled: false,
              error: message,
            });
          } catch {
            // If even this fails, nothing more we can do
            console.error("[2Vault] Failed to save error state");
          }
        });
        sendResponse({ type: "PROCESSING_STARTED" });
      });
      return true; // Keep message channel open for async response
    }

    if (message.type === "CANCEL_PROCESSING") {
      cancelRequested = true;
      getProcessingState().then(async (state) => {
        if (state) {
          await setProcessingState({ ...state, cancelled: true, active: false });
        }
        sendResponse({ type: "PROCESSING_CANCELLED" });
      });
      return true;
    }

    return false;
  }
);
