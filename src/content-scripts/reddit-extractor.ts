import type { ExtractedContent } from "@/core/types";
import type { ExtractContentMessage, ExtractionResultMessage } from "@/background/messages";

/** Selector version - bump when Reddit changes their DOM structure */
const SELECTOR_VERSION = 1;

const MAX_BODY_TEXT = 8_000;
const MAX_COMMENTS = 5;

const SELECTORS_NEW = {
  post: "shreddit-post",
  postTitle: '[slot="title"]',
  postBody: '[slot="text-body"]',
  comment: "shreddit-comment",
  commentBody: '[slot="comment"]',
} as const;

const SELECTORS_OLD = {
  post: ".thing.link",
  postTitle: ".title a.title",
  postBody: ".usertext-body",
  comment: ".comment",
  commentAuthor: ".author",
  commentBody: ".usertext-body",
  commentScore: ".score.unvoted",
} as const;

function isOldReddit(): boolean {
  return window.location.hostname === "old.reddit.com";
}

// -- Shadow DOM traversal -----------------------------------------------------

/**
 * Query selector that pierces through Shadow DOM boundaries.
 * Reddit's new UI nests content inside web component shadow roots,
 * so standard document.querySelector() can't find shreddit-post/shreddit-comment.
 */
function deepQuerySelector(selector: string, root: Document | Element = document): Element | null {
  // Try light DOM first
  const found = root.querySelector(selector);
  if (found) return found;

  // Search through shadow roots
  const allElements = root.querySelectorAll("*");
  for (const el of allElements) {
    if (el.shadowRoot) {
      const result = deepQuerySelector(selector, el.shadowRoot as unknown as Element);
      if (result) return result;
    }
  }

  return null;
}

/**
 * Query selector all that pierces through Shadow DOM boundaries.
 */
function deepQuerySelectorAll(selector: string, root: Document | Element = document): Element[] {
  const results: Element[] = [];

  // Collect from light DOM
  results.push(...Array.from(root.querySelectorAll(selector)));

  // Search through shadow roots
  const allElements = root.querySelectorAll("*");
  for (const el of allElements) {
    if (el.shadowRoot) {
      results.push(...deepQuerySelectorAll(selector, el.shadowRoot as unknown as Element));
    }
  }

  return results;
}

// -- New Reddit extraction ----------------------------------------------------

function extractNewRedditPost(): {
  title: string;
  author: string;
  subreddit: string;
  score: string;
  body: string;
  flair: string;
  timestamp: string | null;
} {
  const post = deepQuerySelector(SELECTORS_NEW.post);
  if (!post) return { title: "", author: "", subreddit: "", score: "", body: "", flair: "", timestamp: null };

  // Attributes are on the host element - accessible from outside shadow DOM
  const title = post.getAttribute("post-title") ?? "";
  const author = post.getAttribute("author") ?? "";
  const subreddit = post.getAttribute("subreddit-prefixed-name") ?? "";
  const score = post.getAttribute("score") ?? "";
  const flair = post.getAttribute("flair-text") ?? "";

  // Timestamp: try attribute first, then nested time element
  let timestamp = post.getAttribute("created-timestamp") ?? null;
  if (!timestamp) {
    // Search both light DOM children and shadow DOM for time element
    const timeEl = post.querySelector("time[datetime]")
      ?? (post.shadowRoot?.querySelector("time[datetime]") ?? null);
    timestamp = timeEl?.getAttribute("datetime") ?? null;
  }

  // Body text: slotted content is in light DOM of the host element
  const bodyEl = post.querySelector(SELECTORS_NEW.postBody);
  let body = bodyEl?.textContent?.trim() ?? "";

  // If slotted body not found, try inside shadow root
  if (!body && post.shadowRoot) {
    const shadowBody = post.shadowRoot.querySelector("[slot='text-body'], .text-neutral-content, .md");
    body = shadowBody?.textContent?.trim() ?? "";
  }

  return { title, author, subreddit, score, body, flair, timestamp };
}

function extractNewRedditComments(): Array<{
  author: string;
  text: string;
  score: string;
  depth: number;
  replyCount: number;
}> {
  const comments: Array<{
    author: string;
    text: string;
    score: string;
    depth: number;
    replyCount: number;
  }> = [];

  const commentEls = deepQuerySelectorAll(SELECTORS_NEW.comment);

  for (const el of commentEls) {
    const depth = parseInt(el.getAttribute("depth") ?? "1", 10);
    if (depth !== 0) continue; // Only top-level comments

    const author = el.getAttribute("author") ?? "";
    const score = el.getAttribute("score") ?? "";

    // Comment body: try slotted content first, then shadow DOM
    const bodyEl = el.querySelector(SELECTORS_NEW.commentBody);
    let text = bodyEl?.textContent?.trim() ?? "";
    if (!text && el.shadowRoot) {
      const shadowBody = el.shadowRoot.querySelector("[slot='comment'], .md, p");
      text = shadowBody?.textContent?.trim() ?? "";
    }

    if (!text) continue;

    // Count direct replies (depth=1 children within this comment tree)
    const nestedComments = el.querySelectorAll(`${SELECTORS_NEW.comment}[depth="1"]`);
    let replyCount = nestedComments.length;
    // Also check shadow root for nested comments
    if (replyCount === 0 && el.shadowRoot) {
      const shadowNested = el.shadowRoot.querySelectorAll(`${SELECTORS_NEW.comment}[depth="1"]`);
      replyCount = shadowNested.length;
    }

    comments.push({ author, text, score, depth, replyCount });

    if (comments.length >= MAX_COMMENTS) break;
  }

  return comments;
}

// -- Old Reddit extraction ----------------------------------------------------

function extractOldRedditPost(): {
  title: string;
  author: string;
  subreddit: string;
  score: string;
  body: string;
  flair: string;
  timestamp: string | null;
} {
  const title = document.querySelector(SELECTORS_OLD.postTitle)?.textContent?.trim() ?? "";
  const authorEl = document.querySelector(".thing.link .author");
  const author = authorEl?.textContent?.trim() ?? "";

  const subredditEl = document.querySelector(".redditname a");
  const subreddit = subredditEl?.textContent?.trim() ?? "";

  const scoreEl = document.querySelector(".thing.link .score.unvoted");
  const score = scoreEl?.getAttribute("title") ?? scoreEl?.textContent?.trim() ?? "";

  const bodyEl = document.querySelector(`.thing.link ${SELECTORS_OLD.postBody}`);
  const body = bodyEl?.textContent?.trim() ?? "";

  const flairEl = document.querySelector(".thing.link .linkflairlabel");
  const flair = flairEl?.textContent?.trim() ?? "";

  const timeEl = document.querySelector(".thing.link time[datetime]");
  const timestamp = timeEl?.getAttribute("datetime") ?? null;

  return { title, author, subreddit, score, body, flair, timestamp };
}

function extractOldRedditComments(): Array<{
  author: string;
  text: string;
  score: string;
  depth: number;
  replyCount: number;
}> {
  const comments: Array<{
    author: string;
    text: string;
    score: string;
    depth: number;
    replyCount: number;
  }> = [];

  // Top-level comments in old Reddit are direct children of .sitetable.nestedlisting
  const topLevelComments = document.querySelectorAll(
    ".sitetable.nestedlisting > .thing.comment"
  );

  for (const el of topLevelComments) {
    const authorEl = el.querySelector(":scope > .entry " + SELECTORS_OLD.commentAuthor);
    const author = authorEl?.textContent?.trim() ?? "";

    const bodyEl = el.querySelector(":scope > .entry " + SELECTORS_OLD.commentBody);
    const text = bodyEl?.textContent?.trim() ?? "";

    const scoreEl = el.querySelector(":scope > .entry " + SELECTORS_OLD.commentScore);
    const score = scoreEl?.getAttribute("title") ?? scoreEl?.textContent?.trim() ?? "";

    if (!text) continue;

    const replies = el.querySelectorAll(":scope > .child .thing.comment");
    const replyCount = replies.length;

    comments.push({ author, text, score, depth: 0, replyCount });

    if (comments.length >= MAX_COMMENTS) break;
  }

  return comments;
}

// -- Unified extraction -------------------------------------------------------

function getTotalCommentCount(): number {
  if (isOldReddit()) {
    return document.querySelectorAll(".thing.comment").length;
  }
  return deepQuerySelectorAll(SELECTORS_NEW.comment).length;
}

function formatComments(
  comments: Array<{ author: string; text: string; score: string; replyCount: number }>
): string {
  const totalComments = getTotalCommentCount();

  const parts: string[] = [];
  const header = totalComments > MAX_COMMENTS
    ? `## Top Comments (showing ${comments.length} of ${totalComments})`
    : `## Top Comments`;
  parts.push(header);

  for (const comment of comments) {
    const authorPrefix = comment.author ? `u/${comment.author}` : "Unknown";
    const scoreText = comment.score ? ` (${comment.score} points)` : "";
    let block = `**${authorPrefix}**${scoreText}:\n${comment.text}`;
    if (comment.replyCount > 0) {
      block += `\n(${comment.replyCount} ${comment.replyCount === 1 ? "reply" : "replies"})`;
    }
    parts.push(block);
  }

  return parts.join("\n\n---\n\n");
}

function extractFromDom(): ExtractedContent {
  const url = window.location.href;

  try {
    const post = isOldReddit() ? extractOldRedditPost() : extractNewRedditPost();

    if (!post.title && !post.body) {
      return fallbackExtraction(url, "Could not find post content");
    }

    const comments = isOldReddit() ? extractOldRedditComments() : extractNewRedditComments();

    const sections: string[] = [];

    // Post section
    if (post.body) {
      sections.push("## Post");
      sections.push(post.body);
    }

    // Comments section
    if (comments.length > 0) {
      sections.push("");
      sections.push(formatComments(comments));
    }

    const content = sections.join("\n\n");
    const subredditLabel = post.subreddit ? ` in ${post.subreddit}` : "";
    const title = post.title || "Reddit Post";
    const fullTitle = `${title}${subredditLabel}`;
    const author = post.author ? `u/${post.author}` : null;
    const wordCount = content.split(/\s+/).filter(Boolean).length;

    return {
      url,
      title: fullTitle,
      content,
      author,
      datePublished: post.timestamp,
      wordCount,
      type: "social-media",
      platform: "reddit",
      status: "success",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown extraction error";
    return fallbackExtraction(url, message);
  }
}

function fallbackExtraction(url: string, reason: string): ExtractedContent {
  console.warn(`[2Vault] Reddit extraction fallback (v${SELECTOR_VERSION}): ${reason}`);

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
      platform: "reddit",
      status: "failed",
      error: `Extraction failed: ${reason}`,
    };
  }

  return {
    url,
    title: "Reddit Post",
    content: bodyText,
    author: null,
    datePublished: null,
    wordCount: bodyText.split(/\s+/).filter(Boolean).length,
    type: "social-media",
    platform: "reddit",
    status: "failed",
    error: `Reddit extraction failed (fallback): ${reason}`,
  };
}

const POST_POLL_INTERVAL_MS = 500;
const POST_POLL_TIMEOUT_MS = 15_000;

/**
 * Poll for Reddit post element to appear in the DOM.
 * New Reddit uses web components with Shadow DOM - elements are created
 * dynamically inside shadow roots after JavaScript hydration.
 * Uses deepQuerySelector to pierce shadow boundaries.
 */
async function waitForPostElement(): Promise<Element | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < POST_POLL_TIMEOUT_MS) {
    if (isOldReddit()) {
      const el = document.querySelector(SELECTORS_OLD.postTitle);
      if (el) return el;
    } else {
      // Must use deep query to pierce shadow DOM
      const el = deepQuerySelector(SELECTORS_NEW.post);
      if (el) return el;
    }
    await new Promise((resolve) => setTimeout(resolve, POST_POLL_INTERVAL_MS));
  }

  return null;
}

// Prevent duplicate listener registration when script is re-injected
const LISTENER_KEY = "__2vault_reddit_listener";
const _g = globalThis as unknown as Record<string, boolean>;

if (!_g[LISTENER_KEY]) {
  _g[LISTENER_KEY] = true;

  chrome.runtime.onMessage.addListener(
    (
      message: ExtractContentMessage,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response: ExtractionResultMessage) => void
    ) => {
      if (message.type === "EXTRACT_CONTENT") {
        waitForPostElement().then(() => {
          const result = extractFromDom();
          sendResponse({ type: "EXTRACTION_RESULT", data: result });
        });
        return true; // Keep message channel open for async response
      }
      return false;
    }
  );
}

// Export for testing
export {
  extractFromDom,
  extractNewRedditPost,
  extractNewRedditComments,
  extractOldRedditPost,
  extractOldRedditComments,
  deepQuerySelector,
  deepQuerySelectorAll,
  formatComments,
  fallbackExtraction,
  waitForPostElement,
  isOldReddit,
  SELECTORS_NEW,
  SELECTORS_OLD,
  SELECTOR_VERSION,
  MAX_COMMENTS,
};
