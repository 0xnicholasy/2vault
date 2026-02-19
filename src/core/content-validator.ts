import type { ExtractedContent, ContentQuality, Platform } from "@/core/types";

const BOT_PROTECTION_PATTERNS = [
  "checking your browser",
  "attention required",
  "ddos protection by",
  "cf-browser-verification",
  "please verify you are a human",
  "just a moment",
  "enable javascript and cookies",
  "hcaptcha",
  "recaptcha",
];

const LOGIN_WALL_PATTERNS = [
  "sign in to continue",
  "log in to continue",
  "please sign in",
  "please log in",
  "create an account",
  "subscribe to continue reading",
  "this content is for subscribers",
  "you must be logged in",
  "members only",
];

const SOFT_404_PATTERNS = [
  "page not found",
  "404 not found",
  "this page doesn't exist",
  "no longer available",
  "has been removed",
];

const DELETED_CONTENT_PATTERNS = [
  "this tweet has been deleted",
  "this post has been deleted",
  "this account has been suspended",
  "content not available",
];

const ERROR_PAGE_PATTERNS = [
  "something went wrong",
  "this post is from a suspended account",
  "rate limit",
];

const MIN_WORD_COUNT = 10;

function matchesPattern(text: string, patterns: string[]): string | null {
  const lower = text.toLowerCase();
  for (const pattern of patterns) {
    if (lower.includes(pattern)) {
      return pattern;
    }
  }
  return null;
}

function isSocialPlatform(platform: Platform): boolean {
  return platform !== "web";
}

export function assessContentQuality(content: ExtractedContent): ContentQuality {
  const ok: ContentQuality = { isLowQuality: false };

  // 1. Insufficient content
  if (content.wordCount < MIN_WORD_COUNT) {
    return {
      isLowQuality: true,
      reason: "insufficient-content",
      detail: `Only ${content.wordCount} words extracted (minimum ${MIN_WORD_COUNT})`,
    };
  }

  const text = content.content;

  // 2. Bot protection (checked before login walls — Cloudflare pages can contain login-like text)
  const botMatch = matchesPattern(text, BOT_PROTECTION_PATTERNS);
  if (botMatch) {
    return {
      isLowQuality: true,
      reason: "bot-protection",
      detail: `Detected bot protection: "${botMatch}"`,
    };
  }

  // 3. Login walls
  const loginMatch = matchesPattern(text, LOGIN_WALL_PATTERNS);
  if (loginMatch) {
    return {
      isLowQuality: true,
      reason: "login-wall",
      detail: `Detected login wall: "${loginMatch}"`,
    };
  }

  // 4. Soft 404s
  const soft404Match = matchesPattern(text, SOFT_404_PATTERNS);
  if (soft404Match) {
    return {
      isLowQuality: true,
      reason: "soft-404",
      detail: `Detected soft 404: "${soft404Match}"`,
    };
  }

  // 5. Deleted social content (only for social media platforms)
  if (isSocialPlatform(content.platform)) {
    const deletedMatch = matchesPattern(text, DELETED_CONTENT_PATTERNS);
    if (deletedMatch) {
      return {
        isLowQuality: true,
        reason: "deleted-content",
        detail: `Detected deleted content: "${deletedMatch}"`,
      };
    }
  }

  // 6. Error pages (only for social media platforms)
  if (isSocialPlatform(content.platform)) {
    const errorPageMatch = matchesPattern(text, ERROR_PAGE_PATTERNS);
    if (errorPageMatch) {
      return {
        isLowQuality: true,
        reason: "error-page",
        detail: `Detected error page: "${errorPageMatch}"`,
      };
    }
  }

  return ok;
}
