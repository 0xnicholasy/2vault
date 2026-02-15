import type { VaultClient } from "@/core/vault-client.ts";
import type { VaultContext } from "@/core/types.ts";

export async function buildVaultContext(
  _client: VaultClient
): Promise<VaultContext> {
  // TODO: Sprint 1.2 - Build vault context for LLM categorization
  throw new Error("Not implemented");
}
