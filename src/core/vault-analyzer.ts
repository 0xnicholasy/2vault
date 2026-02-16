import type { VaultClient } from "@/core/vault-client";
import type { VaultContext } from "@/core/types";
import { VAULT_CONTEXT_CACHE_TTL } from "@/utils/config";

const MAX_SAMPLED_FOLDERS = 10;
const NOTES_PER_FOLDER = 5;

let cachedContext: VaultContext | null = null;
let cacheTimestamp = 0;

export function clearVaultContextCache(): void {
  cachedContext = null;
  cacheTimestamp = 0;
}

export async function buildVaultContext(
  client: VaultClient
): Promise<VaultContext> {
  const now = Date.now();
  if (cachedContext && now - cacheTimestamp < VAULT_CONTEXT_CACHE_TTL) {
    return cachedContext;
  }

  const [folders, tags] = await Promise.all([
    client.listFolders(),
    client.listTags(),
  ]);

  const foldersToSample = folders.slice(0, MAX_SAMPLED_FOLDERS);

  const results = await Promise.allSettled(
    foldersToSample.map((folder) =>
      client.sampleNotes(folder, NOTES_PER_FOLDER)
    )
  );

  const recentNotes = results
    .filter(
      (r): r is PromiseFulfilledResult<Awaited<ReturnType<VaultClient["sampleNotes"]>>> =>
        r.status === "fulfilled"
    )
    .flatMap((r) => r.value);

  const context: VaultContext = { folders, tags, recentNotes };
  cachedContext = context;
  cacheTimestamp = now;

  return context;
}
