import { describe, it, expect, vi } from "vitest";
import { buildVaultContext } from "@/core/vault-analyzer";
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
