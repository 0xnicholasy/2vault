import type { NotePreview } from "@/core/types.ts";

export class VaultClient {
  constructor(
    private baseUrl: string,
    private apiKey: string
  ) {}

  async listFolders(): Promise<string[]> {
    // TODO: Sprint 1.2 - GET /vault/ and parse folder structure
    void this.baseUrl;
    void this.apiKey;
    throw new Error("Not implemented");
  }

  async listTags(): Promise<string[]> {
    // TODO: Sprint 1.2 - Extract tags from vault notes
    throw new Error("Not implemented");
  }

  async sampleNotes(
    _folder: string,
    _limit: number
  ): Promise<NotePreview[]> {
    // TODO: Sprint 1.2 - Read sample notes for context
    throw new Error("Not implemented");
  }

  async createNote(_path: string, _content: string): Promise<void> {
    // TODO: Sprint 1.3 - POST /vault/{path}
    throw new Error("Not implemented");
  }

  async testConnection(): Promise<boolean> {
    // TODO: Sprint 1.2 - Verify Obsidian REST API is reachable
    throw new Error("Not implemented");
  }
}
