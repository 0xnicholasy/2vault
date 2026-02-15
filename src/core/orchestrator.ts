import type { Config, ProcessingResult } from "@/core/types.ts";

export type ProgressCallback = (
  url: string,
  status: string,
  index: number,
  total: number
) => void;

export async function processUrls(
  _urls: string[],
  _config: Config,
  _onProgress?: ProgressCallback
): Promise<ProcessingResult[]> {
  // TODO: Sprint 1.3 - Full pipeline: extract -> analyze vault -> LLM process -> create notes
  throw new Error("Not implemented");
}
