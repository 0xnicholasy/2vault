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
  /^https?:\/\/(www\.)?reddit\.com\//,
  /^https?:\/\/old\.reddit\.com\//,
];

export function isSocialMediaUrl(url: string): boolean {
  return SOCIAL_MEDIA_PATTERNS.some((pattern) => pattern.test(url));
}

// -- Helpers ------------------------------------------------------------------

const SEND_RETRY_COUNT = 3;
const SEND_RETRY_DELAY_MS = 500;

/** Retry chrome.tabs.sendMessage with backoff for content script load timing */
async function sendMessageWithRetry(
  tabId: number,
  message: Record<string, string>,
): Promise<ExtractionResultMessage> {
  for (let attempt = 0; attempt <= SEND_RETRY_COUNT; attempt++) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, message);
      return response as ExtractionResultMessage;
    } catch (err) {
      const isConnectionError =
        err instanceof Error &&
        err.message.includes("Could not establish connection");
      if (!isConnectionError || attempt === SEND_RETRY_COUNT) throw err;
      await new Promise((resolve) =>
        setTimeout(resolve, SEND_RETRY_DELAY_MS * (attempt + 1))
      );
    }
  }
  throw new Error("sendMessage failed after retries");
}

/** Look up the content script file for a URL from the built manifest */
function getContentScriptForUrl(url: string): string | null {
  const manifest = chrome.runtime.getManifest();
  for (const cs of manifest.content_scripts ?? []) {
    const isMatch = cs.matches?.some((pattern) => {
      const regexStr = pattern
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*");
      return new RegExp(`^${regexStr}$`).test(url);
    });
    if (isMatch) return cs.js?.[0] ?? null;
  }
  return null;
}

/** Open popup as a standalone window (works without user gesture context) */
async function openPopupWindow(): Promise<void> {
  await chrome.windows.create({
    url: chrome.runtime.getURL("src/popup/popup.html"),
    type: "popup",
    width: 420,
    height: 600,
  });
}

// -- Tab-based DOM extraction -------------------------------------------------

const DOM_EXTRACT_TIMEOUT_MS = 15_000;
const MAX_CONCURRENT_TABS = 5;

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

    // Request extraction from content script (retry for document_idle timing)
    const response = await Promise.race([
      sendMessageWithRetry(tabId, { type: "EXTRACT_CONTENT" }),
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
  } catch {
    // Content script not loaded (tab opened before extension). Re-inject and retry.
    console.warn("[2Vault] Active tab extraction failed, re-injecting content script");
    try {
      const scriptFile = getContentScriptForUrl(url);
      if (scriptFile) {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: [scriptFile],
        });
        await new Promise((resolve) => setTimeout(resolve, 500));
        const response = await Promise.race([
          chrome.tabs.sendMessage(tabId, { type: "EXTRACT_CONTENT" }) as Promise<ExtractionResultMessage>,
          rejectAfterTimeout(DOM_EXTRACT_TIMEOUT_MS),
        ]);
        return response.data;
      }
    } catch (err) {
      console.warn("[2Vault] Re-injection failed:", err instanceof Error ? err.message : err);
    }
    // Last resort: background tab extraction with retry
    console.warn("[2Vault] Falling back to background tab extraction");
    return extractViaDom(url);
  }
}

// -- Batch processing ---------------------------------------------------------

function createInitialState(urls: string[]): ProcessingState {
  const urlStatuses: Record<string, UrlStatus> = {};
  for (const url of urls) {
    urlStatuses[url] = "queued";
  }
  return {
    active: true,
    urls,
    results: [],
    urlStatuses,
    startedAt: Date.now(),
    cancelled: false,
  };
}

async function runBatchProcessing(urls: string[]): Promise<void> {
  cancelRequested = false;

  const state = createInitialState(urls);
  await setProcessingState(state);

  // Live urlStatuses map - mutated by onProgress, read by final state
  const urlStatuses: Record<string, UrlStatus> = { ...state.urlStatuses };
  const results: ProcessingResult[] = [];
  let batchError: string | undefined;

  try {
    const config = await getConfig();
    const provider = createDefaultProvider(config);

    const onProgress = async (url: string, status: string) => {
      if (cancelRequested) return;
      urlStatuses[url] = status as UrlStatus;
      await setProcessingState({
        ...state,
        urlStatuses: { ...urlStatuses },
        results: [...results],
      });
    };

    const allResults = await processUrls(
      urls,
      config,
      provider,
      onProgress,
      smartExtract,
      () => cancelRequested
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
        urlStatuses[url] = "failed";
      }
    }
  }

  // Build final urlStatuses from results for consistency
  for (const result of results) {
    if (result.status === "success") urlStatuses[result.url] = "done";
    else if (result.status === "review") urlStatuses[result.url] = "review";
    else if (result.status === "skipped") urlStatuses[result.url] = "skipped";
    else urlStatuses[result.url] = "failed";
  }

  // Save final state - always runs, even if getConfig/createDefaultProvider threw
  await setProcessingState({
    ...state,
    active: false,
    cancelled: cancelRequested,
    results,
    urlStatuses,
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

  if (result?.status === "success" || result?.status === "review") {
    chrome.notifications.create({
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon-128.png"),
      title: "2Vault",
      message: result.status === "review"
        ? `Saved to ${result.folder ?? "vault"} (needs review)`
        : `Saved to ${result.folder ?? "vault"}`,
    });
  } else {
    // Store URL for popup prefill on retry
    await setLocalStorage("pendingCaptureUrl", url);

    // Open popup window so user can see the error and retry
    try {
      await openPopupWindow();
    } catch {
      // Window creation failed - notification will guide user
    }

    chrome.notifications.create("save-failed", {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon-128.png"),
      title: "2Vault",
      message: "Save failed - click extension icon to retry",
    });
  }

  // Append to history
  if (result) {
    const history = (await getLocalStorage("processingHistory")) ?? [];
    const updated = [result, ...history].slice(0, MAX_HISTORY);
    await setLocalStorage("processingHistory", updated);
  }
}

// -- Context menu -------------------------------------------------------------

chrome.runtime.onInstalled.addListener(async (details) => {
  chrome.contextMenus.create({
    id: "save-page-to-2vault",
    title: "Save to 2Vault",
    contexts: ["page"],
  });
  chrome.contextMenus.create({
    id: "save-link-to-2vault",
    title: "Save Link to 2Vault",
    contexts: ["link"],
  });

  if (details?.reason === "install") {
    chrome.tabs.create({
      url: chrome.runtime.getURL("src/onboarding/onboarding.html"),
    });
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "save-page-to-2vault") {
    const url = tab?.url;
    if (!url || url.startsWith("chrome://") || url.startsWith("about:")) return;
    // Store URL and open popup - popup auto-starts processing with visible progress
    await setLocalStorage("pendingCaptureUrl", url);
    await openPopupWindow();
  } else if (info.menuItemId === "save-link-to-2vault") {
    const linkUrl = info.linkUrl;
    if (!linkUrl) return;
    await setLocalStorage("pendingCaptureUrl", linkUrl);
    await openPopupWindow();
  }
});

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

// Notification click handler - open popup to retry with prefilled URL
chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId === "save-failed") {
    chrome.notifications.clear(notificationId);
    // pendingCaptureUrl is already in storage - popup will read it on mount
    openPopupWindow().catch(() => {
      // If window creation fails, user can click the extension icon
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
            const failedStatuses: Record<string, UrlStatus> = {};
            for (const u of urls) {
              failedStatuses[u] = "failed";
            }
            await setProcessingState({
              active: false,
              urls,
              results: urls.map((u) => ({ url: u, status: "failed" as const, error: message })),
              urlStatuses: failedStatuses,
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

    if (message.type === "OPEN_ONBOARDING") {
      chrome.tabs.create({
        url: chrome.runtime.getURL("src/onboarding/onboarding.html"),
      });
      sendResponse({ type: "ONBOARDING_OPENED" });
      return false;
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
