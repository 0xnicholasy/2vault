import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  createFailedExtraction,
  extractArticle,
  fetchAndExtract,
} from "@/core/extractor";

const fixturesDir = resolve(__dirname, "../fixtures");

function readFixture(path: string): string {
  return readFileSync(resolve(fixturesDir, path), "utf-8");
}

const BLOG_HTML = readFixture("html/blog-post.html");
const GITHUB_HTML = readFixture("html/github-readme.html");
const NEWS_HTML = readFixture("html/news-article.html");
const MINIMAL_HTML = readFixture("html/minimal-content.html");
const NO_ARTICLE_HTML = readFixture("html/no-article.html");
const EXPECTED_BLOG_MD = readFixture("expected/blog-post.md");

const TEST_URL = "https://example.com/article";

// -- createFailedExtraction --------------------------------------------------

describe("createFailedExtraction", () => {
  it("returns correct shape with failed status", () => {
    const result = createFailedExtraction(TEST_URL, "something broke");

    expect(result).toEqual({
      url: TEST_URL,
      title: "",
      content: "",
      author: null,
      datePublished: null,
      wordCount: 0,
      type: "article",
      platform: "web",
      status: "failed",
      error: "something broke",
    });
  });
});

// -- extractArticle ----------------------------------------------------------

describe("extractArticle", () => {
  describe("blog post fixture", () => {
    const result = extractArticle(
      BLOG_HTML,
      "https://techblog.example.com/rust-ownership"
    );

    it("extracts successfully", () => {
      expect(result.status).toBe("success");
      expect(result.error).toBeUndefined();
    });

    it("extracts the title", () => {
      expect(result.title).toBe("Understanding Rust's Ownership Model");
    });

    it("extracts the author from byline", () => {
      expect(result.author).toBe("Jane Smith");
    });

    it("extracts the published date", () => {
      expect(result.datePublished).toBe("2025-03-15T10:00:00Z");
    });

    it("produces ATX-style headings", () => {
      expect(result.content).toContain("## What is Ownership?");
      expect(result.content).toContain("## The Three Rules");
      expect(result.content).toContain("## Conclusion");
    });

    it("produces fenced code blocks", () => {
      expect(result.content).toContain("```");
      expect(result.content).toContain("fn main()");
    });

    it("has a reasonable word count", () => {
      expect(result.wordCount).toBeGreaterThan(100);
      expect(result.wordCount).toBeLessThan(1000);
    });

    it("sets type and platform correctly", () => {
      expect(result.type).toBe("article");
      expect(result.platform).toBe("web");
    });

    it("matches expected markdown snapshot", () => {
      expect(result.content).toBe(EXPECTED_BLOG_MD);
    });
  });

  describe("github readme fixture", () => {
    const result = extractArticle(
      GITHUB_HTML,
      "https://github.com/fastify/fastify"
    );

    it("extracts successfully", () => {
      expect(result.status).toBe("success");
    });

    it("extracts the title", () => {
      expect(result.title).toBeTruthy();
    });

    it("contains key content", () => {
      expect(result.content).toContain("npm install fastify");
      expect(result.content).toContain("Features");
    });
  });

  describe("news article fixture", () => {
    const result = extractArticle(
      NEWS_HTML,
      "https://worldtechnews.example.com/ai-chip-shortage"
    );

    it("extracts successfully", () => {
      expect(result.status).toBe("success");
    });

    it("extracts article content without sidebar noise", () => {
      expect(result.content).toContain("semiconductor");
      // Sidebar ads and newsletter signup should be stripped
      expect(result.content).not.toContain("ADVERTISEMENT");
      expect(result.content).not.toContain("Subscribe to our newsletter");
    });
  });

  describe("minimal content fixture", () => {
    const result = extractArticle(MINIMAL_HTML, TEST_URL);

    it("extracts very little useful content", () => {
      // Readability may still parse something from sparse pages,
      // but the result should have negligible content
      if (result.status === "failed") {
        expect(result.error).toBeTruthy();
      } else {
        expect(result.wordCount).toBeLessThan(30);
      }
    });
  });

  describe("no article fixture", () => {
    const result = extractArticle(NO_ARTICLE_HTML, TEST_URL);

    it("extracts very little useful content", () => {
      // Login pages have minimal article content; Readability may
      // still extract form labels and links as "content"
      if (result.status === "failed") {
        expect(result.error).toBeTruthy();
      } else {
        expect(result.wordCount).toBeLessThan(50);
      }
    });
  });

  describe("truncation", () => {
    it("truncates content exceeding 32000 characters at a boundary", () => {
      // Build HTML with massive content that Readability will keep
      const paragraphs = Array.from(
        { length: 500 },
        (_, i) =>
          `<p>This is paragraph number ${i + 1} with enough text to contribute to a very long article. We need to ensure this content is substantial enough to exceed the thirty-two thousand character limit when all paragraphs are combined together into the final markdown output.</p>`
      );
      const longHtml = `<!DOCTYPE html><html><head><title>Long Article</title></head><body><article><h1>Very Long Article</h1>${paragraphs.join("")}</article></body></html>`;

      const result = extractArticle(longHtml, TEST_URL);

      expect(result.status).toBe("success");
      expect(result.content.length).toBeLessThanOrEqual(32_000);
    });
  });

  describe("malformed HTML", () => {
    it("does not throw on broken HTML", () => {
      const broken = "<html><head><title>Test</title><body><article><h1>Title<p>Unclosed tags<div>More";

      expect(() => extractArticle(broken, TEST_URL)).not.toThrow();
    });

    it("does not throw on empty string", () => {
      expect(() => extractArticle("", TEST_URL)).not.toThrow();
    });
  });
});

// -- fetchAndExtract ---------------------------------------------------------

describe("fetchAndExtract", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  function htmlResponse(html: string): Response {
    return new Response(html, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  it("extracts content from valid HTML response", async () => {
    mockFetch.mockResolvedValue(htmlResponse(BLOG_HTML));

    const result = await fetchAndExtract(TEST_URL);

    expect(result.status).toBe("success");
    expect(result.title).toBe("Understanding Rust's Ownership Model");
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("returns failed for 404 response", async () => {
    mockFetch.mockResolvedValue(
      new Response("Not Found", { status: 404, statusText: "Not Found" })
    );

    const result = await fetchAndExtract(TEST_URL);

    expect(result.status).toBe("failed");
    expect(result.error).toContain("404");
  });

  it("returns failed for non-HTML content-type", async () => {
    mockFetch.mockResolvedValue(
      new Response('{"data": 1}', {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    const result = await fetchAndExtract(TEST_URL);

    expect(result.status).toBe("failed");
    expect(result.error).toContain("Non-HTML");
  });

  it("returns failed for empty response body", async () => {
    mockFetch.mockResolvedValue(
      new Response("   ", {
        status: 200,
        headers: { "content-type": "text/html" },
      })
    );

    const result = await fetchAndExtract(TEST_URL);

    expect(result.status).toBe("failed");
    expect(result.error).toContain("Empty response body");
  });

  it("returns failed on network error", async () => {
    mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));

    const result = await fetchAndExtract(TEST_URL);

    expect(result.status).toBe("failed");
    expect(result.error).toContain("Fetch failed");
  });

  it("returns failed on timeout (AbortError)", async () => {
    const abortError = new DOMException("The operation was aborted", "AbortError");
    mockFetch.mockRejectedValue(abortError);

    const result = await fetchAndExtract(TEST_URL);

    expect(result.status).toBe("failed");
    expect(result.error).toContain("timed out");
  });

  it("passes signal and User-Agent header to fetch", async () => {
    mockFetch.mockResolvedValue(htmlResponse(BLOG_HTML));

    await fetchAndExtract(TEST_URL);

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect((options.headers as Record<string, string>)["User-Agent"]).toContain(
      "Chrome"
    );
  });
});
