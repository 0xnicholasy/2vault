import type { ExtractedContent } from "@/core/types";
import type { ExtractContentMessage, ExtractionResultMessage } from "@/background/messages";

/** Selector version - bump when Twitter changes their DOM structure */
const SELECTOR_VERSION = 1;

const SELECTORS = {
  tweet: 'article[data-testid="tweet"]',
  userName: '[data-testid="User-Name"]',
  tweetText: '[data-testid="tweetText"]',
  time: "time[datetime]",
  quoteTweet: '[data-testid="tweet"] [data-testid="tweet"]',
  imageAlt: 'img[alt]:not([alt=""])',
} as const;

const MAX_BODY_TEXT = 8_000;
const MAX_REPLIES = 5;

function extractTweetText(article: Element): string {
  const tweetText = article.querySelector(SELECTORS.tweetText);
  return tweetText?.textContent?.trim() ?? "";
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
      platform: "x",
      status: "failed",
      error: `Extraction failed: ${reason}`,
    };
  }

  return {
    url,
    title: "X Post",
    content: bodyText,
    author: null,
    datePublished: null,
    wordCount: bodyText.split(/\s+/).filter(Boolean).length,
    type: "social-media",
    platform: "x",
    status: "success",
  };
}

const TWEET_POLL_INTERVAL_MS = 500;
const TWEET_POLL_TIMEOUT_MS = 10_000;

/**
 * Poll for tweet article element to appear in the DOM.
 * Twitter/X uses React hydration which may not have rendered the tweet
 * by the time the tab "complete" event fires.
 */
async function waitForTweetElement(): Promise<Element | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < TWEET_POLL_TIMEOUT_MS) {
    const article = document.querySelector(SELECTORS.tweet);
    if (article) return article;
    await new Promise((resolve) => setTimeout(resolve, TWEET_POLL_INTERVAL_MS));
  }

  return null;
}

// Listen for extraction requests from service worker
chrome.runtime.onMessage.addListener(
  (
    message: ExtractContentMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: ExtractionResultMessage) => void
  ) => {
    if (message.type === "EXTRACT_CONTENT") {
      // Async handler: wait for tweet DOM to hydrate before extracting
      waitForTweetElement().then(() => {
        const result = extractFromDom();
        sendResponse({ type: "EXTRACTION_RESULT", data: result });
      });
      return true; // Keep message channel open for async response
    }
    return false;
  }
);

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
  SELECTORS,
  SELECTOR_VERSION,
  MAX_REPLIES,
};
