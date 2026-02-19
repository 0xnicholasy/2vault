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
      const isRetryable =
        err instanceof Error &&
        (err.message.includes("Could not establish connection") ||
         err.message.includes("Receiving end does not exist") ||
         err.message.includes("message port closed") ||
         err.message.includes("Extension context invalidated"));
      if (!isRetryable || attempt === SEND_RETRY_COUNT) throw err;
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

const DOM_EXTRACT_TIMEOUT_MS = 30_000; // Increased to match content script 30s polling timeout
/**
 * Delays between extraction attempts on the same tab.
 * The tab stays open; each delay gives the page more time to finish loading.
 */
const DOM_RETRY_DELAYS_MS = [2_000, 5_000, 10_000]; // Reduced from 7 retries to 3 (4 total attempts)
const MAX_DOM_ATTEMPTS = DOM_RETRY_DELAYS_MS.length + 1; // 1 immediate + 3 retries = 4 attempts
const MAX_PRELOADED_TABS = 5;

// -- Tab preloader ------------------------------------------------------------
// Pre-opens background tabs so pages start loading while other URLs are being
// processed by the LLM. When a tab is released, the next pending URL's tab
// opens immediately.

/** Map of URL -> tabId for pre-loaded tabs */
const preloadedTabs = new Map<string, number>();
/** Number of tab creations in flight (not yet resolved) */
let pendingTabCreations = 0;
/** Tab IDs currently owned by active extractViaDom calls */
const activeExtractionTabs = new Set<number>();
/** URLs waiting to be pre-loaded */
let preloadQueue: string[] = [];
/** Abort flag to prevent tabs from being created after cancellation */
let abortPreload = false;

/** Pre-load tabs for a batch of social media URLs */
export function preloadTabs(urls: string[]): void {
  // Reset abort flag when starting a new preload batch
  abortPreload = false;

  // Only pre-load social media URLs (others use fetch, not tabs)
  preloadQueue = urls.filter(isSocialMediaUrl);
  fillPreloadSlots();
}

/** Open tabs up to the limit from the pending queue */
function fillPreloadSlots(): void {
  while (preloadedTabs.size + pendingTabCreations < MAX_PRELOADED_TABS && preloadQueue.length > 0) {
    // Check abort flag before creating new tabs
    if (abortPreload) return;

    const url = preloadQueue.shift()!;
    if (preloadedTabs.has(url)) continue;
    pendingTabCreations++;
    chrome.tabs.create({ url, active: false }).then((tab) => {
      pendingTabCreations--;

      // Cancel late-arriving tabs if abort was requested
      if (abortPreload) {
        if (tab.id !== undefined) {
          chrome.tabs.remove(tab.id).catch(() => {});
        }
        return;
      }

      if (tab.id !== undefined) {
        preloadedTabs.set(url, tab.id);
      }
    }).catch(() => {
      pendingTabCreations--;
    });
  }
}

/** Claim a pre-loaded tab for extraction (removes from pool).
 *  Waits briefly for pending tab creations if the URL isn't ready yet. */
async function claimPreloadedTab(url: string): Promise<number | undefined> {
  // If tab is already available, return immediately
  let tabId = preloadedTabs.get(url);
  if (tabId !== undefined) {
    preloadedTabs.delete(url);
    return tabId;
  }
  // If there are pending creations, wait a moment for them to resolve
  if (pendingTabCreations > 0) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    tabId = preloadedTabs.get(url);
    if (tabId !== undefined) {
      preloadedTabs.delete(url);
      return tabId;
    }
  }
  return undefined;
}

/** Release a tab and open the next pending URL */
function releaseTab(tabId: number): void {
  chrome.tabs.remove(tabId).catch(() => {
    // Tab may already be closed
  });
  fillPreloadSlots();
}

/** Clean up all pre-loaded tabs and active extraction tabs (e.g. on cancel) */
export function clearAllProcessingTabs(): void {
  // Set abort flag to prevent pending tab creations from completing
  abortPreload = true;

  for (const tabId of preloadedTabs.values()) {
    chrome.tabs.remove(tabId).catch(() => {});
  }
  preloadedTabs.clear();
  preloadQueue = [];
  pendingTabCreations = 0;
  for (const tabId of activeExtractionTabs) {
    chrome.tabs.remove(tabId).catch(() => {});
  }
  activeExtractionTabs.clear();
}

// -- Tab-based DOM extraction with retry --------------------------------------

/**
 * Try to extract content from a tab's content script.
 * Returns the extraction result, or null if the message fails (content script not ready).
 * On failure, re-injects the content script and retries once (Bug #2 fix:
 * background tabs may have stale/unresponsive content scripts).
 */
async function tryExtractFromTab(tabId: number, url: string): Promise<ExtractedContent | null> {
  try {
    const response = await Promise.race([
      sendMessageWithRetry(tabId, { type: "EXTRACT_CONTENT" }),
      rejectAfterTimeout(DOM_EXTRACT_TIMEOUT_MS),
    ]);
    return response.data;
  } catch {
    // Content script may be dead or never loaded in background tab.
    // Re-inject and retry once.
    try {
      const scriptFile = getContentScriptForUrl(url);
      if (!scriptFile) return null;
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [scriptFile],
      });
      // Brief wait for content script to initialize
      await new Promise((resolve) => setTimeout(resolve, 500));
      const response = await Promise.race([
        chrome.tabs.sendMessage(tabId, { type: "EXTRACT_CONTENT" }) as Promise<ExtractionResultMessage>,
        rejectAfterTimeout(DOM_EXTRACT_TIMEOUT_MS),
      ]);
      return response.data;
    } catch {
      return null;
    }
  }
}

export async function extractViaDom(
  url: string,
  onRetry?: (attempt: number, totalAttempts: number) => void,
): Promise<ExtractedContent> {
  let tabId: number | undefined;
  let tabOwned = false;

  try {
    // Use pre-loaded tab if available, otherwise create one
    tabId = await claimPreloadedTab(url);
    if (tabId !== undefined) {
      tabOwned = true;
    } else {
      const tab = await chrome.tabs.create({ url, active: false });
      tabId = tab.id;
      tabOwned = true;
    }

    if (tabId === undefined) {
      return createFailedExtraction(url, "Failed to create tab");
    }

    // Track this tab so cancel can close it
    activeExtractionTabs.add(tabId);

    // Wait for initial tab load (may already be loaded if pre-loaded)
    try {
      await waitForTabLoad(tabId, DOM_EXTRACT_TIMEOUT_MS);
    } catch {
      // Tab load timed out - still try extraction, page may be partially loaded
    }

    for (let attempt = 0; attempt < MAX_DOM_ATTEMPTS; attempt++) {
      // On retries, sleep to give the page more time to load content
      if (attempt > 0) {
        const delay = DOM_RETRY_DELAYS_MS[attempt - 1]!;
        console.warn(`[2Vault] Attempt ${attempt + 1}/${MAX_DOM_ATTEMPTS} for ${url}, waiting ${delay / 1000}s for content`);
        onRetry?.(attempt + 1, MAX_DOM_ATTEMPTS);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      const result = await tryExtractFromTab(tabId, url);

      // Content script responded with successful extraction
      if (result?.status === "success") {
        return result;
      }

      // Last attempt - return whatever we got
      if (attempt === MAX_DOM_ATTEMPTS - 1) {
        const lastError = result?.error ?? "extraction failed";
        return {
          ...(result ?? createFailedExtraction(url, lastError)),
          error: `Timed out after ${MAX_DOM_ATTEMPTS} attempts: ${lastError}`,
        };
      }

      if (result) {
        console.warn(`[2Vault] Attempt ${attempt + 1} failed for ${url}: ${result.error}`);
      }
    }

    return createFailedExtraction(url, `Timed out after ${MAX_DOM_ATTEMPTS} attempts`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "DOM extraction failed";
    return createFailedExtraction(url, message);
  } finally {
    if (tabId !== undefined) {
      activeExtractionTabs.delete(tabId);
    }
    if (tabOwned && tabId !== undefined) {
      releaseTab(tabId);
    }
  }
}

function waitForTabLoad(tabId: number, timeoutMs: number = DOM_EXTRACT_TIMEOUT_MS): Promise<void> {
  return new Promise((resolve, reject) => {
    // Bug #1 fix: Check if tab is already loaded (e.g. pre-loaded tab)
    chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === "complete") {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        reject(new Error("Tab load timed out"));
      }, timeoutMs);

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
    }).catch(() => {
      reject(new Error("Tab not found"));
    });
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
  abortPreload = false; // Reset abort flag for new batch

  // Normalize URLs before processing to prevent duplicate tabs (old.reddit.com vs reddit.com)
  const { normalizeUrl } = await import("@/core/orchestrator");
  const normalizedUrls = urls.map(normalizeUrl);

  // Pre-open tabs for social media URLs so pages start loading immediately
  preloadTabs(normalizedUrls);

  const state = createInitialState(normalizedUrls);
  await setProcessingState(state);

  // Live urlStatuses map - mutated by onProgress, read by final state
  const urlStatuses: Record<string, UrlStatus> = { ...state.urlStatuses };
  const results: ProcessingResult[] = [];
  let batchError: string | undefined;

  // BUG #1 FIX: Prevent race conditions in state updates with atomic read-modify-write
  let stateUpdateInProgress = false;
  const pendingUpdates: Array<{ url: string; status: string }> = [];

  const processStateUpdates = async () => {
    if (stateUpdateInProgress || pendingUpdates.length === 0) return;
    stateUpdateInProgress = true;

    try {
      // Batch all pending updates
      while (pendingUpdates.length > 0) {
        const update = pendingUpdates.shift();
        if (!update) break;
        urlStatuses[update.url] = update.status as UrlStatus;
      }

      // Single atomic state write
      await setProcessingState({
        ...state,
        urlStatuses: { ...urlStatuses },
        results: [...results],
      });
    } finally {
      stateUpdateInProgress = false;
      // Process any updates that arrived during this write
      if (pendingUpdates.length > 0) {
        await processStateUpdates();
      }
    }
  };

  try {
    const config = await getConfig();
    const provider = createDefaultProvider(config);

    const onProgress = async (url: string, status: string) => {
      if (cancelRequested) return;
      pendingUpdates.push({ url, status });
      await processStateUpdates();
    };

    // BUG #2 FIX: Ensure retry status always transitions to final state
    const extractWithRetryStatus = async (url: string): Promise<ExtractedContent> => {
      let result: ExtractedContent;

      if (isSocialMediaUrl(url)) {
        result = await extractViaDom(url, () => {
          onProgress(url, "retrying");
        });
      } else {
        result = await fetchAndExtract(url);
      }

      // Ensure final state is set after extraction completes
      // This prevents URLs from getting stuck at "retrying"
      if (result.status === "failed") {
        const isTimeout = result.error?.startsWith("Timed out after") ?? false;
        await onProgress(url, isTimeout ? "timeout" : "failed");
      }

      return result;
    };

    const allResults = await processUrls(
      normalizedUrls,
      config,
      provider,
      onProgress,
      extractWithRetryStatus,
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
    else if (result.status === "timeout") urlStatuses[result.url] = "timeout";
    else if (result.status === "cancelled") urlStatuses[result.url] = "cancelled";
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

  if (result && (result.status === "success" || result.status === "review")) {
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
      clearAllProcessingTabs();
      getProcessingState().then(async (state) => {
        if (state) {
          // Mark all non-terminal URLs as cancelled
          const terminalStatuses = new Set(["done", "failed", "skipped", "review", "timeout", "cancelled"]);
          const updatedStatuses = { ...state.urlStatuses };
          for (const url of state.urls) {
            if (!terminalStatuses.has(updatedStatuses[url] ?? "queued")) {
              updatedStatuses[url] = "cancelled";
            }
          }
          await setProcessingState({ ...state, urlStatuses: updatedStatuses, cancelled: true, active: false });
        }
        sendResponse({ type: "PROCESSING_CANCELLED" });
      });
      return true;
    }

    return false;
  }
);
