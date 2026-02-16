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
  it("returns true when vault is reachable and authenticated", async () => {
    mockFetch.mockResolvedValue(healthResponse(true));
    const client = new VaultClient(VAULT_URL, API_KEY);

    expect(await client.testConnection()).toBe(true);
  });

  it("returns false when not authenticated", async () => {
    mockFetch.mockResolvedValue(healthResponse(false));
    const client = new VaultClient(VAULT_URL, API_KEY);

    expect(await client.testConnection()).toBe(false);
  });

  it("returns false on network failure", async () => {
    mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));
    const client = new VaultClient(VAULT_URL, API_KEY);

    expect(await client.testConnection()).toBe(false);
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

  it("calls the root endpoint", async () => {
    mockFetch.mockResolvedValue(healthResponse(true));
    const client = new VaultClient(VAULT_URL, API_KEY);

    await client.testConnection();

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toBe(`${VAULT_URL}/`);
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

// -- Error handling -----------------------------------------------------------

describe("VaultClient error handling", () => {
  it("throws VaultClientError with statusCode on HTTP errors", async () => {
    mockFetch.mockResolvedValue(
      new Response("Not found", { status: 404 })
    );
    const client = new VaultClient(VAULT_URL, API_KEY);

    try {
      await client.listFolders();
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(VaultClientError);
      const vaultErr = err as VaultClientError;
      expect(vaultErr.statusCode).toBe(404);
      expect(vaultErr.endpoint).toBe("/vault/");
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
