import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { VaultClient } from "@/core/vault-client";
import { VaultClientError } from "@/core/types";
import type { VaultListResponse, VaultHealthResponse } from "@/core/types";

const fixturesDir = resolve(__dirname, "../fixtures");

function readFixtureJSON<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(fixturesDir, path), "utf-8")) as T;
}

const ROOT_LISTING = readFixtureJSON<VaultListResponse>(
  "vault/root-listing.json"
);

const VAULT_URL = "https://localhost:27124";
const API_KEY = "test-api-key-123";

const mockFetch = vi.fn();

function jsonResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function healthResponse(
  authenticated: boolean,
  status = "OK"
): Response {
  return jsonResponse<VaultHealthResponse>({
    authenticated,
    status,
    service: "Obsidian Local REST API",
    versions: { self: "1.0.0" },
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockReset();
});

// -- testConnection -----------------------------------------------------------

describe("VaultClient.testConnection", () => {
  it("returns ok+authenticated when vault is reachable and authenticated", async () => {
    mockFetch.mockResolvedValue(healthResponse(true));
    const client = new VaultClient(VAULT_URL, API_KEY);

    expect(await client.testConnection()).toEqual({ ok: true, authenticated: true });
  });

  it("returns error when search fails with 401", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url === `${VAULT_URL}/`) {
        return Promise.resolve(healthResponse(false));
      }
      if (url.includes("/search/simple/")) {
        return Promise.resolve(new Response("Unauthorized", { status: 401 }));
      }
      return Promise.reject(new Error("Unexpected URL"));
    });
    const client = new VaultClient(VAULT_URL, API_KEY);

    const result = await client.testConnection();
    expect(result.ok).toBe(false);
    expect(result.error).toContain("API key authentication failed");
  });

  it("returns not ok on network failure", async () => {
    mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));
    const client = new VaultClient(VAULT_URL, API_KEY);

    const result = await client.testConnection();
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("sends correct Authorization header", async () => {
    mockFetch.mockResolvedValue(healthResponse(true));
    const client = new VaultClient(VAULT_URL, API_KEY);

    await client.testConnection();

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((options.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${API_KEY}`
    );
  });

  it("calls health endpoint and search endpoint", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url === `${VAULT_URL}/`) {
        return Promise.resolve(healthResponse(true));
      }
      if (url.includes("/search/simple/")) {
        return Promise.resolve(jsonResponse([]));
      }
      return Promise.reject(new Error("Unexpected URL"));
    });
    const client = new VaultClient(VAULT_URL, API_KEY);

    await client.testConnection();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/search/simple/"),
      expect.anything()
    );
  });

  it("returns not ok when health.status is not 'OK'", async () => {
    mockFetch.mockResolvedValue(healthResponse(true, "DEGRADED"));
    const client = new VaultClient(VAULT_URL, API_KEY);

    const result = await client.testConnection();
    expect(result.ok).toBe(false);
    expect(result.error).toContain("non-OK status");
  });

  it("returns not ok on timeout (AbortError)", async () => {
    mockFetch.mockRejectedValue(
      new DOMException("The operation was aborted", "AbortError")
    );
    const client = new VaultClient(VAULT_URL, API_KEY);

    const result = await client.testConnection();
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("returns not ok on HTTP 500 server error", async () => {
    mockFetch.mockResolvedValue(new Response("Internal Server Error", { status: 500 }));
    const client = new VaultClient(VAULT_URL, API_KEY);

    const result = await client.testConnection();
    expect(result.ok).toBe(false);
    expect(result.error).toContain("HTTP 500");
  });

  it("returns not ok on HTTP 401 unauthorized", async () => {
    mockFetch.mockResolvedValue(new Response("Unauthorized", { status: 401 }));
    const client = new VaultClient(VAULT_URL, API_KEY);

    const result = await client.testConnection();
    expect(result.ok).toBe(false);
    expect(result.error).toContain("HTTP 401");
  });

  it("returns ok when search operation succeeds even if health.authenticated missing", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url === `${VAULT_URL}/`) {
        return Promise.resolve(
          jsonResponse({ status: "OK", service: "Obsidian Local REST API", versions: { self: "1.0.0" } })
        );
      }
      if (url.includes("/search/simple/")) {
        return Promise.resolve(jsonResponse([])); // Search succeeds
      }
      return Promise.reject(new Error("Unexpected URL"));
    });
    const client = new VaultClient(VAULT_URL, API_KEY);

    expect(await client.testConnection()).toEqual({ ok: true, authenticated: true });
  });

  it("verifies vault access with real search operation", async () => {
    const HTTP_VAULT_URL = "http://localhost:27123";
    // Mock health check + search operation
    mockFetch.mockImplementation((url: string) => {
      if (url === `${HTTP_VAULT_URL}/`) {
        return Promise.resolve(healthResponse(false));
      }
      if (url.includes("/search/simple/")) {
        return Promise.resolve(jsonResponse([])); // Empty search results = auth working
      }
      return Promise.reject(new Error("Unexpected URL"));
    });
    const client = new VaultClient(HTTP_VAULT_URL, API_KEY);

    // Now actually verifies vault access with searchNotes
    expect(await client.testConnection()).toEqual({ ok: true, authenticated: true });
  });
});

// -- listFolders --------------------------------------------------------------

describe("VaultClient.listFolders", () => {
  function setupWithRootAndSubfolders(): void {
    mockFetch.mockImplementation((url: string) => {
      if (url === `${VAULT_URL}/vault/`) {
        return Promise.resolve(jsonResponse(ROOT_LISTING));
      }
      // Subfolder listings return empty for simplicity
      return Promise.resolve(jsonResponse({ files: [] }));
    });
  }

  it("extracts unique folders from file paths", async () => {
    setupWithRootAndSubfolders();
    const client = new VaultClient(VAULT_URL, API_KEY);

    const folders = await client.listFolders();

    expect(folders).toContain("Resources/AI");
    expect(folders).toContain("Resources/Programming");
    expect(folders).toContain("Projects/2Vault");
    expect(folders).toContain("Daily");
    expect(folders).toContain("Inbox");
  });

  it("excludes dot-prefixed folders", async () => {
    setupWithRootAndSubfolders();
    const client = new VaultClient(VAULT_URL, API_KEY);

    const folders = await client.listFolders();

    expect(folders).not.toContain(".obsidian");
    expect(folders).not.toContain(".trash");
    for (const f of folders) {
      const segments = f.split("/");
      for (const seg of segments) {
        expect(seg.startsWith(".")).toBe(false);
      }
    }
  });

  it("returns folders sorted alphabetically", async () => {
    setupWithRootAndSubfolders();
    const client = new VaultClient(VAULT_URL, API_KEY);

    const folders = await client.listFolders();

    const sorted = [...folders].sort();
    expect(folders).toEqual(sorted);
  });

  it("fetches subfolder listings for 2-level depth", async () => {
    setupWithRootAndSubfolders();
    const client = new VaultClient(VAULT_URL, API_KEY);

    await client.listFolders();

    const calledUrls = mockFetch.mock.calls.map(
      (call) => (call as [string])[0]
    );
    expect(calledUrls).toContain(`${VAULT_URL}/vault/`);
    expect(
      calledUrls.some((u) => u.includes("/vault/Resources/"))
    ).toBe(true);
  });

  it("discovers subfolders from second-level listings", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url === `${VAULT_URL}/vault/`) {
        return Promise.resolve(
          jsonResponse({ files: ["Resources/note.md"] })
        );
      }
      if (url.includes("/vault/Resources/")) {
        return Promise.resolve(
          jsonResponse({ files: ["Resources/Deep/Nested/file.md"] })
        );
      }
      return Promise.resolve(jsonResponse({ files: [] }));
    });

    const client = new VaultClient(VAULT_URL, API_KEY);
    const folders = await client.listFolders();

    expect(folders).toContain("Resources/Deep/Nested");
  });

  it("caps at MAX_FOLDERS (50)", async () => {
    const manyFiles = Array.from(
      { length: 60 },
      (_, i) => `Folder${String(i).padStart(3, "0")}/note.md`
    );

    mockFetch.mockImplementation((url: string) => {
      if (url === `${VAULT_URL}/vault/`) {
        return Promise.resolve(jsonResponse({ files: manyFiles }));
      }
      return Promise.resolve(jsonResponse({ files: [] }));
    });

    const client = new VaultClient(VAULT_URL, API_KEY);
    const folders = await client.listFolders();

    expect(folders.length).toBeLessThanOrEqual(50);
  });

  it("handles empty vault", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ files: [] }));
    const client = new VaultClient(VAULT_URL, API_KEY);

    const folders = await client.listFolders();

    expect(folders).toEqual([]);
  });
});

// -- listTags -----------------------------------------------------------------

describe("VaultClient.listTags", () => {
  it("returns empty array (no dedicated tags endpoint)", async () => {
    const client = new VaultClient(VAULT_URL, API_KEY);

    const tags = await client.listTags();

    expect(tags).toEqual([]);
  });
});

// -- sampleNotes --------------------------------------------------------------

describe("VaultClient.sampleNotes", () => {
  const folderListing: VaultListResponse = {
    files: [
      "Resources/AI/GPT-4 Architecture.md",
      "Resources/AI/Prompt Engineering Guide.md",
      "Resources/AI/image.png",
      "Resources/AI/Old Note.md",
    ],
  };

  it("returns NotePreview objects with correct shape", async () => {
    mockFetch.mockResolvedValue(jsonResponse(folderListing));
    const client = new VaultClient(VAULT_URL, API_KEY);

    const notes = await client.sampleNotes("Resources/AI", 5);

    expect(notes[0]).toEqual({
      folder: "Resources/AI",
      title: "GPT-4 Architecture",
      tags: [],
    });
  });

  it("filters out non-.md files", async () => {
    mockFetch.mockResolvedValue(jsonResponse(folderListing));
    const client = new VaultClient(VAULT_URL, API_KEY);

    const notes = await client.sampleNotes("Resources/AI", 10);

    const titles = notes.map((n) => n.title);
    expect(titles).not.toContain("image");
    expect(notes).toHaveLength(3);
  });

  it("respects limit parameter", async () => {
    mockFetch.mockResolvedValue(jsonResponse(folderListing));
    const client = new VaultClient(VAULT_URL, API_KEY);

    const notes = await client.sampleNotes("Resources/AI", 2);

    expect(notes.length).toBe(2);
  });

  it("extracts title from filename (strips .md)", async () => {
    mockFetch.mockResolvedValue(jsonResponse(folderListing));
    const client = new VaultClient(VAULT_URL, API_KEY);

    const notes = await client.sampleNotes("Resources/AI", 1);

    expect(notes[0]!.title).toBe("GPT-4 Architecture");
  });

  it("returns empty tags for all notes", async () => {
    mockFetch.mockResolvedValue(jsonResponse(folderListing));
    const client = new VaultClient(VAULT_URL, API_KEY);

    const notes = await client.sampleNotes("Resources/AI", 10);

    for (const note of notes) {
      expect(note.tags).toEqual([]);
    }
  });
});

// -- createNote ---------------------------------------------------------------

describe("VaultClient.createNote", () => {
  it("sends PUT with correct path and content-type", async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 204 }));
    const client = new VaultClient(VAULT_URL, API_KEY);

    await client.createNote("Inbox/My Note.md", "# Hello\nContent here");

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/vault/");
    expect(options.method).toBe("PUT");
    expect(
      (options.headers as Record<string, string>)["Content-Type"]
    ).toBe("text/markdown");
    expect(options.body).toBe("# Hello\nContent here");
  });

  it("sends Authorization header", async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 204 }));
    const client = new VaultClient(VAULT_URL, API_KEY);

    await client.createNote("test.md", "content");

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(
      (options.headers as Record<string, string>).Authorization
    ).toBe(`Bearer ${API_KEY}`);
  });

  it("throws VaultClientError on HTTP error", async () => {
    mockFetch.mockResolvedValue(
      new Response("Forbidden", { status: 403 })
    );
    const client = new VaultClient(VAULT_URL, API_KEY);

    await expect(
      client.createNote("test.md", "content")
    ).rejects.toThrow(VaultClientError);
  });
});

// -- Path encoding ------------------------------------------------------------

describe("VaultClient path encoding", () => {
  it("encodes path segments individually, preserving slashes", async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 204 }));
    const client = new VaultClient(VAULT_URL, API_KEY);

    await client.createNote("Inbox/my-note.md", "content");

    const [url] = mockFetch.mock.calls[0] as [string];
    // Slash between Inbox and my-note.md must NOT be encoded
    expect(url).toBe(`${VAULT_URL}/vault/Inbox/my-note.md`);
    expect(url).not.toContain("%2F");
  });

  it("encodes special characters in folder and file names", async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 204 }));
    const client = new VaultClient(VAULT_URL, API_KEY);

    await client.createNote("My Notes/AI & ML/note #1.md", "content");

    const [url] = mockFetch.mock.calls[0] as [string];
    // Slashes preserved, special chars encoded
    expect(url).toContain("/vault/My%20Notes/AI%20%26%20ML/note%20%231.md");
    expect(url).not.toContain("%2F");
  });

  it("encodes spaces in path correctly", async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 204 }));
    const client = new VaultClient(VAULT_URL, API_KEY);

    await client.createNote("My Folder/my note.md", "content");

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toBe(`${VAULT_URL}/vault/My%20Folder/my%20note.md`);
  });

  it("uses per-segment encoding in listFolders subfolder requests", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url === `${VAULT_URL}/vault/`) {
        return Promise.resolve(
          jsonResponse({ files: ["My Folder/note.md"] })
        );
      }
      return Promise.resolve(jsonResponse({ files: [] }));
    });

    const client = new VaultClient(VAULT_URL, API_KEY);
    await client.listFolders();

    const calledUrls = mockFetch.mock.calls.map(
      (call) => (call as [string])[0]
    );
    const subfolderCall = calledUrls.find((u) =>
      u.includes("My%20Folder")
    );
    expect(subfolderCall).toBeDefined();
    expect(subfolderCall).not.toContain("%2F");
  });

  it("uses per-segment encoding in sampleNotes", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ files: ["Resources/AI/note.md"] }));
    const client = new VaultClient(VAULT_URL, API_KEY);

    await client.sampleNotes("Resources/AI", 5);

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toBe(`${VAULT_URL}/vault/Resources/AI/`);
    expect(url).not.toContain("%2F");
  });
});

// -- Error handling -----------------------------------------------------------

describe("VaultClient error handling", () => {
  it("returns empty array on 404 from listFolders (v3.4.3 HTTP fallback)", async () => {
    mockFetch.mockResolvedValue(
      new Response("Not found", { status: 404 })
    );
    const client = new VaultClient(VAULT_URL, API_KEY);

    const folders = await client.listFolders();
    expect(folders).toEqual([]);
  });

  it("throws VaultClientError on non-404 HTTP errors from listFolders", async () => {
    mockFetch.mockResolvedValue(
      new Response("Server error", { status: 500 })
    );
    const client = new VaultClient(VAULT_URL, API_KEY);

    try {
      await client.listFolders();
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(VaultClientError);
      const vaultErr = err as VaultClientError;
      expect(vaultErr.statusCode).toBe(500);
    }
  });

  it("throws VaultClientError with null statusCode on network errors", async () => {
    mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));
    const client = new VaultClient(VAULT_URL, API_KEY);

    try {
      await client.listFolders();
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(VaultClientError);
      const vaultErr = err as VaultClientError;
      expect(vaultErr.statusCode).toBeNull();
      expect(vaultErr.message).toContain("Network error");
    }
  });

  it("throws VaultClientError on timeout (AbortError)", async () => {
    const abortError = new DOMException(
      "The operation was aborted",
      "AbortError"
    );
    mockFetch.mockRejectedValue(abortError);
    const client = new VaultClient(VAULT_URL, API_KEY);

    try {
      await client.listFolders();
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(VaultClientError);
      const vaultErr = err as VaultClientError;
      expect(vaultErr.message).toContain("timed out");
      expect(vaultErr.statusCode).toBeNull();
    }
  });
});

// -- searchNotes --------------------------------------------------------------

describe("VaultClient.searchNotes", () => {
  it("sends POST with query as URL parameter (v3.4+ format)", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse([{ filename: "Inbox/note.md", score: 1.0 }])
    );
    const client = new VaultClient(VAULT_URL, API_KEY);

    const results = await client.searchNotes("https://example.com/article");

    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/search/simple/?query=");
    expect(url).toContain(encodeURIComponent("https://example.com/article"));
    expect(options.method).toBe("POST");
    expect(results).toHaveLength(1);
    expect(results[0]!.filename).toBe("Inbox/note.md");
  });

  it("returns empty array on empty search results", async () => {
    mockFetch.mockResolvedValue(jsonResponse([]));
    const client = new VaultClient(VAULT_URL, API_KEY);

    const results = await client.searchNotes("nonexistent");

    expect(results).toEqual([]);
  });
});

// -- readNote -----------------------------------------------------------------

describe("VaultClient.readNote", () => {
  it("returns note content as text", async () => {
    const noteContent = "---\nsource: https://example.com\n---\n# My Note";
    mockFetch.mockResolvedValue(
      new Response(noteContent, { status: 200 })
    );
    const client = new VaultClient(VAULT_URL, API_KEY);

    const content = await client.readNote("Inbox/My Note.md");

    expect(content).toBe(noteContent);
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain("/vault/Inbox/My%20Note.md");
  });

  it("sends Accept: text/markdown header", async () => {
    mockFetch.mockResolvedValue(new Response("content", { status: 200 }));
    const client = new VaultClient(VAULT_URL, API_KEY);

    await client.readNote("test.md");

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((options.headers as Record<string, string>).Accept).toBe("text/markdown");
  });
});

// -- noteExists ---------------------------------------------------------------

describe("VaultClient.noteExists", () => {
  it("returns true when note exists (200)", async () => {
    mockFetch.mockResolvedValue(new Response("content", { status: 200 }));
    const client = new VaultClient(VAULT_URL, API_KEY);

    expect(await client.noteExists("Inbox/note.md")).toBe(true);
  });

  it("returns false when note does not exist (404)", async () => {
    mockFetch.mockResolvedValue(new Response("Not found", { status: 404 }));
    const client = new VaultClient(VAULT_URL, API_KEY);

    expect(await client.noteExists("Inbox/missing.md")).toBe(false);
  });

  it("throws on other errors", async () => {
    mockFetch.mockResolvedValue(new Response("Server error", { status: 500 }));
    const client = new VaultClient(VAULT_URL, API_KEY);

    await expect(client.noteExists("Inbox/note.md")).rejects.toThrow(VaultClientError);
  });
});

// -- appendToNote -------------------------------------------------------------

describe("VaultClient.appendToNote", () => {
  it("reads existing content then overwrites with appended content (v3.4+ compat)", async () => {
    const existingContent = "# Hub: ai\n- [[old-note]]";
    mockFetch
      // First call: readNote (GET)
      .mockResolvedValueOnce(new Response(existingContent, { status: 200 }))
      // Second call: createNote (PUT)
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const client = new VaultClient(VAULT_URL, API_KEY);
    await client.appendToNote("Tags/ai.md", "\n- [[new-note]]");

    expect(mockFetch).toHaveBeenCalledTimes(2);

    // First call: GET to read existing content
    const [readUrl, readOptions] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(readUrl).toContain("/vault/Tags/ai.md");
    expect(readOptions.method).toBe("GET");

    // Second call: PUT with combined content
    const [writeUrl, writeOptions] = mockFetch.mock.calls[1] as [string, RequestInit];
    expect(writeUrl).toContain("/vault/Tags/ai.md");
    expect(writeOptions.method).toBe("PUT");
    expect(writeOptions.body).toBe("# Hub: ai\n- [[old-note]]\n- [[new-note]]");
  });

  it("throws VaultClientError on read failure", async () => {
    mockFetch.mockResolvedValue(new Response("Not found", { status: 404 }));
    const client = new VaultClient(VAULT_URL, API_KEY);

    await expect(
      client.appendToNote("Tags/missing.md", "content")
    ).rejects.toThrow(VaultClientError);
  });
});
