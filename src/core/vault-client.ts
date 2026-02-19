import type {
  NotePreview,
  SearchResult,
  VaultHealthResponse,
  VaultListResponse,
} from "@/core/types";
import { VaultClientError } from "@/core/types";
import { MAX_FOLDERS, MAX_TAGS } from "@/utils/config";

const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Encode a vault path by encoding each segment individually.
 * This preserves forward slashes as path separators while encoding
 * special characters within folder/file names.
 * Using encodeURIComponent on the full path encodes "/" to "%2F",
 * which Chrome's fetch preserves (unlike Bun/Node which normalize it back).
 * The Obsidian REST API treats "%2F" as a literal character, not a path separator.
 */
function encodeVaultPath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

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
    body?: string,
    contentType?: string
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: "application/json",
    };

    if (body !== undefined) {
      headers["Content-Type"] = contentType ?? "text/markdown";
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

  private async requestText(
    method: string,
    path: string,
    body?: string,
    contentType?: string
  ): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: "text/markdown",
    };

    if (body !== undefined) {
      headers["Content-Type"] = contentType ?? "text/plain";
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

    return await response.text();
  }

  async testConnection(): Promise<
    | { ok: true; authenticated: boolean }
    | { ok: false; error?: string }
  > {
    try {
      // Step 1: Health check
      const health = await this.request<VaultHealthResponse>("GET", "/");
      if (health.status !== "OK") {
        return { ok: false, error: "Health check returned non-OK status" };
      }

      // Step 2: Verify actual vault access with a real operation
      // Use searchNotes with a test query - requires authentication
      try {
        await this.searchNotes("test-connection-2vault");
        // If search succeeds, auth is working
        return { ok: true, authenticated: true };
      } catch (searchErr) {
        // If search fails with 401, auth is definitely broken
        if (searchErr instanceof VaultClientError && searchErr.statusCode === 401) {
          return { ok: false, error: "API key authentication failed. Check your vault API key." };
        }
        // For other errors (404, network), check health.authenticated
        if (health.authenticated === true) {
          return { ok: true, authenticated: true };
        }
        return { ok: false, error: "Could not verify vault access" };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[VaultClient] testConnection failed:", err);
      return { ok: false, error: message };
    }
  }

  async listFolders(): Promise<string[]> {
    let rootListing: VaultListResponse;
    try {
      rootListing = await this.request<VaultListResponse>("GET", "/vault/");
    } catch (err) {
      // v3.4.3 bug: GET /vault/ returns 404 or 401 on HTTP endpoint (works on HTTPS).
      // Fall back to empty folder list - notes will use defaultFolder.
      if (err instanceof VaultClientError && (err.statusCode === 404 || err.statusCode === 401)) {
        return [];
      }
      throw err;
    }

    const folderSet = new Set<string>();

    // Extract folder paths from file paths (strings)
    for (const filePath of rootListing.files) {
      const lastSlash = filePath.lastIndexOf("/");
      if (lastSlash > 0) {
        const folder = filePath.substring(0, lastSlash);
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
          `/vault/${encodeVaultPath(topFolder)}/`
        );
        for (const filePath of listing.files) {
          const lastSlash = filePath.lastIndexOf("/");
          if (lastSlash > 0) {
            folderSet.add(filePath.substring(0, lastSlash));
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
    // The Local REST API doesn't have a dedicated tags endpoint.
    // Extract tags from file frontmatter by reading vault files.
    // For now, return empty array - tags will be discovered as notes are processed.
    // A future enhancement could parse YAML frontmatter from sampled notes.
    return [];
  }

  async sampleNotes(folder: string, limit: number): Promise<NotePreview[]> {
    const listing = await this.request<VaultListResponse>(
      "GET",
      `/vault/${encodeVaultPath(folder)}/`
    );

    const mdFiles = listing.files
      .filter((f) => f.endsWith(".md"))
      .slice(0, limit);

    return mdFiles.map((filePath) => ({
      folder,
      title: extractTitle(filePath),
      tags: [],
    }));
  }

  async searchNotes(query: string): Promise<SearchResult[]> {
    // v3.4+ requires query as URL parameter, not body text
    const encoded = encodeURIComponent(query);
    const results = await this.request<
      Array<{ filename: string; score: number }>
    >("POST", `/search/simple/?query=${encoded}`);

    return results.map((r) => ({ filename: r.filename, score: r.score }));
  }

  async readNote(path: string): Promise<string> {
    return this.requestText("GET", `/vault/${encodeVaultPath(path)}`);
  }

  async noteExists(path: string): Promise<boolean> {
    try {
      await this.requestText("GET", `/vault/${encodeVaultPath(path)}`);
      return true;
    } catch (err) {
      if (err instanceof VaultClientError && err.statusCode === 404) {
        return false;
      }
      throw err;
    }
  }

  async appendToNote(path: string, content: string): Promise<void> {
    // v3.4+ PATCH requires Target-Type header and doesn't support simple append.
    // Use read + PUT (overwrite) to append content instead.
    const existing = await this.readNote(path);
    await this.createNote(path, existing + content);
  }

  async createNote(path: string, content: string): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/vault/${encodeVaultPath(path)}`, {
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
