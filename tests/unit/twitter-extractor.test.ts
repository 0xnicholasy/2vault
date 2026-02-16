/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Must set up chrome global before content script module loads (registers listener at import time)
const mockAddListener = vi.hoisted(() => vi.fn());
vi.hoisted(() => {
  (globalThis as Record<string, unknown>)["chrome"] = {
    runtime: {
      onMessage: {
        addListener: mockAddListener,
      },
    },
  };
});

import {
  extractFromDom,
  extractTweetText,
  extractAuthor,
  extractTimestamp,
  extractImageDescriptions,
  extractQuoteTweet,
  isThreadPage,
  extractThread,
  extractSingleTweet,
  fallbackExtraction,
  SELECTORS,
  SELECTOR_VERSION,
} from "@/content-scripts/twitter-extractor";

function loadFixture(name: string): string {
  return readFileSync(
    resolve(__dirname, "../fixtures/html", name),
    "utf-8"
  );
}

function setDocumentBody(html: string): void {
  document.body.innerHTML = html;
}

function setDocumentFromFixture(name: string): void {
  const html = loadFixture(name);
  // Parse the fixture and set just the body content
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  document.body.innerHTML = doc.body.innerHTML;
}

beforeEach(() => {
  document.body.innerHTML = "";
  // Set location for extractFromDom
  Object.defineProperty(window, "location", {
    value: { href: "https://x.com/techwriter/status/123456" },
    writable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// -- Selector version ---------------------------------------------------------

describe("twitter-extractor - selector version", () => {
  it("exports a versioned selector constant", () => {
    expect(SELECTOR_VERSION).toBe(1);
    expect(SELECTORS.tweet).toBe('article[data-testid="tweet"]');
  });
});

// -- Single tweet extraction --------------------------------------------------

describe("twitter-extractor - single tweet", () => {
  beforeEach(() => {
    setDocumentFromFixture("twitter-single.html");
  });

  it("extracts tweet text", () => {
    const article = document.querySelector(SELECTORS.tweet)!;
    const text = extractTweetText(article);
    expect(text).toContain("TypeScript 5.0 features");
  });

  it("extracts author name and handle", () => {
    const article = document.querySelector(SELECTORS.tweet)!;
    const { name, handle } = extractAuthor(article);
    expect(name).toBe("Tech Writer");
    expect(handle).toBe("@techwriter");
  });

  it("skips 'Verified' text in author extraction", () => {
    const article = document.querySelector(SELECTORS.tweet)!;
    const { name } = extractAuthor(article);
    expect(name).not.toContain("Verified");
  });

  it("extracts timestamp", () => {
    const article = document.querySelector(SELECTORS.tweet)!;
    const timestamp = extractTimestamp(article);
    expect(timestamp).toBe("2026-02-15T10:30:00.000Z");
  });

  it("extracts meaningful image descriptions", () => {
    const article = document.querySelector(SELECTORS.tweet)!;
    const images = extractImageDescriptions(article);
    expect(images).toEqual(["Screenshot of TypeScript code with decorators"]);
    // Filters out "Profile" and "Image" alts
  });

  it("detects single page (not a thread)", () => {
    expect(isThreadPage()).toBe(false);
  });

  it("extracts single tweet content", () => {
    const content = extractSingleTweet();
    expect(content).toContain("TypeScript 5.0 features");
    expect(content).toContain("[Images: Screenshot of TypeScript code with decorators]");
  });

  it("extracts full result from DOM", () => {
    const result = extractFromDom();
    expect(result.status).toBe("success");
    expect(result.type).toBe("social-media");
    expect(result.platform).toBe("x");
    expect(result.title).toBe("Post by Tech Writer");
    expect(result.author).toBe("Tech Writer (@techwriter)");
    expect(result.datePublished).toBe("2026-02-15T10:30:00.000Z");
    expect(result.content).toContain("TypeScript 5.0");
    expect(result.wordCount).toBeGreaterThan(0);
  });
});

// -- Thread extraction --------------------------------------------------------

describe("twitter-extractor - thread", () => {
  beforeEach(() => {
    setDocumentFromFixture("twitter-thread.html");
  });

  it("detects thread page", () => {
    expect(isThreadPage()).toBe(true);
  });

  it("extracts thread with numbered parts", () => {
    const thread = extractThread();
    expect(thread.tweetCount).toBe(3);
    expect(thread.content).toContain("**[1/3]**");
    expect(thread.content).toContain("**[2/3]**");
    expect(thread.content).toContain("**[3/3]**");
    expect(thread.content).toContain("Manifest V3");
    expect(thread.content).toContain("Service workers are ephemeral");
    expect(thread.content).toContain("isolated worlds");
  });

  it("includes image descriptions in thread tweets", () => {
    const thread = extractThread();
    expect(thread.content).toContain("[Images: Diagram showing isolated worlds]");
  });

  it("extracts thread as full result", () => {
    const result = extractFromDom();
    expect(result.status).toBe("success");
    expect(result.title).toContain("Thread by");
    expect(result.title).toContain("3 tweets");
    expect(result.content).toContain("---"); // thread separator
  });
});

// -- Quote tweet extraction ---------------------------------------------------

describe("twitter-extractor - quote tweet", () => {
  it("returns null when no quote tweet exists", () => {
    setDocumentBody(`
      <article data-testid="tweet">
        <div data-testid="tweetText">Simple tweet</div>
      </article>
    `);
    const article = document.querySelector(SELECTORS.tweet)!;
    expect(extractQuoteTweet(article)).toBeNull();
  });

  it("extracts nested quote tweet", () => {
    setDocumentBody(`
      <article data-testid="tweet">
        <div data-testid="tweetText">Check this out</div>
        <article data-testid="tweet">
          <div data-testid="User-Name">
            <span>Quoted Author</span>
            <span>@quoted</span>
          </div>
          <div data-testid="tweetText">Original content here</div>
        </article>
      </article>
    `);
    const article = document.querySelector(SELECTORS.tweet)!;
    const quote = extractQuoteTweet(article);
    expect(quote).toContain("Quoted Author (@quoted)");
    expect(quote).toContain("Original content here");
    expect(quote).toMatch(/^>/); // blockquote format
  });
});

// -- Fallback extraction ------------------------------------------------------

describe("twitter-extractor - fallback", () => {
  it("falls back to body text when no tweet found", () => {
    setDocumentBody("<p>Some fallback text content here</p>");
    // jsdom doesn't compute innerText from HTML, so mock it
    Object.defineProperty(document.body, "innerText", {
      value: "Some fallback text content here",
      writable: true,
      configurable: true,
    });
    const result = extractFromDom();
    expect(result.status).toBe("success");
    expect(result.title).toBe("X Post");
    expect(result.content).toContain("Some fallback text");
  });

  it("returns failed when body is empty", () => {
    document.body.innerHTML = "";
    // Override innerText since jsdom doesn't compute it
    Object.defineProperty(document.body, "innerText", { value: "", writable: true });
    const result = fallbackExtraction("https://x.com/test/123", "Test reason");
    expect(result.status).toBe("failed");
    expect(result.error).toContain("Test reason");
  });

  it("truncates body text to MAX_BODY_TEXT", () => {
    const longText = "a ".repeat(5000);
    Object.defineProperty(document.body, "innerText", { value: longText, writable: true });
    const result = fallbackExtraction("https://x.com/test/123", "reason");
    expect(result.content.length).toBeLessThanOrEqual(8001);
  });
});

// -- Edge cases ---------------------------------------------------------------

describe("twitter-extractor - edge cases", () => {
  it("handles missing User-Name element", () => {
    setDocumentBody(`
      <article data-testid="tweet">
        <div data-testid="tweetText">Tweet without author info</div>
      </article>
    `);
    const article = document.querySelector(SELECTORS.tweet)!;
    const { name, handle } = extractAuthor(article);
    expect(name).toBe("");
    expect(handle).toBe("");
  });

  it("handles missing time element", () => {
    setDocumentBody(`
      <article data-testid="tweet">
        <div data-testid="tweetText">Tweet without timestamp</div>
      </article>
    `);
    const article = document.querySelector(SELECTORS.tweet)!;
    expect(extractTimestamp(article)).toBeNull();
  });

  it("registers chrome message listener", () => {
    expect(mockAddListener).toHaveBeenCalled();
  });
});
