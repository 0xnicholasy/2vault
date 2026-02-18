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
import { assessContentQuality } from "@/core/content-validator";
import {
  formatNote,
  generateFilename,
  formatTagHubNote,
} from "@/core/note-formatter";

export type ProgressCallback = (url: string, status: string) => void;

export function createDefaultProvider(config: Config): LLMProvider {
  return new OpenRouterProvider(config.apiKey, config.summaryDetailLevel);
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

/** Tracking params to strip during URL normalization */
const TRACKING_PARAMS = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "s", "ref_src", "ref_url", "fbclid", "gclid", "twclid",
  "mc_cid", "mc_eid",
]);

/**
 * Normalize a URL for duplicate comparison.
 * Strips tracking params, normalizes protocol/www/trailing slash/fragment.
 */
export function normalizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);

    // Normalize protocol to https
    url.protocol = "https:";

    // Strip www. prefix
    url.hostname = url.hostname.replace(/^www\./, "");

    // Normalize old.reddit.com -> reddit.com
    if (url.hostname === "old.reddit.com") {
      url.hostname = "reddit.com";
    }

    // Remove tracking params
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key)) {
        url.searchParams.delete(key);
      }
    }

    // Remove fragment
    url.hash = "";

    // Strip trailing slash from pathname
    if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.slice(0, -1);
    }

    // Build normalized string
    let normalized = url.toString();

    // Strip trailing ? if no search params remain
    if (normalized.endsWith("?")) {
      normalized = normalized.slice(0, -1);
    }

    return normalized;
  } catch {
    return rawUrl;
  }
}

/**
 * Check if a URL already exists in the vault by searching for it
 * in note frontmatter source fields. Uses normalized URL comparison.
 */
export async function checkDuplicate(
  url: string,
  client: VaultClient
): Promise<boolean> {
  const normalized = normalizeUrl(url);

  // Use hostname + pathname as search query to avoid special char issues
  let searchQuery: string;
  try {
    const parsed = new URL(url);
    searchQuery = parsed.hostname + parsed.pathname;
  } catch {
    searchQuery = url;
  }

  const results = await client.searchNotes(searchQuery);

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
      if (sourceMatch && normalizeUrl(sourceMatch[1]!) === normalized) {
        return true;
      }
    } catch {
      // If we can't read the note, skip and continue checking others
      continue;
    }
  }

  return false;
}

/**
 * Process a single URL through the full pipeline.
 * Returns a ProcessingResult for this URL.
 */
async function processSingleUrl(
  url: string,
  client: VaultClient,
  provider: LLMProvider,
  vaultContext: VaultContext,
  extract: ExtractFn,
  onProgress: ProgressCallback | undefined,
  createdHubTags: Set<string>,
  isCancelled?: () => boolean
): Promise<ProcessingResult> {
  try {
    // Duplicate check
    onProgress?.(url, "checking");
    if (isCancelled?.()) {
      return { url, status: "failed", error: "Cancelled" };
    }

    try {
      const isDuplicate = await checkDuplicate(url, client);
      if (isDuplicate) {
        onProgress?.(url, "skipped");
        return {
          url,
          status: "skipped",
          skipReason: "Duplicate - note already exists in vault",
        };
      }
    } catch {
      // If duplicate check fails, continue processing (non-critical)
    }

    // Extract content
    if (isCancelled?.()) {
      return { url, status: "failed", error: "Cancelled" };
    }
    onProgress?.(url, "extracting");
    const extracted = await extract(url);

    if (extracted.status === "failed") {
      onProgress?.(url, "failed");
      return {
        url,
        status: "failed",
        error: extracted.error ?? "Extraction failed",
        errorCategory: "extraction",
      };
    }

    // Content quality validation
    const contentQuality = assessContentQuality(extracted);

    // LLM processing
    if (isCancelled?.()) {
      return { url, status: "failed", error: "Cancelled" };
    }
    onProgress?.(url, "processing");
    let processed;
    try {
      processed = await provider.processContent(extracted, vaultContext);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error";
      onProgress?.(url, "failed");
      return {
        url,
        status: "failed",
        error: message,
        errorCategory: categorizeError(err),
      };
    }

    // Create note in vault
    if (isCancelled?.()) {
      return { url, status: "failed", error: "Cancelled" };
    }
    onProgress?.(url, "creating");
    const formatted = formatNote(processed);
    const filename = generateFilename(processed.title);
    const path = `${processed.suggestedFolder}/${filename}`;

    try {
      await client.createNote(path, formatted);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error";
      onProgress?.(url, "failed");
      return {
        url,
        status: "failed",
        error: message,
        errorCategory: categorizeError(err),
      };
    }

    // Hub note post-processing (non-critical)
    try {
      const noteTitle = filename.replace(/\.md$/, "");
      for (const tag of processed.suggestedTags) {
        // Prevent duplicate hub note creation across concurrent URLs
        if (createdHubTags.has(tag)) {
          // Tag hub already handled by another URL in this batch - just append
          try {
            await client.appendToNote(`Tags/${tag}.md`, `\n- [[${noteTitle}]]`);
          } catch {
            // Non-critical
          }
          continue;
        }

        const hubPath = `Tags/${tag}.md`;
        const exists = await client.noteExists(hubPath);
        if (exists) {
          await client.appendToNote(hubPath, `\n- [[${noteTitle}]]`);
        } else {
          const hubContent = formatTagHubNote(tag, [noteTitle]);
          await client.createNote(hubPath, hubContent);
          createdHubTags.add(tag);
        }
      }
    } catch {
      // Hub note failures are non-critical - log silently
    }

    const finalStatus = contentQuality.isLowQuality ? "review" : "success";
    onProgress?.(url, contentQuality.isLowQuality ? "review" : "done");
    return {
      url,
      status: finalStatus,
      note: processed,
      folder: processed.suggestedFolder,
      contentQuality: contentQuality.isLowQuality ? contentQuality : undefined,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error";
    onProgress?.(url, "failed");
    return {
      url,
      status: "failed",
      error: message,
      errorCategory: categorizeError(err),
    };
  }
}

/**
 * Run async tasks with a concurrency limit using a worker pool pattern.
 */
async function processWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  task: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await task(items[index]!);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  );

  await Promise.all(workers);
  return results;
}

const DEFAULT_CONCURRENCY = 5;

export async function processUrls(
  urls: string[],
  config: Config,
  provider: LLMProvider,
  onProgress?: ProgressCallback,
  extractFn?: ExtractFn,
  isCancelled?: () => boolean
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

  // Track hub note tags created during this batch to prevent race conditions
  const createdHubTags = new Set<string>();

  return processWithConcurrency(urls, DEFAULT_CONCURRENCY, (url) =>
    processSingleUrl(
      url,
      client,
      provider,
      vaultContext,
      extract,
      onProgress,
      createdHubTags,
      isCancelled
    )
  );
}
