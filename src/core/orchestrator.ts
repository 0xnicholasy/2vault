import type {
  Config,
  ErrorCategory,
  ExtractedContent,
  LLMProvider,
  ProcessingResult,
  VaultContext,
} from "@/core/types.ts";
import { VaultClientError, LLMProcessingError } from "@/core/types.ts";
import { VaultClient } from "@/core/vault-client";
import { OpenRouterProvider } from "@/core/openrouter-provider";
import { buildVaultContext } from "@/core/vault-analyzer";
import { fetchAndExtract } from "@/core/extractor";
import {
  formatNote,
  generateFilename,
  formatTagHubNote,
} from "@/core/note-formatter";

export type ProgressCallback = (
  url: string,
  status: string,
  index: number,
  total: number
) => void;

export function createDefaultProvider(config: Config): LLMProvider {
  return new OpenRouterProvider(config.apiKey);
}

export type ExtractFn = (url: string) => Promise<ExtractedContent>;

function categorizeError(err: unknown): ErrorCategory {
  if (err instanceof VaultClientError) return "vault";
  if (err instanceof LLMProcessingError) return "llm";
  if (
    err instanceof TypeError &&
    (err.message.includes("fetch") || err.message.includes("network"))
  )
    return "network";
  return "unknown";
}

/**
 * Check if a URL already exists in the vault by searching for it
 * in note frontmatter source fields.
 */
export async function checkDuplicate(
  url: string,
  client: VaultClient
): Promise<boolean> {
  const results = await client.searchNotes(url);

  for (const result of results) {
    try {
      const content = await client.readNote(result.filename);
      // Parse YAML frontmatter source field
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!frontmatterMatch) continue;

      const frontmatter = frontmatterMatch[1]!;
      const sourceMatch = frontmatter.match(
        /^source:\s*"?([^"\n]+)"?\s*$/m
      );
      if (sourceMatch && sourceMatch[1] === url) {
        return true;
      }
    } catch {
      // If we can't read the note, skip and continue checking others
      continue;
    }
  }

  return false;
}

export async function processUrls(
  urls: string[],
  config: Config,
  provider: LLMProvider,
  onProgress?: ProgressCallback,
  extractFn?: ExtractFn
): Promise<ProcessingResult[]> {
  const client = new VaultClient(config.vaultUrl, config.vaultApiKey);
  const extract = extractFn ?? fetchAndExtract;

  // Build vault context once - failure here aborts entire batch
  const baseVaultContext = await buildVaultContext(client);

  // Merge config-level tag groups and organization into vault context
  const vaultContext: VaultContext = {
    ...baseVaultContext,
    tagGroups: config.tagGroups ?? [],
    organization: config.vaultOrganization ?? "custom",
  };

  const results: ProcessingResult[] = [];
  const total = urls.length;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]!;

    try {
      // Duplicate check
      onProgress?.(url, "checking", i, total);
      try {
        const isDuplicate = await checkDuplicate(url, client);
        if (isDuplicate) {
          onProgress?.(url, "skipped", i, total);
          results.push({
            url,
            status: "skipped",
            skipReason: "Duplicate - note already exists in vault",
          });
          continue;
        }
      } catch {
        // If duplicate check fails, continue processing (non-critical)
      }

      // Extract content
      onProgress?.(url, "extracting", i, total);
      const extracted = await extract(url);

      if (extracted.status === "failed") {
        results.push({
          url,
          status: "failed",
          error: extracted.error ?? "Extraction failed",
          errorCategory: "extraction",
        });
        continue;
      }

      // LLM processing
      onProgress?.(url, "processing", i, total);
      let processed;
      try {
        processed = await provider.processContent(extracted, vaultContext);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error";
        results.push({
          url,
          status: "failed",
          error: message,
          errorCategory: categorizeError(err),
        });
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
        const message =
          err instanceof Error ? err.message : "Unknown error";
        results.push({
          url,
          status: "failed",
          error: message,
          errorCategory: categorizeError(err),
        });
        continue;
      }

      // Hub note post-processing (non-critical)
      try {
        const noteTitle = filename.replace(/\.md$/, "");
        for (const tag of processed.suggestedTags) {
          const hubPath = `Tags/${tag}.md`;
          const exists = await client.noteExists(hubPath);
          if (exists) {
            await client.appendToNote(hubPath, `\n- [[${noteTitle}]]`);
          } else {
            const hubContent = formatTagHubNote(tag, [noteTitle]);
            await client.createNote(hubPath, hubContent);
          }
        }
      } catch {
        // Hub note failures are non-critical - log silently
      }

      onProgress?.(url, "done", i, total);
      results.push({
        url,
        status: "success",
        note: processed,
        folder: processed.suggestedFolder,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error";
      results.push({
        url,
        status: "failed",
        error: message,
        errorCategory: categorizeError(err),
      });
    }
  }

  return results;
}
