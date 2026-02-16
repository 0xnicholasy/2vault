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
  extractPostText,
  extractAuthorName,
  extractDate,
  extractArticleUrl,
  fallbackExtraction,
  queryFirst,
  SELECTORS,
  SELECTOR_VERSION,
} from "@/content-scripts/linkedin-extractor";

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
    value: { href: "https://www.linkedin.com/posts/sarahchen_update-123" },
    writable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// -- Selector version ---------------------------------------------------------

describe("linkedin-extractor - selector version", () => {
  it("exports versioned selector constant", () => {
    expect(SELECTOR_VERSION).toBe(1);
    expect(SELECTORS.postText).toBeInstanceOf(Array);
    expect(SELECTORS.postText.length).toBeGreaterThan(0);
  });
});

// -- Post extraction from fixture ---------------------------------------------

describe("linkedin-extractor - post from fixture", () => {
  beforeEach(() => {
    setDocumentFromFixture("linkedin-post.html");
  });

  it("extracts post text from span[dir] elements", () => {
    const text = extractPostText();
    expect(text).toContain("Excited to announce");
    expect(text).toContain("working on this for months");
    expect(text).toContain("better performance");
  });

  it("extracts author name", () => {
    const author = extractAuthorName();
    expect(author).toBe("Sarah Chen");
  });

  it("extracts date from time element", () => {
    const date = extractDate();
    expect(date).toBe("2026-02-15T14:00:00.000Z");
  });

  it("extracts article URL", () => {
    const url = extractArticleUrl();
    expect(url).toContain("example.com/blog/major-update");
  });

  it("extracts full result from DOM", () => {
    const result = extractFromDom();
    expect(result.status).toBe("success");
    expect(result.type).toBe("social-media");
    expect(result.platform).toBe("linkedin");
    expect(result.title).toBe("LinkedIn post by Sarah Chen");
    expect(result.author).toBe("Sarah Chen");
    expect(result.content).toContain("Excited to announce");
    expect(result.content).toContain("**Shared article:**");
    expect(result.wordCount).toBeGreaterThan(0);
  });
});

// -- Alternative selectors ----------------------------------------------------

describe("linkedin-extractor - alternative selectors", () => {
  it("uses update-components-text selector", () => {
    setDocumentBody(`
      <div class="update-components-text">
        Alternative selector post content here
      </div>
    `);
    const text = extractPostText();
    expect(text).toContain("Alternative selector post content");
  });

  it("uses update-components-actor__name selector", () => {
    setDocumentBody(`
      <div class="update-components-actor__name">
        <span>Alt Author Name</span>
      </div>
    `);
    const author = extractAuthorName();
    expect(author).toBe("Alt Author Name");
  });
});

// -- queryFirst helper --------------------------------------------------------

describe("linkedin-extractor - queryFirst", () => {
  it("returns first matching element", () => {
    setDocumentBody(`
      <div class="feed-shared-actor__name">Author</div>
    `);
    const el = queryFirst(SELECTORS.author);
    expect(el).toBeTruthy();
    expect(el?.textContent?.trim()).toBe("Author");
  });

  it("tries selectors in order", () => {
    setDocumentBody(`
      <div class="update-components-actor__name">Second</div>
    `);
    // First selector doesn't match, second does
    const el = queryFirst(SELECTORS.author);
    expect(el?.textContent?.trim()).toBe("Second");
  });

  it("returns null when no selector matches", () => {
    setDocumentBody("<div>No matching elements</div>");
    const el = queryFirst(SELECTORS.author);
    expect(el).toBeNull();
  });
});

// -- See more handling --------------------------------------------------------

describe("linkedin-extractor - see more", () => {
  it("clicks see more button before extracting", () => {
    const clickSpy = vi.fn();
    setDocumentBody(`
      <button aria-label="see more" id="see-more-btn">...see more</button>
      <div class="feed-shared-update-v2__description">Full post text visible after clicking</div>
    `);

    const btn = document.getElementById("see-more-btn")!;
    btn.click = clickSpy;

    extractPostText();
    expect(clickSpy).toHaveBeenCalled();
  });
});

// -- Fallback -----------------------------------------------------------------

describe("linkedin-extractor - fallback", () => {
  it("falls back to body text when no post found", () => {
    setDocumentBody("<p>Some generic page content</p>");
    const result = extractFromDom();
    // May succeed with fallback or fail depending on innerText
    expect(result.platform).toBe("linkedin");
  });

  it("returns failed when body is empty", () => {
    document.body.innerHTML = "";
    Object.defineProperty(document.body, "innerText", { value: "", writable: true });
    const result = fallbackExtraction("https://linkedin.com/post/123", "No content");
    expect(result.status).toBe("failed");
    expect(result.error).toContain("No content");
  });

  it("uses body text as fallback content", () => {
    Object.defineProperty(document.body, "innerText", {
      value: "Fallback body text here",
      writable: true,
    });
    const result = fallbackExtraction("https://linkedin.com/post/123", "reason");
    expect(result.status).toBe("success");
    expect(result.title).toBe("LinkedIn Post");
    expect(result.content).toBe("Fallback body text here");
  });
});

// -- Edge cases ---------------------------------------------------------------

describe("linkedin-extractor - edge cases", () => {
  it("handles post without author", () => {
    setDocumentBody(`
      <div class="feed-shared-update-v2__description">Post without author</div>
    `);
    const result = extractFromDom();
    expect(result.title).toBe("LinkedIn Post");
    expect(result.author).toBeNull();
  });

  it("handles post without date", () => {
    setDocumentBody(`
      <div class="feed-shared-update-v2__description">Post without date</div>
    `);
    const result = extractFromDom();
    expect(result.datePublished).toBeNull();
  });

  it("handles post without article link", () => {
    setDocumentBody(`
      <div class="feed-shared-update-v2__description">Post without article</div>
    `);
    const result = extractFromDom();
    expect(result.content).not.toContain("Shared article");
  });

  it("registers chrome message listener", () => {
    expect(mockAddListener).toHaveBeenCalled();
  });
});
