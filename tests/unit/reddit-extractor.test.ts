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
  extractNewRedditPost,
  extractNewRedditComments,
  formatComments,
  fallbackExtraction,
  isOldReddit,
  SELECTORS_NEW,
  SELECTORS_OLD,
  SELECTOR_VERSION,
  MAX_COMMENTS,
} from "@/content-scripts/reddit-extractor";

function loadFixture(name: string): string {
  return readFileSync(
    resolve(__dirname, "../fixtures/html", name),
    "utf-8"
  );
}

function setDocumentFromFixture(name: string): void {
  const html = loadFixture(name);
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  document.body.innerHTML = doc.body.innerHTML;
}

function setDocumentBody(html: string): void {
  document.body.innerHTML = html;
}

beforeEach(() => {
  document.body.innerHTML = "";
  Object.defineProperty(window, "location", {
    value: { href: "https://www.reddit.com/r/webdev/comments/abc123/test_post/", hostname: "www.reddit.com" },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// -- Selector version ---------------------------------------------------------

describe("reddit-extractor - selector version", () => {
  it("exports a versioned selector constant", () => {
    expect(SELECTOR_VERSION).toBe(1);
    expect(SELECTORS_NEW.post).toBe("shreddit-post");
  });

  it("exports MAX_COMMENTS constant", () => {
    expect(MAX_COMMENTS).toBe(5);
  });
});

// -- Old Reddit detection -----------------------------------------------------

describe("reddit-extractor - isOldReddit", () => {
  it("returns false for www.reddit.com", () => {
    expect(isOldReddit()).toBe(false);
  });

  it("returns true for old.reddit.com", () => {
    Object.defineProperty(window, "location", {
      value: { href: "https://old.reddit.com/r/webdev/test", hostname: "old.reddit.com" },
      writable: true,
      configurable: true,
    });
    expect(isOldReddit()).toBe(true);
  });
});

// -- New Reddit extraction (fixture) ------------------------------------------

describe("reddit-extractor - new Reddit fixture", () => {
  beforeEach(() => {
    setDocumentFromFixture("reddit-post.html");
  });

  it("extracts post title and body", () => {
    const post = extractNewRedditPost();
    expect(post.title).toBe("How I built a Chrome extension with AI");
    expect(post.body).toContain("Manifest V3");
    expect(post.body).toContain("service worker lifecycle");
  });

  it("extracts post metadata", () => {
    const post = extractNewRedditPost();
    expect(post.author).toBe("techbuilder42");
    expect(post.subreddit).toBe("r/webdev");
    expect(post.score).toBe("247");
    expect(post.flair).toBe("Show & Tell");
  });

  it("extracts post timestamp", () => {
    const post = extractNewRedditPost();
    expect(post.timestamp).toBe("2026-02-10T15:30:00.000Z");
  });

  it("extracts top-level comments only (depth 0)", () => {
    const comments = extractNewRedditComments();
    // Fixture has 6 depth-0 comments but MAX_COMMENTS is 5
    expect(comments.length).toBe(MAX_COMMENTS);
    expect(comments[0]!.author).toBe("frontenddev99");
    expect(comments[0]!.text).toContain("OpenRouter");
  });

  it("caps comments at MAX_COMMENTS", () => {
    const comments = extractNewRedditComments();
    expect(comments.length).toBeLessThanOrEqual(MAX_COMMENTS);
  });

  it("counts nested replies for top-level comments", () => {
    const comments = extractNewRedditComments();
    // First comment has 1 depth-1 reply
    expect(comments[0]!.replyCount).toBe(1);
    // Second comment has 0 replies
    expect(comments[1]!.replyCount).toBe(0);
    // Third comment has 2 depth-1 replies
    expect(comments[2]!.replyCount).toBe(2);
  });

  it("extracts full result from DOM", () => {
    const result = extractFromDom();
    expect(result.status).toBe("success");
    expect(result.type).toBe("social-media");
    expect(result.platform).toBe("reddit");
    expect(result.title).toContain("How I built a Chrome extension with AI");
    expect(result.title).toContain("r/webdev");
    expect(result.author).toBe("u/techbuilder42");
    expect(result.content).toContain("## Post");
    expect(result.content).toContain("## Top Comments");
    expect(result.wordCount).toBeGreaterThan(0);
  });

  it("includes comment attribution in formatted output", () => {
    const result = extractFromDom();
    expect(result.content).toContain("u/frontenddev99");
    expect(result.content).toContain("89 points");
  });

  it("includes reply count in formatted comments", () => {
    const result = extractFromDom();
    expect(result.content).toContain("1 reply");
    expect(result.content).toContain("2 replies");
  });
});

// -- formatComments -----------------------------------------------------------

describe("reddit-extractor - formatComments", () => {
  it("formats comments with author and score", () => {
    // Set up minimal DOM so getTotalCommentCount works
    setDocumentBody(`<shreddit-comment depth="0"></shreddit-comment>`);

    const comments = [
      { author: "testuser", text: "Great post!", score: "42", replyCount: 0 },
    ];
    const formatted = formatComments(comments);
    expect(formatted).toContain("u/testuser");
    expect(formatted).toContain("42 points");
    expect(formatted).toContain("Great post!");
  });

  it("shows (showing N of M) when comments are capped", () => {
    // Set up DOM with more comments than MAX_COMMENTS
    const commentEls = Array.from({ length: 10 }, () => `<shreddit-comment depth="0"></shreddit-comment>`).join("");
    setDocumentBody(commentEls);

    const comments = Array.from({ length: 5 }, (_, i) => ({
      author: `user${i}`,
      text: `Comment ${i}`,
      score: `${i * 10}`,
      replyCount: 0,
    }));
    const formatted = formatComments(comments);
    expect(formatted).toContain("showing 5 of 10");
  });
});

// -- Fallback extraction ------------------------------------------------------

describe("reddit-extractor - fallback", () => {
  it("falls back to body text when no post found", () => {
    setDocumentBody("<p>Some fallback text content</p>");
    Object.defineProperty(document.body, "innerText", {
      value: "Some fallback text content",
      writable: true,
      configurable: true,
    });
    const result = extractFromDom();
    expect(result.status).toBe("success");
    expect(result.title).toBe("Reddit Post");
    expect(result.content).toContain("Some fallback text");
  });

  it("returns failed when body is empty", () => {
    document.body.innerHTML = "";
    Object.defineProperty(document.body, "innerText", { value: "", writable: true, configurable: true });
    const result = fallbackExtraction("https://reddit.com/r/test/123", "Test reason");
    expect(result.status).toBe("failed");
    expect(result.platform).toBe("reddit");
    expect(result.error).toContain("Test reason");
  });

  it("truncates body text to MAX_BODY_TEXT", () => {
    const longText = "a ".repeat(5000);
    Object.defineProperty(document.body, "innerText", { value: longText, writable: true, configurable: true });
    const result = fallbackExtraction("https://reddit.com/r/test/123", "reason");
    expect(result.content.length).toBeLessThanOrEqual(8001);
  });
});

// -- Edge cases ---------------------------------------------------------------

describe("reddit-extractor - edge cases", () => {
  it("handles post with no body text (link-only posts)", () => {
    setDocumentBody(`
      <shreddit-post
        post-title="Check out this cool project"
        author="linkposter"
        subreddit-prefixed-name="r/programming"
        score="100"
      >
        <div slot="title">Check out this cool project</div>
      </shreddit-post>
    `);
    const result = extractFromDom();
    expect(result.status).toBe("success");
    expect(result.title).toContain("Check out this cool project");
  });

  it("handles post with no comments", () => {
    setDocumentBody(`
      <shreddit-post
        post-title="New post with no comments"
        author="newposter"
        subreddit-prefixed-name="r/test"
        score="1"
      >
        <div slot="text-body">This is a new post.</div>
      </shreddit-post>
    `);
    const result = extractFromDom();
    expect(result.status).toBe("success");
    expect(result.content).toContain("## Post");
    expect(result.content).not.toContain("## Top Comments");
  });

  it("registers chrome message listener", () => {
    expect(mockAddListener).toHaveBeenCalled();
  });
});
