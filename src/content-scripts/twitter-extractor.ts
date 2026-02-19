import type { ExtractedContent } from "@/core/types";
import type { ExtractContentMessage, ExtractionResultMessage } from "@/background/messages";

/** Selector version - bump when Twitter changes their DOM structure */
const SELECTOR_VERSION = 2; // v2: Added multi-selector fallback strategy

const SELECTORS = {
  tweet: 'article[data-testid="tweet"]',
  userName: '[data-testid="User-Name"]',
  tweetText: '[data-testid="tweetText"]',
  time: "time[datetime]",
  quoteTweet: '[data-testid="tweet"] [data-testid="tweet"]',
  imageAlt: 'img[alt]:not([alt=""])',
} as const;

/** Fallback selectors to try when primary selectors fail */
const FALLBACK_SELECTORS = {
  tweetText: [
    '[data-testid="tweetText"]',                    // Primary selector
    'div[lang][dir="auto"]',                        // Twitter uses lang + dir on tweet text
    'div[data-testid="tweetDetail"] div[lang]',     // Tweet detail view
    'article div[lang]:not([data-testid])',         // Generic lang div in article
  ],
} as const;

const MAX_BODY_TEXT = 8_000;
const MAX_REPLIES = 5;

function extractTweetText(article: Element): string {
  // Try each fallback selector in order until we find content
  for (const selector of FALLBACK_SELECTORS.tweetText) {
    const element = article.querySelector(selector);
    const text = element?.textContent?.trim() ?? "";
    if (text && text.length > 0) {
      if (selector !== SELECTORS.tweetText) {
        console.log(`[2Vault] Found tweet text using fallback selector: ${selector}`);
      }
      return text;
    }
  }

  console.warn("[2Vault] All tweetText selectors failed");
  return "";
}

function extractAuthor(article: Element): { name: string; handle: string } {
  const userNameEl = article.querySelector(SELECTORS.userName);
  if (!userNameEl) return { name: "", handle: "" };

  const spans = userNameEl.querySelectorAll("span");
  let name = "";
  let handle = "";

  for (const span of spans) {
    const text = span.textContent?.trim() ?? "";
    if (text.startsWith("@")) {
      handle = text;
    } else if (text && !name && !text.startsWith("Verified") && text !== "\u00B7") {
      name = text;
    }
  }

  return { name, handle };
}

function extractTimestamp(article: Element): string | null {
  const timeEl = article.querySelector(SELECTORS.time);
  return timeEl?.getAttribute("datetime") ?? null;
}

function extractImageDescriptions(article: Element): string[] {
  const images = article.querySelectorAll(SELECTORS.imageAlt);
  const descriptions: string[] = [];

  for (const img of images) {
    const alt = img.getAttribute("alt");
    if (alt && alt !== "Image" && !alt.startsWith("Profile")) {
      descriptions.push(alt);
    }
  }

  return descriptions;
}

function extractQuoteTweet(article: Element): string | null {
  // Quote tweets are nested tweet articles
  const quoteTweet = article.querySelector(SELECTORS.quoteTweet);
  if (!quoteTweet) return null;

  const text = extractTweetText(quoteTweet);
  const { name, handle } = extractAuthor(quoteTweet);
  if (!text) return null;

  const attribution = name ? `${name} (${handle})` : handle;
  return attribution ? `> ${attribution}:\n> ${text}` : `> ${text}`;
}

function isThreadPage(): boolean {
  const tweets = document.querySelectorAll(SELECTORS.tweet);
  return tweets.length > 1;
}

interface ThreadResult {
  content: string;
  authorTweetCount: number;
  replyCount: number;
  totalReplies: number;
}

function extractThreadWithReplies(): ThreadResult {
  const tweets = document.querySelectorAll(SELECTORS.tweet);

  // Determine OP handle from first tweet
  const firstTweet = tweets[0];
  const opHandle = firstTweet ? extractAuthor(firstTweet).handle : "";

  const authorParts: string[] = [];
  const replyParts: string[] = [];
  let totalReplies = 0;

  for (let i = 0; i < tweets.length; i++) {
    const article = tweets[i]!;
    const text = extractTweetText(article);
    if (!text) continue;

    const { name, handle } = extractAuthor(article);
    const quoteTweet = extractQuoteTweet(article);
    const images = extractImageDescriptions(article);

    const isAuthorTweet = handle === opHandle;

    if (isAuthorTweet) {
      let part = `**[${authorParts.length + 1}]** ${text}`;
      if (quoteTweet) part += `\n\n${quoteTweet}`;
      if (images.length > 0) part += `\n\n[Images: ${images.join(", ")}]`;
      authorParts.push(part);
    } else {
      totalReplies++;
      if (replyParts.length < MAX_REPLIES) {
        const attribution = name ? `${name} (${handle})` : handle;
        let part = `**${attribution}:** ${text}`;
        if (quoteTweet) part += `\n\n${quoteTweet}`;
        if (images.length > 0) part += `\n\n[Images: ${images.join(", ")}]`;
        replyParts.push(part);
      }
    }
  }

  // Build numbered author thread section
  const numberedAuthorParts = authorParts.map((part, i) => {
    return part.replace(`**[${i + 1}]**`, `**[${i + 1}/${authorParts.length}]**`);
  });

  const sections: string[] = [];

  sections.push("## Thread");
  sections.push(numberedAuthorParts.join("\n\n---\n\n"));

  if (replyParts.length > 0) {
    sections.push("");
    sections.push("## Top Replies");
    if (totalReplies > MAX_REPLIES) {
      sections.push(`*(Showing ${MAX_REPLIES} of ${totalReplies} replies)*`);
    }
    sections.push(replyParts.join("\n\n---\n\n"));
  }

  return {
    content: sections.join("\n\n"),
    authorTweetCount: authorParts.length,
    replyCount: replyParts.length,
    totalReplies,
  };
}

function extractSingleTweet(): string {
  const article = document.querySelector(SELECTORS.tweet);
  if (!article) return "";

  const text = extractTweetText(article);
  const quoteTweet = extractQuoteTweet(article);
  const images = extractImageDescriptions(article);

  let content = text;
  if (quoteTweet) content += `\n\n**Quoted:**\n${quoteTweet}`;
  if (images.length > 0) content += `\n\n[Images: ${images.join(", ")}]`;

  return content;
}

function extractFromDom(): ExtractedContent {
  const url = window.location.href;

  try {
    const firstArticle = document.querySelector(SELECTORS.tweet);
    if (!firstArticle) {
      return fallbackExtraction(url, "No tweet article found on page");
    }

    const { name, handle } = extractAuthor(firstArticle);
    const timestamp = extractTimestamp(firstArticle);
    const isThread = isThreadPage();

    let content: string;
    let title: string;

    if (isThread) {
      const thread = extractThreadWithReplies();
      content = thread.content;
      const replyPart = thread.replyCount > 0 ? ` + ${thread.totalReplies} replies` : "";
      title = `Thread by ${name || handle} (${thread.authorTweetCount} tweets)${replyPart}`;
    } else {
      content = extractSingleTweet();
      title = `Post by ${name || handle}`;
    }

    if (!content.trim()) {
      return fallbackExtraction(url, "Could not extract tweet text");
    }

    const author = name ? `${name} (${handle})` : handle || null;
    const wordCount = content.split(/\s+/).filter(Boolean).length;

    return {
      url,
      title,
      content,
      author,
      datePublished: timestamp,
      wordCount,
      type: "social-media",
      platform: "x",
      status: "success",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown extraction error";
    return fallbackExtraction(url, message);
  }
}

function fallbackExtraction(url: string, reason: string): ExtractedContent {
  console.warn(`[2Vault] Twitter extraction fallback (v${SELECTOR_VERSION}): ${reason}`);

  // Diagnostic logging for debugging selector failures
  const articleCount = document.querySelectorAll(SELECTORS.tweet).length;
  const hasUserName = !!document.querySelector(SELECTORS.userName);
  const hasTweetText = !!document.querySelector(SELECTORS.tweetText);

  console.error(`[2Vault] DOM state: articles=${articleCount}, userName=${hasUserName}, tweetText=${hasTweetText}`);

  // Strategy 1: Try smart extraction from article element first
  if (articleCount > 0) {
    const article = document.querySelector(SELECTORS.tweet);
    console.log(`[2Vault] Fallback: article element ${article ? "found" : "NOT FOUND"}`);
    if (article) {
      const smartText = smartExtractFromArticle(article);
      console.log(`[2Vault] Fallback: smartText length=${smartText.length}`);
      if (smartText && smartText.length > 50) {
        console.log(`[2Vault] Smart fallback extracted ${smartText.length} chars from article`);
        return {
          url,
          title: "X Post (smart fallback)",
          content: smartText,
          author: null,
          datePublished: null,
          wordCount: smartText.split(/\s+/).filter(Boolean).length,
          type: "social-media",
          platform: "x",
          status: "review", // Mark as review instead of failed
          error: `Smart fallback extraction: ${reason}`,
        };
      }
    }
  }

  // Strategy 2: Filter navigation junk from body text
  const bodyText = (document.body.innerText ?? "").slice(0, MAX_BODY_TEXT).trim();

  if (bodyText) {
    console.error(`[2Vault] Body text preview (first 200 chars): ${bodyText.slice(0, 200)}`);
  }

  if (!bodyText) {
    return {
      url,
      title: "",
      content: "",
      author: null,
      datePublished: null,
      wordCount: 0,
      type: "social-media",
      platform: "x",
      status: "failed",
      error: `Extraction failed: ${reason} (DOM empty, articles=${articleCount})`,
    };
  }

  const filteredText = filterNavigationText(bodyText);
  const finalText = filteredText || bodyText;

  return {
    url,
    title: "X Post (fallback)",
    content: finalText,
    author: null,
    datePublished: null,
    wordCount: finalText.split(/\s+/).filter(Boolean).length,
    type: "social-media",
    platform: "x",
    status: "review", // Mark as review instead of failed - user can verify
    error: `Fallback extraction: ${reason} (articles=${articleCount})`,
  };
}

/**
 * Smart extraction: find text content within article, excluding navigation
 */
function smartExtractFromArticle(article: Element): string {
  const langDivs = article.querySelectorAll("div[lang]");
  console.log(`[2Vault] Smart extract: found ${langDivs.length} div[lang] elements in article`);

  const texts: string[] = [];

  for (const div of langDivs) {
    const text = div.textContent?.trim() ?? "";
    console.log(`[2Vault] Smart extract: div[lang] text length=${text.length}, isNav=${isNavigationText(text)}, preview="${text.slice(0, 50)}"`);

    // Filter out very short text (likely UI labels) and navigation
    if (text.length > 20 && !isNavigationText(text)) {
      texts.push(text);
    }
  }

  console.log(`[2Vault] Smart extract: extracted ${texts.length} text blocks, total length=${texts.join("\n\n").length}`);
  return texts.join("\n\n");
}

/**
 * Filter out navigation/UI text from body text
 */
function filterNavigationText(text: string): string {
  const lines = text.split("\n").map((line) => line.trim());
  const filtered = lines.filter((line) => {
    if (line.length < 10) return false; // Too short, likely UI label

    // Common navigation terms (English and Chinese)
    const navPatterns = [
      /^(home|explore|notifications|messages|grok|bookmarks|premium|profile|more)$/i,
      /^(首頁|探索|通知|聊天|書籤|個人資料|更多|發佈)$/,
      /^(若要查看|查看鍵盤快速鍵|鍵盤快速鍵)/,
      /^(創作者工作室|premium|訂閱|subscribe|follow)/i,
      /^\d+$/, // Pure numbers (like engagement counts)
    ];

    return !navPatterns.some((pattern) => pattern.test(line));
  });

  return filtered.join("\n");
}

/**
 * Check if text is navigation/UI element
 */
function isNavigationText(text: string): boolean {
  const navPatterns = [
    /^(home|explore|notifications|messages|grok|bookmarks|premium|profile|more)$/i,
    /^(首頁|探索|通知|聊天|書籤|個人資料|更多|發佈)$/,
    /^(若要查看|查看鍵盤快速鍵)/,
    /^(創作者工作室|premium)/i,
  ];

  return navPatterns.some((pattern) => pattern.test(text.trim()));
}

const TWEET_POLL_INTERVAL_MS = 500;
const TWEET_POLL_TIMEOUT_MS = 30_000; // Increased from 10s to allow React hydration in background tabs

/**
 * Poll for tweet article element to appear in the DOM.
 * Twitter/X uses React hydration which may not have rendered the tweet
 * by the time the tab "complete" event fires.
 */
async function waitForTweetElement(): Promise<Element | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < TWEET_POLL_TIMEOUT_MS) {
    // Early failure detection for known error states (fail fast instead of waiting 30s)
    const bodyText = document.body.innerText || "";
    const errorPatterns = [
      /something went wrong/i,
      /rate limit/i,
      /suspended/i,
      /unavailable/i,
      /doesn't exist/i,
      /try again later/i,
    ];

    for (const pattern of errorPatterns) {
      if (pattern.test(bodyText)) {
        console.warn(`[2Vault] Twitter error page detected: ${pattern}. Failing fast.`);
        return null;
      }
    }

    const article = document.querySelector(SELECTORS.tweet);
    if (article) {
      const elapsed = Date.now() - startTime;
      console.log(`[2Vault] Tweet element found after ${elapsed}ms`);
      return article;
    }

    await new Promise((resolve) => setTimeout(resolve, TWEET_POLL_INTERVAL_MS));
  }

  const elapsed = Date.now() - startTime;
  console.warn(`[2Vault] Tweet element not found after ${elapsed}ms timeout`);
  return null;
}

// Prevent duplicate listener registration when script is re-injected via
// chrome.scripting.executeScript (each injection runs the file again in the
// same isolated world, which would add another onMessage listener).
const LISTENER_KEY = "__2vault_twitter_listener";
const _g = globalThis as unknown as Record<string, boolean>;

if (!_g[LISTENER_KEY]) {
  _g[LISTENER_KEY] = true;

  // Listen for extraction requests from service worker.
  // No concurrency guard: each message gets its own sendResponse callback,
  // so parallel waitForTweetElement calls are safe and let the retry loop
  // receive whichever response arrives first.
  chrome.runtime.onMessage.addListener(
    (
      message: ExtractContentMessage,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response: ExtractionResultMessage) => void
    ) => {
      if (message.type === "EXTRACT_CONTENT") {
        waitForTweetElement().then(() => {
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
  extractTweetText,
  extractAuthor,
  extractTimestamp,
  extractImageDescriptions,
  extractQuoteTweet,
  isThreadPage,
  extractThreadWithReplies,
  extractSingleTweet,
  fallbackExtraction,
  waitForTweetElement,
  smartExtractFromArticle,
  filterNavigationText,
  isNavigationText,
  SELECTORS,
  FALLBACK_SELECTORS,
  SELECTOR_VERSION,
  MAX_REPLIES,
};
