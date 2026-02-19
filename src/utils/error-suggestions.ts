import type { ErrorCategory, ContentQualityReason } from "@/core/types";

export const ERROR_SUGGESTIONS: Record<ErrorCategory, string> = {
  network: "Check your internet connection or try again later",
  "login-required": "This page requires login. Try opening it in your browser and saving from there",
  "bot-protection": "This page blocked automated access. Try the keyboard shortcut while viewing the page",
  "page-not-found": "This page no longer exists. Check the URL or try the Wayback Machine",
  extraction: "This page may require login or block automated access",
  llm: "Check your OpenRouter API key in Settings or try again",
  vault: "Verify Obsidian is running with the REST API plugin enabled",
  timeout: "The page took too long to load. This often happens with rate-limited sites. Try again later",
  unknown: "An unexpected error occurred. Try again or check the error details",
};

export const QUALITY_SUGGESTIONS: Record<ContentQualityReason, string> = {
  "login-wall": "This page requires login. Try opening it in your browser and saving from there",
  "bot-protection": "This page blocked automated access. Try the keyboard shortcut while viewing the page",
  "soft-404": "This page appears to no longer exist",
  "deleted-content": "The original content appears to have been deleted",
  "insufficient-content": "Very little content was extracted. The page may require JavaScript or login",
  "error-page": "The page returned an error instead of the expected content. Try again later",
};
