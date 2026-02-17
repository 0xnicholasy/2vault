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
  extractThreadWithReplies,
  extractSingleTweet,
  fallbackExtraction,
  SELECTORS,
  SELECTOR_VERSION,
  MAX_REPLIES,
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

// -- Thread extraction (same-author thread) -----------------------------------

describe("twitter-extractor - thread (same author)", () => {
  beforeEach(() => {
    setDocumentFromFixture("twitter-thread.html");
  });

  it("detects thread page", () => {
    expect(isThreadPage()).toBe(true);
  });

  it("extracts thread with numbered author tweets", () => {
    const thread = extractThreadWithReplies();
    expect(thread.authorTweetCount).toBe(3);
    expect(thread.content).toContain("**[1/3]**");
    expect(thread.content).toContain("**[2/3]**");
    expect(thread.content).toContain("**[3/3]**");
    expect(thread.content).toContain("Manifest V3");
    expect(thread.content).toContain("Service workers are ephemeral");
    expect(thread.content).toContain("isolated worlds");
  });

  it("has ## Thread section header", () => {
    const thread = extractThreadWithReplies();
    expect(thread.content).toContain("## Thread");
  });

  it("has no ## Top Replies when all tweets are same author", () => {
    const thread = extractThreadWithReplies();
    expect(thread.replyCount).toBe(0);
    expect(thread.content).not.toContain("## Top Replies");
  });

  it("includes image descriptions in thread tweets", () => {
    const thread = extractThreadWithReplies();
    expect(thread.content).toContain("[Images: Diagram showing isolated worlds]");
  });

  it("extracts thread as full result with correct title", () => {
    const result = extractFromDom();
    expect(result.status).toBe("success");
    expect(result.title).toContain("Thread by");
    expect(result.title).toContain("3 tweets");
    expect(result.title).not.toContain("replies"); // no replies in same-author thread
    expect(result.content).toContain("---"); // thread separator
  });
});

// -- Thread extraction (mixed authors) ----------------------------------------

describe("twitter-extractor - thread with replies", () => {
  beforeEach(() => {
    setDocumentFromFixture("twitter-thread-with-replies.html");
  });

  it("separates author tweets from replies", () => {
    const thread = extractThreadWithReplies();
    expect(thread.authorTweetCount).toBe(4); // @devexpert has 4 tweets
    expect(thread.totalReplies).toBe(3); // 3 replies from other users
    expect(thread.replyCount).toBe(3);
  });

  it("numbers only author tweets in ## Thread section", () => {
    const thread = extractThreadWithReplies();
    expect(thread.content).toContain("## Thread");
    expect(thread.content).toContain("**[1/4]**");
    expect(thread.content).toContain("**[2/4]**");
    expect(thread.content).toContain("**[3/4]**");
    expect(thread.content).toContain("**[4/4]**");
  });

  it("includes replies in ## Top Replies section", () => {
    const thread = extractThreadWithReplies();
    expect(thread.content).toContain("## Top Replies");
    expect(thread.content).toContain("Web Dev Fan (@webdevfan)");
    expect(thread.content).toContain("Browser Hacker (@browserhacker)");
    expect(thread.content).toContain("Extension Dev (@extensiondev)");
  });

  it("attributes replies with handle", () => {
    const thread = extractThreadWithReplies();
    expect(thread.content).toContain("**Web Dev Fan (@webdevfan):** Great tip!");
  });

  it("generates title with reply count", () => {
    const result = extractFromDom();
    expect(result.title).toContain("4 tweets");
    expect(result.title).toContain("3 replies");
  });

  it("includes image descriptions in author tweets", () => {
    const thread = extractThreadWithReplies();
    expect(thread.content).toContain("[Images: Screenshot of side panel API docs]");
  });

  it("exports MAX_REPLIES constant", () => {
    expect(MAX_REPLIES).toBe(5);
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
