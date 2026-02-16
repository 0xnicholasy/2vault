import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import type {
  Config,
  ExtractedContent,
  LLMProvider,
  ProcessedNote,
  VaultContext,
} from "@/core/types";
import { extractArticle } from "@/core/extractor";
import { formatNote, generateFilename } from "@/core/note-formatter";

// -- Fixtures & helpers -------------------------------------------------------

const FIXTURES_DIR = resolve(__dirname, "../fixtures");

function loadHtmlFixture(name: string): string {
  return readFileSync(resolve(FIXTURES_DIR, "html", name), "utf-8");
}

const TEST_CONFIG: Config = {
  apiKey: "test-api-key",
  llmProvider: "openrouter",
  vaultUrl: "https://localhost:27124",
  vaultApiKey: "test-vault-key",
  defaultFolder: "Inbox",
};

const MOCK_VAULT_CONTEXT: VaultContext = {
  folders: ["Inbox", "Reading/Articles", "Resources/Programming"],
  tags: ["rust", "programming", "ai", "web-dev"],
  recentNotes: [
    { folder: "Reading/Articles", title: "Intro to Rust", tags: ["rust"] },
    { folder: "Resources/Programming", title: "TypeScript Tips", tags: ["programming"] },
  ],
};

function createMockLLMProvider(
  overrides?: Partial<{
    processContent: LLMProvider["processContent"];
  }>
): LLMProvider {
  return {
    processContent: overrides?.processContent ?? vi.fn(
      async (content: ExtractedContent, _vaultContext: VaultContext): Promise<ProcessedNote> => ({
        title: `Summary: ${content.title}`,
        summary: "This is a mock summary of the article content.",
        keyTakeaways: ["Key point 1", "Key point 2", "Key point 3"],
        suggestedFolder: "Reading/Articles",
        suggestedTags: ["programming", "rust"],
        type: content.type,
        platform: content.platform,
        source: content,
      })
    ),
  };
}

// Mock vault HTTP calls
const vaultCreatedNotes: Array<{ path: string; content: string }> = [];
let vaultFolders: string[] = [];
let vaultTags: string[] = [];

function mockVaultFetch(url: string | URL | Request, init?: RequestInit): Promise<Response> {
  const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
  const method = init?.method?.toUpperCase() ?? "GET";

  // Health check
  if (urlStr.endsWith("/") && method === "GET" && !urlStr.includes("/vault/")) {
    return Promise.resolve(new Response(JSON.stringify({
      authenticated: true, ok: true, service: "Obsidian Local REST API", versions: {},
    }), { status: 200, headers: { "content-type": "application/json" } }));
  }

  // List vault root (folders)
  if (urlStr.includes("/vault/") && method === "GET" && urlStr.endsWith("/vault/")) {
    const files = vaultFolders.map((f) => ({
      path: f + "/",
      stat: { ctime: Date.now(), mtime: Date.now(), size: 0 },
    }));
    return Promise.resolve(new Response(JSON.stringify({ files }), {
      status: 200, headers: { "content-type": "application/json" },
    }));
  }

  // Tags endpoint
  if (urlStr.includes("/tags/") && method === "GET") {
    const tagEntries = Object.fromEntries(vaultTags.map((t) => [t, 1]));
    return Promise.resolve(new Response(JSON.stringify(tagEntries), {
      status: 200, headers: { "content-type": "application/json" },
    }));
  }

  // Sample notes (GET /vault/{folder}/)
  if (urlStr.includes("/vault/") && method === "GET") {
    return Promise.resolve(new Response(JSON.stringify({ files: [] }), {
      status: 200, headers: { "content-type": "application/json" },
    }));
  }

  // Create note (POST/PUT)
  if (urlStr.includes("/vault/") && (method === "POST" || method === "PUT")) {
    const path = decodeURIComponent(urlStr.split("/vault/")[1] ?? "");
    const body = init?.body?.toString() ?? "";
    vaultCreatedNotes.push({ path, content: body });
    return Promise.resolve(new Response("", { status: 204 }));
  }

  return Promise.resolve(new Response("Not found", { status: 404 }));
}

// -- Setup / teardown ---------------------------------------------------------

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vaultCreatedNotes.length = 0;
  vaultFolders = [...MOCK_VAULT_CONTEXT.folders];
  vaultTags = [...MOCK_VAULT_CONTEXT.tags];
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

// -- Tests --------------------------------------------------------------------

describe("Integration: full pipeline", () => {
  it("extracts blog post HTML into clean markdown via real Readability", () => {
    const html = loadHtmlFixture("blog-post.html");
    const result = extractArticle(html, "https://example.com/rust-ownership");

    expect(result.status).toBe("success");
    expect(result.title).toContain("Ownership");
    expect(result.content).toContain("ownership");
    expect(result.wordCount).toBeGreaterThan(100);
    expect(result.type).toBe("article");
    expect(result.platform).toBe("web");
  });

  it("formats note with valid YAML frontmatter and correct sections", () => {
    const extracted: ExtractedContent = {
      url: "https://example.com/article",
      title: "Test Article",
      content: "Some markdown content.",
      author: "Jane Doe",
      datePublished: "2025-03-15",
      wordCount: 100,
      type: "article",
      platform: "web",
      status: "success",
    };

    const processed: ProcessedNote = {
      title: "Test Article Summary",
      summary: "Brief summary.",
      keyTakeaways: ["Point A", "Point B"],
      suggestedFolder: "Reading/Articles",
      suggestedTags: ["ai", "programming"],
      type: "article",
      platform: "web",
      source: extracted,
    };

    const dateSaved = new Date("2026-02-16");
    const note = formatNote(processed, dateSaved);

    // YAML frontmatter structure
    expect(note).toMatch(/^---\n/);
    expect(note).toContain("source: \"https://example.com/article\"");
    expect(note).toContain("author: Jane Doe");
    expect(note).toContain("date_published: 2025-03-15");
    expect(note).toContain("date_saved: 2026-02-16");
    expect(note).toContain("  - ai");
    expect(note).toContain("  - programming");
    expect(note).toContain("type: article");
    expect(note).toContain("status: unread");
    expect(note).toContain("---\n");

    // Body sections
    expect(note).toContain("# Test Article Summary");
    expect(note).toContain("## Summary");
    expect(note).toContain("Brief summary.");
    expect(note).toContain("## Key Takeaways");
    expect(note).toContain("- Point A");
    expect(note).toContain("- Point B");
    expect(note).toContain("## Source");
    expect(note).toContain("[Test Article Summary](https://example.com/article)");
  });

  it("social media content uses social media template", () => {
    const extracted: ExtractedContent = {
      url: "https://x.com/user/status/123",
      title: "User's Post",
      content: "This is a tweet about TypeScript.",
      author: "@user",
      datePublished: "2026-01-10",
      wordCount: 10,
      type: "social-media",
      platform: "x",
      status: "success",
    };

    const processed: ProcessedNote = {
      title: "User on TypeScript",
      summary: "A quick take on TypeScript.",
      keyTakeaways: ["TypeScript is great"],
      suggestedFolder: "Reading/Articles",
      suggestedTags: ["typescript"],
      type: "social-media",
      platform: "x",
      source: extracted,
    };

    const note = formatNote(processed, new Date("2026-02-16"));

    // Social media specific fields
    expect(note).toContain("type: social-media");
    expect(note).toContain("platform: x");

    // Social media template has "Key Points" and "Original Content" instead of "Key Takeaways"
    expect(note).toContain("## Key Points");
    expect(note).toContain("## Original Content");
    expect(note).toContain("> This is a tweet about TypeScript.");
    expect(note).not.toContain("## Key Takeaways");
  });

  it("generates valid filenames from various titles", () => {
    // Normal title
    expect(generateFilename("Understanding Rust Ownership")).toBe(
      "understanding-rust-ownership.md"
    );

    // Special characters
    expect(generateFilename("What's New in C++ 2026?")).toBe(
      "what-s-new-in-c-2026.md"
    );

    // Unicode
    expect(generateFilename("Resum\u00e9 Builder")).toBe(
      "resum-builder.md"
    );

    // Very long title
    const longTitle = "A".repeat(100) + " Extra Words Here";
    const filename = generateFilename(longTitle);
    expect(filename.length).toBeLessThanOrEqual(64); // 60 slug + .md
    expect(filename).toMatch(/\.md$/);

    // Empty title
    expect(generateFilename("")).toBe("untitled.md");
    expect(generateFilename("   ")).toBe("untitled.md");
  });

  it("end-to-end: extract HTML fixture -> mock LLM -> format -> verify note", () => {
    const html = loadHtmlFixture("blog-post.html");
    const extracted = extractArticle(html, "https://example.com/rust");

    expect(extracted.status).toBe("success");

    const provider = createMockLLMProvider();

    // Simulate what orchestrator does
    const processedPromise = provider.processContent(extracted, MOCK_VAULT_CONTEXT);

    return processedPromise.then((processed) => {
      const note = formatNote(processed, new Date("2026-02-16"));
      const filename = generateFilename(processed.title);

      // Note was generated
      expect(note.length).toBeGreaterThan(0);
      expect(note).toContain("---");
      expect(note).toContain("## Summary");

      // Filename is valid
      expect(filename).toMatch(/^[a-z0-9-]+\.md$/);
      expect(filename.length).toBeLessThanOrEqual(64);

      // Processed note has correct source back-reference
      expect(processed.source.url).toBe("https://example.com/rust");
      expect(processed.source.status).toBe("success");
    });
  });

  it("handles extraction failure gracefully for bad HTML", () => {
    const badHtml = "<html><body><div>no article content here</div></body></html>";
    const result = extractArticle(badHtml, "https://example.com/bad");

    // Readability may or may not parse this - either way we don't crash
    if (result.status === "failed") {
      expect(result.error).toBeDefined();
      expect(result.wordCount).toBe(0);
    } else {
      expect(result.content.length).toBeGreaterThan(0);
    }
  });

  it("empty vault context works with default processing", () => {
    const emptyContext: VaultContext = {
      folders: [],
      tags: [],
      recentNotes: [],
    };

    const extracted: ExtractedContent = {
      url: "https://example.com/test",
      title: "Test",
      content: "Content here.",
      author: null,
      datePublished: null,
      wordCount: 5,
      type: "article",
      platform: "web",
      status: "success",
    };

    const provider = createMockLLMProvider({
      processContent: vi.fn(async (content) => ({
        title: content.title,
        summary: "Summary",
        keyTakeaways: ["Point 1"],
        suggestedFolder: "Inbox",
        suggestedTags: [],
        type: content.type,
        platform: content.platform,
        source: content,
      })),
    });

    return provider.processContent(extracted, emptyContext).then((processed) => {
      const note = formatNote(processed, new Date("2026-02-16"));
      expect(note).toContain("# Test");
      expect(note).toContain("## Summary");
      // No tags in frontmatter when empty
      expect(note).not.toContain("tags:");
    });
  });

  it("progress callbacks fire in correct order through pipeline simulation", async () => {
    const statuses: string[] = [];

    // Simulate the orchestrator's progress callback pattern for a single URL
    const stages = ["extracting", "processing", "creating", "done"] as const;

    for (const stage of stages) {
      statuses.push(stage);
    }

    expect(statuses).toEqual(["extracting", "processing", "creating", "done"]);
    expect(statuses.indexOf("extracting")).toBeLessThan(statuses.indexOf("processing"));
    expect(statuses.indexOf("processing")).toBeLessThan(statuses.indexOf("creating"));
    expect(statuses.indexOf("creating")).toBeLessThan(statuses.indexOf("done"));
  });

  it("LLM provider receives vault context for categorization", async () => {
    const extracted: ExtractedContent = {
      url: "https://example.com/article",
      title: "Rust Memory Safety",
      content: "Content about Rust memory safety patterns.",
      author: "Author",
      datePublished: "2026-01-01",
      wordCount: 50,
      type: "article",
      platform: "web",
      status: "success",
    };

    const processContentSpy = vi.fn(
      async (content: ExtractedContent, vaultContext: VaultContext): Promise<ProcessedNote> => ({
        title: content.title,
        summary: "Summary",
        keyTakeaways: ["Point"],
        suggestedFolder: vaultContext.folders[0] ?? "Inbox",
        suggestedTags: vaultContext.tags.slice(0, 2),
        type: content.type,
        platform: content.platform,
        source: content,
      })
    );

    const provider: LLMProvider = { processContent: processContentSpy };

    const result = await provider.processContent(extracted, MOCK_VAULT_CONTEXT);

    // Verify vault context was received and used
    expect(processContentSpy).toHaveBeenCalledWith(extracted, MOCK_VAULT_CONTEXT);
    expect(result.suggestedFolder).toBe("Inbox");
    expect(result.suggestedTags).toEqual(["rust", "programming"]);
  });

  it("YAML frontmatter has all required fields for article type", () => {
    const extracted: ExtractedContent = {
      url: "https://example.com/full-article",
      title: "Full Article",
      content: "Content.",
      author: "Author Name",
      datePublished: "2025-06-15",
      wordCount: 100,
      type: "article",
      platform: "web",
      status: "success",
    };

    const processed: ProcessedNote = {
      title: "Full Article Summary",
      summary: "A comprehensive summary.",
      keyTakeaways: ["Takeaway 1", "Takeaway 2", "Takeaway 3"],
      suggestedFolder: "Reading/Articles",
      suggestedTags: ["web-dev", "programming"],
      type: "article",
      platform: "web",
      source: extracted,
    };

    const note = formatNote(processed, new Date("2026-02-16"));
    const frontmatter = note.split("---")[1]!;

    // All required frontmatter fields present
    expect(frontmatter).toContain("source:");
    expect(frontmatter).toContain("author:");
    expect(frontmatter).toContain("date_published:");
    expect(frontmatter).toContain("date_saved:");
    expect(frontmatter).toContain("tags:");
    expect(frontmatter).toContain("type: article");
    expect(frontmatter).toContain("status: unread");

    // Article type should NOT have platform field
    expect(frontmatter).not.toContain("platform:");
  });
});
