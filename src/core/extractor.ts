import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";
import { parseHTML } from "linkedom";
import type { ExtractedContent } from "@/core/types";

const MAX_CONTENT_CHARS = 32_000;
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024; // 10MB
const FETCH_TIMEOUT_MS = 10_000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; 2Vault/0.1; +https://github.com/2vault)";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  fence: "```",
  bulletListMarker: "-",
});

turndown.remove(["script", "style", "nav", "footer"]);

export function createFailedExtraction(
  url: string,
  error: string
): ExtractedContent {
  return {
    url,
    title: "",
    content: "",
    author: null,
    datePublished: null,
    wordCount: 0,
    type: "article",
    platform: "web",
    status: "failed",
    error,
  };
}

function truncateAtBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;

  const truncated = text.slice(0, maxLength);

  // Try to cut at a paragraph boundary
  const lastParagraph = truncated.lastIndexOf("\n\n");
  if (lastParagraph > maxLength * 0.8) {
    return truncated.slice(0, lastParagraph);
  }

  // Fall back to sentence boundary
  const lastSentence = truncated.lastIndexOf(". ");
  if (lastSentence > maxLength * 0.8) {
    return truncated.slice(0, lastSentence + 1);
  }

  // Last resort: cut at last newline
  const lastNewline = truncated.lastIndexOf("\n");
  if (lastNewline > maxLength * 0.8) {
    return truncated.slice(0, lastNewline);
  }

  return truncated;
}

export function extractArticle(html: string, url: string): ExtractedContent {
  try {
    const { document } = parseHTML(html);

    // Inject base href for relative URL resolution
    const base = document.createElement("base");
    base.setAttribute("href", url);
    document.head.appendChild(base);

    const reader = new Readability(document);
    const article = reader.parse();

    if (!article || !article.content) {
      return createFailedExtraction(url, "Readability could not parse content");
    }

    // Turndown.turndown(string) uses global `document` to parse HTML,
    // which doesn't exist in Chrome service workers. Parse with linkedom
    // first and pass the DOM node instead.
    const { document: contentDoc } = parseHTML(article.content);
    const markdown = turndown.turndown(contentDoc.documentElement);

    if (!markdown.trim()) {
      return createFailedExtraction(url, "Extracted content is empty");
    }

    const finalContent = truncateAtBoundary(markdown, MAX_CONTENT_CHARS);
    const wordCount = finalContent.split(/\s+/).filter(Boolean).length;

    return {
      url,
      title: article.title || "",
      content: finalContent,
      author: article.byline || null,
      datePublished: article.publishedTime || null,
      wordCount,
      type: "article",
      platform: "web",
      status: "success",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return createFailedExtraction(url, `Extraction failed: ${message}`);
  }
}

export async function fetchAndExtract(
  url: string
): Promise<ExtractedContent> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": USER_AGENT },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return createFailedExtraction(
        url,
        `HTTP ${response.status} ${response.statusText}`
      );
    }

    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_BYTES) {
      return createFailedExtraction(
        url,
        `Response too large: ${contentLength} bytes (max ${MAX_RESPONSE_BYTES})`
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return createFailedExtraction(
        url,
        `Non-HTML content-type: ${contentType}`
      );
    }

    const html = await response.text();
    if (!html.trim()) {
      return createFailedExtraction(url, "Empty response body");
    }

    return extractArticle(html, url);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return createFailedExtraction(url, "Request timed out");
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return createFailedExtraction(url, `Fetch failed: ${message}`);
  }
}
