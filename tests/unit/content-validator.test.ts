import { describe, it, expect } from "vitest";
import { assessContentQuality } from "@/core/content-validator";
import type { ExtractedContent } from "@/core/types";

function makeContent(overrides: Partial<ExtractedContent> = {}): ExtractedContent {
  return {
    url: "https://example.com/article",
    title: "Test Article",
    content: "This is a normal article with enough words to pass the minimum threshold for content validation checks.",
    author: "Author",
    datePublished: "2025-01-01",
    wordCount: 20,
    type: "article",
    platform: "web",
    status: "success",
    ...overrides,
  };
}

describe("assessContentQuality", () => {
  it("passes normal content", () => {
    const result = assessContentQuality(makeContent());
    expect(result.isLowQuality).toBe(false);
    expect(result.reason).toBeUndefined();
  });

  it("flags insufficient word count", () => {
    const result = assessContentQuality(makeContent({ wordCount: 5 }));
    expect(result.isLowQuality).toBe(true);
    expect(result.reason).toBe("insufficient-content");
    expect(result.detail).toContain("5 words");
  });

  it("flags word count of exactly 9 (below threshold)", () => {
    const result = assessContentQuality(makeContent({ wordCount: 9 }));
    expect(result.isLowQuality).toBe(true);
    expect(result.reason).toBe("insufficient-content");
  });

  it("passes word count of exactly 10 (at threshold)", () => {
    const result = assessContentQuality(makeContent({ wordCount: 10 }));
    expect(result.isLowQuality).toBe(false);
  });

  it("detects Cloudflare bot protection", () => {
    const result = assessContentQuality(
      makeContent({ content: "Please wait... Checking your browser before accessing the site." })
    );
    expect(result.isLowQuality).toBe(true);
    expect(result.reason).toBe("bot-protection");
    expect(result.detail).toContain("checking your browser");
  });

  it("detects DDoS protection", () => {
    const result = assessContentQuality(
      makeContent({ content: "DDoS protection by Cloudflare. Ray ID: abc123." })
    );
    expect(result.isLowQuality).toBe(true);
    expect(result.reason).toBe("bot-protection");
  });

  it("detects hCaptcha challenge", () => {
    const result = assessContentQuality(
      makeContent({ content: "Please complete the hCaptcha verification to continue." })
    );
    expect(result.isLowQuality).toBe(true);
    expect(result.reason).toBe("bot-protection");
  });

  it("detects login wall - sign in", () => {
    const result = assessContentQuality(
      makeContent({ content: "You need to sign in to continue reading this article." })
    );
    expect(result.isLowQuality).toBe(true);
    expect(result.reason).toBe("login-wall");
  });

  it("detects login wall - subscribe", () => {
    const result = assessContentQuality(
      makeContent({ content: "Subscribe to continue reading premium content." })
    );
    expect(result.isLowQuality).toBe(true);
    expect(result.reason).toBe("login-wall");
  });

  it("detects login wall - members only", () => {
    const result = assessContentQuality(
      makeContent({ content: "This article is members only. Please create an account." })
    );
    expect(result.isLowQuality).toBe(true);
    expect(result.reason).toBe("login-wall");
  });

  it("detects soft 404", () => {
    const result = assessContentQuality(
      makeContent({ content: "Sorry, the page not found. Please check the URL." })
    );
    expect(result.isLowQuality).toBe(true);
    expect(result.reason).toBe("soft-404");
  });

  it("detects 'no longer available' soft 404", () => {
    const result = assessContentQuality(
      makeContent({ content: "This content is no longer available on our platform." })
    );
    expect(result.isLowQuality).toBe(true);
    expect(result.reason).toBe("soft-404");
  });

  it("detects deleted tweets on social media platform", () => {
    const result = assessContentQuality(
      makeContent({
        content: "This tweet has been deleted by the author.",
        platform: "x",
        type: "social-media",
      })
    );
    expect(result.isLowQuality).toBe(true);
    expect(result.reason).toBe("deleted-content");
  });

  it("detects suspended accounts on social media platform", () => {
    const result = assessContentQuality(
      makeContent({
        content: "This account has been suspended for violating terms.",
        platform: "x",
        type: "social-media",
      })
    );
    expect(result.isLowQuality).toBe(true);
    expect(result.reason).toBe("deleted-content");
  });

  it("does NOT flag deleted content patterns on web platform", () => {
    const result = assessContentQuality(
      makeContent({
        content: "An article about how this tweet has been deleted and the controversy around it.",
        platform: "web",
        type: "article",
        wordCount: 50,
      })
    );
    // On web platform, deleted-content check is skipped
    expect(result.reason).not.toBe("deleted-content");
  });

  it("prioritizes bot-protection over login-wall", () => {
    const result = assessContentQuality(
      makeContent({
        content: "Checking your browser... Please sign in to continue after verification.",
      })
    );
    expect(result.isLowQuality).toBe(true);
    expect(result.reason).toBe("bot-protection");
  });

  it("prioritizes insufficient-content over everything", () => {
    const result = assessContentQuality(
      makeContent({
        content: "Sign in to continue",
        wordCount: 4,
      })
    );
    expect(result.isLowQuality).toBe(true);
    expect(result.reason).toBe("insufficient-content");
  });

  it("does not false-positive on article about sign-in pages", () => {
    const result = assessContentQuality(
      makeContent({
        content:
          "In this article we discuss best practices for designing sign-in pages. Users should see a clear call-to-action. The form should validate email addresses. Password requirements should be shown upfront. Remember to add OAuth options.",
        wordCount: 40,
      })
    );
    // "sign in" alone should not trigger - only "sign in to continue"
    expect(result.isLowQuality).toBe(false);
  });

  it("populates detail field correctly for bot protection", () => {
    const result = assessContentQuality(
      makeContent({ content: "Enable JavaScript and cookies to continue." })
    );
    expect(result.isLowQuality).toBe(true);
    expect(result.detail).toContain("enable javascript and cookies");
  });
});

// -- error-page reason (HIGH) -------------------------------------------------

describe("assessContentQuality - error-page reason", () => {
  it("detects error-page content quality reason for X 'Something went wrong' page", () => {
    const result = assessContentQuality(
      makeContent({
        content:
          "Something went wrong. Try reloading. Don't worry, it's not your fault.",
        platform: "x",
        type: "social-media",
        wordCount: 15,
      })
    );
    expect(result.isLowQuality).toBe(true);
    expect(result.reason).toBe("error-page");
  });

  it("returns 'error-page' for suspended account X page", () => {
    const result = assessContentQuality(
      makeContent({
        content:
          "Caution: This post is from a suspended account. Learn more about suspended accounts.",
        platform: "x",
        type: "social-media",
        wordCount: 15,
      })
    );
    expect(result.isLowQuality).toBe(true);
    expect(result.reason).toBe("error-page");
  });

  it("returns 'error-page' for X rate limit page", () => {
    const result = assessContentQuality(
      makeContent({
        content:
          "You have exceeded the rate limit. Please wait a few minutes before retrying.",
        platform: "x",
        type: "social-media",
        wordCount: 15,
      })
    );
    expect(result.isLowQuality).toBe(true);
    expect(result.reason).toBe("error-page");
  });

  it("does NOT flag 'error-page' for web articles that mention X error pages", () => {
    const result = assessContentQuality(
      makeContent({
        content:
          "A guide to debugging when Twitter shows 'Something went wrong'. The error usually means the API is down.",
        platform: "web",
        type: "article",
        wordCount: 25,
      })
    );
    expect(result.reason).not.toBe("error-page");
  });
});
