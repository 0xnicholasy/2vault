import type { Config, LLMProvider, ProcessingResult } from "@/core/types.ts";
import { VaultClient } from "@/core/vault-client";
import { OpenRouterProvider } from "@/core/openrouter-provider";
import { buildVaultContext } from "@/core/vault-analyzer";
import { fetchAndExtract } from "@/core/extractor";
import { formatNote, generateFilename } from "@/core/note-formatter";

export type ProgressCallback = (
  url: string,
  status: string,
  index: number,
  total: number
) => void;

export function createDefaultProvider(config: Config): LLMProvider {
  return new OpenRouterProvider(config.apiKey);
}

export async function processUrls(
  urls: string[],
  config: Config,
  provider: LLMProvider,
  onProgress?: ProgressCallback
): Promise<ProcessingResult[]> {
  const client = new VaultClient(config.vaultUrl, config.vaultApiKey);

  // Build vault context once - failure here aborts entire batch
  const vaultContext = await buildVaultContext(client);

  const results: ProcessingResult[] = [];
  const total = urls.length;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]!;

    try {
      // Extract content
      onProgress?.(url, "extracting", i, total);
      const extracted = await fetchAndExtract(url);

      if (extracted.status === "failed") {
        results.push({
          url,
          status: "failed",
          error: extracted.error ?? "Extraction failed",
        });
        continue;
      }

      // LLM processing
      onProgress?.(url, "processing", i, total);
      let processed;
      try {
        processed = await provider.processContent(extracted, vaultContext);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        results.push({ url, status: "failed", error: message });
        continue;
      }

      // Create note in vault
      onProgress?.(url, "creating", i, total);
      const formatted = formatNote(processed);
      const filename = generateFilename(processed.title);
      const path = `${processed.suggestedFolder}/${filename}`;

      try {
        await client.createNote(path, formatted);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        results.push({ url, status: "failed", error: message });
        continue;
      }

      onProgress?.(url, "done", i, total);
      results.push({
        url,
        status: "success",
        note: processed,
        folder: processed.suggestedFolder,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      results.push({ url, status: "failed", error: message });
    }
  }

  return results;
}
