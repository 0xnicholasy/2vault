import type {
  ExtractedContent,
  VaultContext,
  ProcessedNote,
  LLMProvider,
} from "@/core/types.ts";

export class ContentProcessor {
  constructor(private provider: LLMProvider) {}

  async process(
    content: ExtractedContent,
    vaultContext: VaultContext
  ): Promise<ProcessedNote> {
    return this.provider.processContent(content, vaultContext);
  }
}
