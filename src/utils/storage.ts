import type { Config, VaultContext, ProcessingResult } from "@/core/types.ts";
import type { ProcessingState } from "@/background/messages.ts";

interface SyncStorage {
  apiKey: string;
  llmProvider: "openrouter";
  vaultUrl: string;
  vaultApiKey: string;
  defaultFolder: string;
  vaultName: string;
}

interface LocalStorage {
  vaultContextCache: VaultContext;
  vaultContextTimestamp: number;
  processingHistory: ProcessingResult[];
  processingState: ProcessingState;
}

export async function getSyncStorage<K extends keyof SyncStorage>(
  key: K
): Promise<SyncStorage[K] | undefined> {
  const result = await chrome.storage.sync.get(key);
  return result[key] as SyncStorage[K] | undefined;
}

export async function setSyncStorage<K extends keyof SyncStorage>(
  key: K,
  value: SyncStorage[K]
): Promise<void> {
  await chrome.storage.sync.set({ [key]: value });
}

export async function getLocalStorage<K extends keyof LocalStorage>(
  key: K
): Promise<LocalStorage[K] | undefined> {
  const result = await chrome.storage.local.get(key);
  return result[key] as LocalStorage[K] | undefined;
}

export async function setLocalStorage<K extends keyof LocalStorage>(
  key: K,
  value: LocalStorage[K]
): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export async function getConfig(): Promise<Config> {
  const [apiKey, llmProvider, vaultUrl, vaultApiKey, defaultFolder, vaultName] =
    await Promise.all([
      getSyncStorage("apiKey"),
      getSyncStorage("llmProvider"),
      getSyncStorage("vaultUrl"),
      getSyncStorage("vaultApiKey"),
      getSyncStorage("defaultFolder"),
      getSyncStorage("vaultName"),
    ]);

  return {
    apiKey: apiKey ?? "",
    llmProvider: llmProvider ?? "openrouter",
    vaultUrl: vaultUrl ?? "https://localhost:27124",
    vaultApiKey: vaultApiKey ?? "",
    defaultFolder: defaultFolder ?? "Inbox",
    vaultName: vaultName ?? "",
  };
}

export async function getProcessingState(): Promise<ProcessingState | null> {
  const state = await getLocalStorage("processingState");
  return state ?? null;
}

export async function setProcessingState(
  state: ProcessingState
): Promise<void> {
  await setLocalStorage("processingState", state);
}

export async function clearProcessingState(): Promise<void> {
  await chrome.storage.local.remove("processingState");
}

export async function getProcessingHistory(): Promise<ProcessingResult[]> {
  const history = await getLocalStorage("processingHistory");
  return history ?? [];
}

export async function clearProcessingHistory(): Promise<void> {
  await chrome.storage.local.remove("processingHistory");
}
