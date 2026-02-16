import type { VaultClient } from "@/core/vault-client";
import type { VaultContext } from "@/core/types";

const MAX_SAMPLED_FOLDERS = 10;
const NOTES_PER_FOLDER = 5;

export async function buildVaultContext(
  client: VaultClient
): Promise<VaultContext> {
  const [folders, tags] = await Promise.all([
    client.listFolders(),
    client.listTags(),
  ]);

  const foldersToSample = folders.slice(0, MAX_SAMPLED_FOLDERS);

  const noteArrays = await Promise.all(
    foldersToSample.map((folder) =>
      client.sampleNotes(folder, NOTES_PER_FOLDER)
    )
  );

  const recentNotes = noteArrays.flat();

  return { folders, tags, recentNotes };
}
