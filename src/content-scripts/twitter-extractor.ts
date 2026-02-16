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

function extractThread(): { content: string; tweetCount: number } {
  const tweets = document.querySelectorAll(SELECTORS.tweet);
  const parts: string[] = [];

  for (let i = 0; i < tweets.length; i++) {
    const article = tweets[i]!;
    const text = extractTweetText(article);
    if (!text) continue;

    const quoteTweet = extractQuoteTweet(article);
    const images = extractImageDescriptions(article);

    let part = `**[${i + 1}/${tweets.length}]** ${text}`;
    if (quoteTweet) part += `\n\n${quoteTweet}`;
    if (images.length > 0) part += `\n\n[Images: ${images.join(", ")}]`;

    parts.push(part);
  }

  return { content: parts.join("\n\n---\n\n"), tweetCount: tweets.length };
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
      const thread = extractThread();
      content = thread.content;
      title = `Thread by ${name || handle} (${thread.tweetCount} tweets)`;
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
};
