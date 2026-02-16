import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildVaultContext, clearVaultContextCache } from "@/core/vault-analyzer";
import type { VaultClient } from "@/core/vault-client";
import type { NotePreview } from "@/core/types";
import { VaultClientError } from "@/core/types";

function createMockClient(overrides?: Partial<VaultClient>): VaultClient {
  return {
    testConnection: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
    listFolders: vi
      .fn<() => Promise<string[]>>()
      .mockResolvedValue([
        "Daily",
        "Inbox",
        "Projects/2Vault",
        "Reading/Articles",
        "Reading/Books",
        "Resources/AI",
        "Resources/Programming",
      ]),
    listTags: vi
      .fn<() => Promise<string[]>>()
      .mockResolvedValue([
        "ai",
        "programming",
        "architecture",
        "typescript",
        "rust",
      ]),
    sampleNotes: vi
      .fn<(folder: string, limit: number) => Promise<NotePreview[]>>()
      .mockImplementation((folder: string) =>
        Promise.resolve([
          { folder, title: "Sample Note 1", tags: ["ai"] },
          { folder, title: "Sample Note 2", tags: ["programming"] },
        ])
      ),
    createNote: vi
      .fn<(path: string, content: string) => Promise<void>>()
      .mockResolvedValue(undefined),
    ...overrides,
  } as VaultClient;
}

beforeEach(() => {
  clearVaultContextCache();
});

// -- buildVaultContext ---------------------------------------------------------

describe("buildVaultContext", () => {
  it("returns complete VaultContext structure", async () => {
    const client = createMockClient();

    const ctx = await buildVaultContext(client);

    expect(ctx).toHaveProperty("folders");
    expect(ctx).toHaveProperty("tags");
    expect(ctx).toHaveProperty("recentNotes");
    expect(Array.isArray(ctx.folders)).toBe(true);
    expect(Array.isArray(ctx.tags)).toBe(true);
    expect(Array.isArray(ctx.recentNotes)).toBe(true);
  });

  it("includes all folders from client", async () => {
    const client = createMockClient();

    const ctx = await buildVaultContext(client);

    expect(ctx.folders).toEqual([
      "Daily",
      "Inbox",
      "Projects/2Vault",
      "Reading/Articles",
      "Reading/Books",
      "Resources/AI",
      "Resources/Programming",
    ]);
  });

  it("includes all tags from client", async () => {
    const client = createMockClient();

    const ctx = await buildVaultContext(client);

    expect(ctx.tags).toEqual([
      "ai",
      "programming",
      "architecture",
      "typescript",
      "rust",
    ]);
  });

  it("fetches folders and tags in parallel", async () => {
    const callOrder: string[] = [];
    const client = createMockClient({
      listFolders: vi.fn<() => Promise<string[]>>().mockImplementation(() => {
        callOrder.push("folders-start");
        return Promise.resolve([]).then((r) => {
          callOrder.push("folders-end");
          return r;
        });
      }),
      listTags: vi.fn<() => Promise<string[]>>().mockImplementation(() => {
        callOrder.push("tags-start");
        return Promise.resolve([]).then((r) => {
          callOrder.push("tags-end");
          return r;
        });
      }),
    } as Partial<VaultClient>);

    await buildVaultContext(client);

    // Both should start before either ends (parallel execution)
    expect(callOrder.indexOf("folders-start")).toBeLessThan(
      callOrder.indexOf("folders-end")
    );
    expect(callOrder.indexOf("tags-start")).toBeLessThan(
      callOrder.indexOf("tags-end")
    );
  });

  it("samples notes from each folder", async () => {
    const client = createMockClient();

    const ctx = await buildVaultContext(client);

    // 7 folders * 2 notes each = 14 notes
    expect(ctx.recentNotes.length).toBe(14);
    expect(client.sampleNotes).toHaveBeenCalledTimes(7);
  });

  it("caps folder sampling at 10 folders", async () => {
    const manyFolders = Array.from(
      { length: 15 },
      (_, i) => `Folder${i}`
    );
    const client = createMockClient({
      listFolders: vi
        .fn<() => Promise<string[]>>()
        .mockResolvedValue(manyFolders),
    } as Partial<VaultClient>);

    await buildVaultContext(client);

    // Should only sample first 10 folders
    expect(client.sampleNotes).toHaveBeenCalledTimes(10);
  });

  it("handles empty vault gracefully", async () => {
    const client = createMockClient({
      listFolders: vi
        .fn<() => Promise<string[]>>()
        .mockResolvedValue([]),
      listTags: vi
        .fn<() => Promise<string[]>>()
        .mockResolvedValue([]),
    } as Partial<VaultClient>);

    const ctx = await buildVaultContext(client);

    expect(ctx.folders).toEqual([]);
    expect(ctx.tags).toEqual([]);
    expect(ctx.recentNotes).toEqual([]);
  });

  it("propagates VaultClientError from listFolders", async () => {
    const client = createMockClient({
      listFolders: vi.fn<() => Promise<string[]>>().mockRejectedValue(
        new VaultClientError("HTTP 403: GET /vault/", 403, "/vault/")
      ),
    } as Partial<VaultClient>);

    await expect(buildVaultContext(client)).rejects.toThrow(
      VaultClientError
    );
  });

  it("propagates VaultClientError from listTags", async () => {
    const client = createMockClient({
      listTags: vi.fn<() => Promise<string[]>>().mockRejectedValue(
        new VaultClientError("Network error", null, "/vault/")
      ),
    } as Partial<VaultClient>);

    await expect(buildVaultContext(client)).rejects.toThrow(
      VaultClientError
    );
  });
});

// -- Caching ------------------------------------------------------------------

describe("buildVaultContext - caching", () => {
  it("returns cached context on second call within TTL", async () => {
    const client = createMockClient();

    const ctx1 = await buildVaultContext(client);
    const ctx2 = await buildVaultContext(client);

    expect(ctx1).toBe(ctx2);
    // listFolders should only be called once (second call uses cache)
    expect(client.listFolders).toHaveBeenCalledTimes(1);
    expect(client.listTags).toHaveBeenCalledTimes(1);
  });

  it("fetches fresh after TTL expires", async () => {
    const client = createMockClient();

    // Spy on Date.now to control time
    const realDateNow = Date.now;
    let fakeNow = realDateNow.call(Date);
    vi.spyOn(Date, "now").mockImplementation(() => fakeNow);

    await buildVaultContext(client);
    expect(client.listFolders).toHaveBeenCalledTimes(1);

    // Advance time past the TTL (1 hour + 1ms)
    fakeNow += 60 * 60 * 1000 + 1;

    await buildVaultContext(client);
    expect(client.listFolders).toHaveBeenCalledTimes(2);

    vi.restoreAllMocks();
  });

  it("clearVaultContextCache forces refresh", async () => {
    const client = createMockClient();

    await buildVaultContext(client);
    expect(client.listFolders).toHaveBeenCalledTimes(1);

    clearVaultContextCache();

    await buildVaultContext(client);
    expect(client.listFolders).toHaveBeenCalledTimes(2);
  });
});

// -- Promise.allSettled -------------------------------------------------------

describe("buildVaultContext - resilient folder sampling", () => {
  it("succeeds even if some folder sampling fails", async () => {
    let callCount = 0;
    const client = createMockClient({
      listFolders: vi
        .fn<() => Promise<string[]>>()
        .mockResolvedValue(["Good1", "Bad", "Good2"]),
      sampleNotes: vi
        .fn<(folder: string, limit: number) => Promise<NotePreview[]>>()
        .mockImplementation((folder: string) => {
          callCount++;
          if (folder === "Bad") {
            return Promise.reject(new Error("Folder read failed"));
          }
          return Promise.resolve([
            { folder, title: "Note", tags: [] },
          ]);
        }),
    } as Partial<VaultClient>);

    const ctx = await buildVaultContext(client);

    expect(callCount).toBe(3);
    // Only notes from Good1 and Good2 (Bad was rejected)
    expect(ctx.recentNotes).toHaveLength(2);
    expect(ctx.recentNotes[0]!.folder).toBe("Good1");
    expect(ctx.recentNotes[1]!.folder).toBe("Good2");
  });
});
