import type { ProcessingState, UrlStatus } from "@/background/messages.ts";
import type { ProcessingResult } from "@/core/types.ts";
import { processUrls, createDefaultProvider } from "@/core/orchestrator";
import {
  getConfig,
  getProcessingState,
  setProcessingState,
  getLocalStorage,
  setLocalStorage,
} from "@/utils/storage";
import { MAX_HISTORY } from "@/utils/config";

let cancelRequested = false;

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

  const config = await getConfig();
  const provider = createDefaultProvider(config);

  const results: ProcessingResult[] = [];

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

  try {
    const allResults = await processUrls(urls, config, provider, onProgress);
    results.push(...allResults);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed";
    console.error("[2Vault] Batch processing error:", message);
  }

  // Save final state
  await setProcessingState({
    ...state,
    active: false,
    cancelled: cancelRequested,
    results,
    currentIndex: urls.length,
    currentUrl: "",
    currentStatus: "done",
  });

  // Append to processing history
  const history = (await getLocalStorage("processingHistory")) ?? [];
  const updated = [...results, ...history].slice(0, MAX_HISTORY);
  await setLocalStorage("processingHistory", updated);
}

async function handleSingleUrlCapture(url: string): Promise<void> {
  const config = await getConfig();
  if (!config.apiKey || !config.vaultApiKey) {
    console.warn("[2Vault] Missing API keys - configure in extension settings");
    return;
  }

  const provider = createDefaultProvider(config);
  const results = await processUrls([url], config, provider);
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
      const url = tabs[0]?.url;
      if (!url || url.startsWith("chrome://")) {
        console.warn("[2Vault] Cannot capture this page");
        return;
      }
      handleSingleUrlCapture(url).catch((err) => {
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
        runBatchProcessing(urls).catch((err) => {
          console.error("[2Vault] Processing failed:", err);
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

    if (message.type === "EXTRACTED_CONTENT") {
      console.log("[2Vault] Received extracted content", message);
    }

    return false;
  }
);
