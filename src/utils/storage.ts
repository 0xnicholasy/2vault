import type { Config, VaultContext, ProcessingResult } from "@/core/types.ts";

interface SyncStorage {
  apiKey: string;
  llmProvider: "openrouter";
  vaultUrl: string;
  vaultApiKey: string;
  defaultFolder: string;
}

interface LocalStorage {
  vaultContextCache: VaultContext;
  vaultContextTimestamp: number;
  processingHistory: ProcessingResult[];
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
  const [apiKey, llmProvider, vaultUrl, vaultApiKey, defaultFolder] =
    await Promise.all([
      getSyncStorage("apiKey"),
      getSyncStorage("llmProvider"),
      getSyncStorage("vaultUrl"),
      getSyncStorage("vaultApiKey"),
      getSyncStorage("defaultFolder"),
    ]);

  return {
    apiKey: apiKey ?? "",
    llmProvider: llmProvider ?? "openrouter",
    vaultUrl: vaultUrl ?? "https://localhost:27124",
    vaultApiKey: vaultApiKey ?? "",
    defaultFolder: defaultFolder ?? "Inbox",
  };
}
