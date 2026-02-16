import type { ExtractedContent } from "@/core/types";
import type { ExtractContentMessage, ExtractionResultMessage } from "@/background/messages";

/** Selector version - bump when LinkedIn changes their DOM structure */
const SELECTOR_VERSION = 1;

const SELECTORS = {
  // Post content selectors (LinkedIn has multiple class name patterns)
  postText: [
    ".feed-shared-update-v2__description",
    ".update-components-text",
    ".feed-shared-text",
    '[data-ad-preview="message"]',
  ],
  // Author selectors
  author: [
    ".feed-shared-actor__name",
    ".update-components-actor__name",
    ".feed-shared-actor__title",
  ],
  // Date selectors
  date: [
    "time",
    ".feed-shared-actor__sub-description",
    ".update-components-actor__sub-description",
  ],
  // Article link (shared articles within posts)
  articleLink: [
    ".feed-shared-article a",
    ".update-components-article a",
    'a[data-tracking-control-name="article"]',
  ],
  // "See more" button that hides full text
  seeMore: [
    ".feed-shared-inline-show-more-text button",
    'button[aria-label="see more"]',
    ".see-more",
  ],
} as const;

const MAX_BODY_TEXT = 8_000;

function queryFirst(selectors: readonly string[]): Element | null {
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el) return el;
  }
  return null;
}

function extractPostText(): string {
  // Try to expand "See more" first - the full text is in the DOM but hidden
  for (const selector of SELECTORS.seeMore) {
    const btn = document.querySelector(selector);
    if (btn instanceof HTMLElement) {
      btn.click();
      break;
    }
  }

  const postEl = queryFirst(SELECTORS.postText);
  if (!postEl) return "";

  // Get full text content, preserving line breaks
  const spans = postEl.querySelectorAll("span[dir]");
  if (spans.length > 0) {
    return Array.from(spans)
      .map((s) => s.textContent?.trim() ?? "")
      .filter(Boolean)
      .join("\n");
  }

  return postEl.textContent?.trim() ?? "";
}

function extractAuthorName(): string | null {
  const el = queryFirst(SELECTORS.author);
  if (!el) return null;

  // LinkedIn wraps the name in nested spans; get just the visible text
  const text = el.textContent?.trim() ?? "";
  // Remove "View profile" and similar accessibility text
  return text.split("\n")[0]?.trim() || null;
}

function extractDate(): string | null {
  // Prefer <time> element with datetime attribute
  const timeEl = document.querySelector("time[datetime]");
  if (timeEl) {
    return timeEl.getAttribute("datetime");
  }

  // Fallback to sub-description text (e.g. "2d", "1w")
  const el = queryFirst(SELECTORS.date);
  return el?.textContent?.trim() ?? null;
}

function extractArticleUrl(): string | null {
  const el = queryFirst(SELECTORS.articleLink);
  if (el instanceof HTMLAnchorElement) {
    return el.href || null;
  }
  return null;
}

function extractFromDom(): ExtractedContent {
  const url = window.location.href;

  try {
    const postText = extractPostText();
    const author = extractAuthorName();
    const date = extractDate();
    const articleUrl = extractArticleUrl();

    if (!postText) {
      return fallbackExtraction(url, "Could not find post text");
    }

    let content = postText;

    // If there's a shared article link, include it
    if (articleUrl) {
      content += `\n\n**Shared article:** ${articleUrl}`;
    }

    const title = author ? `LinkedIn post by ${author}` : "LinkedIn Post";
    const wordCount = content.split(/\s+/).filter(Boolean).length;

    return {
      url,
      title,
      content,
      author,
      datePublished: date,
      wordCount,
      type: "social-media",
      platform: "linkedin",
      status: "success",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown extraction error";
    return fallbackExtraction(url, message);
  }
}

function fallbackExtraction(url: string, reason: string): ExtractedContent {
  console.warn(`[2Vault] LinkedIn extraction fallback (v${SELECTOR_VERSION}): ${reason}`);

  const bodyText = (document.body.innerText ?? "").slice(0, MAX_BODY_TEXT).trim();
  if (!bodyText) {
    return {
      url,
      title: "",
      content: "",
      author: null,
      datePublished: null,
      wordCount: 0,
      type: "social-media",
      platform: "linkedin",
      status: "failed",
      error: `Extraction failed: ${reason}`,
    };
  }

  return {
    url,
    title: "LinkedIn Post",
    content: bodyText,
    author: null,
    datePublished: null,
    wordCount: bodyText.split(/\s+/).filter(Boolean).length,
    type: "social-media",
    platform: "linkedin",
    status: "success",
  };
}

// Listen for extraction requests from service worker
chrome.runtime.onMessage.addListener(
  (
    message: ExtractContentMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: ExtractionResultMessage) => void
  ) => {
    if (message.type === "EXTRACT_CONTENT") {
      const result = extractFromDom();
      sendResponse({ type: "EXTRACTION_RESULT", data: result });
    }
    return false; // Synchronous response
  }
);

// Export for testing
export {
  extractFromDom,
  extractPostText,
  extractAuthorName,
  extractDate,
  extractArticleUrl,
  fallbackExtraction,
  queryFirst,
  SELECTORS,
  SELECTOR_VERSION,
};
