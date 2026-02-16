import type {
  NotePreview,
  VaultFileEntry,
  VaultHealthResponse,
  VaultListResponse,
} from "@/core/types";
import { VaultClientError } from "@/core/types";
import { MAX_FOLDERS, MAX_TAGS } from "@/utils/config";

const REQUEST_TIMEOUT_MS = 10_000;

export class VaultClient {
  constructor(
    private baseUrl: string,
    private apiKey: string
  ) {}

  /**
   * DRY helper for all REST API calls.
   * Handles auth headers, timeout, and error mapping to VaultClientError.
   * The type assertion on JSON parse is justified: we control the API contract
   * with the Obsidian Local REST API plugin and validate at the call site.
   */
  private async request<T>(
    method: string,
    path: string,
    body?: string
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: "application/json",
    };

    if (body !== undefined) {
      headers["Content-Type"] = "text/markdown";
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body,
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new VaultClientError(
          `Request timed out: ${method} ${path}`,
          null,
          path
        );
      }
      const message = err instanceof Error ? err.message : "Unknown error";
      throw new VaultClientError(
        `Network error: ${message}`,
        null,
        path
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new VaultClientError(
        `HTTP ${response.status}: ${method} ${path}`,
        response.status,
        path
      );
    }

    // Type assertion justified: we control the REST API contract
    return (await response.json()) as T;
  }

  async testConnection(): Promise<boolean> {
    try {
      const health = await this.request<VaultHealthResponse>("GET", "/");
      return health.ok === true && health.authenticated === true;
    } catch {
      return false;
    }
  }

  async listFolders(): Promise<string[]> {
    const rootListing = await this.request<VaultListResponse>(
      "GET",
      "/vault/"
    );

    const folderSet = new Set<string>();

    for (const file of rootListing.files) {
      const lastSlash = file.path.lastIndexOf("/");
      if (lastSlash > 0) {
        const folder = file.path.substring(0, lastSlash);
        folderSet.add(folder);
      }
    }

    // Get top-level folders for 2nd-level depth traversal
    const topLevelFolders = new Set<string>();
    for (const folder of folderSet) {
      const firstSlash = folder.indexOf("/");
      const topLevel = firstSlash > 0 ? folder.substring(0, firstSlash) : folder;
      topLevelFolders.add(topLevel);
    }

    // Fetch subfolders from each top-level directory
    const subfolderPromises = [...topLevelFolders].map(async (topFolder) => {
      try {
        const listing = await this.request<VaultListResponse>(
          "GET",
          `/vault/${encodeURIComponent(topFolder)}/`
        );
        for (const file of listing.files) {
          const lastSlash = file.path.lastIndexOf("/");
          if (lastSlash > 0) {
            folderSet.add(file.path.substring(0, lastSlash));
          }
        }
      } catch {
        // Non-critical: skip if subfolder listing fails
      }
    });

    await Promise.all(subfolderPromises);

    // Filter out dot-prefixed folders (.obsidian, .trash, etc.)
    const filtered = [...folderSet]
      .filter((f) => {
        const segments = f.split("/");
        return !segments.some((s) => s.startsWith("."));
      })
      .sort();

    return filtered.slice(0, MAX_FOLDERS);
  }

  async listTags(): Promise<string[]> {
    const rootListing = await this.request<VaultListResponse>(
      "GET",
      "/vault/"
    );

    const tagCounts = new Map<string, number>();

    for (const file of rootListing.files) {
      if (file.tags) {
        for (const tag of file.tags) {
          tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
        }
      }
    }

    // Sort by frequency (descending), then alphabetically for ties
    const sorted = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag]) => tag);

    return sorted.slice(0, MAX_TAGS);
  }

  async sampleNotes(folder: string, limit: number): Promise<NotePreview[]> {
    const listing = await this.request<VaultListResponse>(
      "GET",
      `/vault/${encodeURIComponent(folder)}/`
    );

    const mdFiles = listing.files
      .filter((f) => f.path.endsWith(".md"))
      .sort((a, b) => b.stat.mtime - a.stat.mtime);

    return mdFiles.slice(0, limit).map((file) => ({
      folder,
      title: extractTitle(file.path),
      tags: file.tags ?? [],
    }));
  }

  async createNote(path: string, content: string): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/vault/${encodeURIComponent(path)}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "text/markdown",
        },
        body: content,
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new VaultClientError(
          `Request timed out: PUT /vault/${path}`,
          null,
          `/vault/${path}`
        );
      }
      const message = err instanceof Error ? err.message : "Unknown error";
      throw new VaultClientError(
        `Network error: ${message}`,
        null,
        `/vault/${path}`
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new VaultClientError(
        `HTTP ${response.status}: PUT /vault/${path}`,
        response.status,
        `/vault/${path}`
      );
    }
  }
}

function extractTitle(filePath: string): string {
  const filename = filePath.substring(filePath.lastIndexOf("/") + 1);
  return filename.replace(/\.md$/, "");
}
