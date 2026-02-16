import type { ErrorCategory } from "@/core/types";

export const ERROR_SUGGESTIONS: Record<ErrorCategory, string> = {
  network: "Check your internet connection or try again later",
  extraction: "This page may require login or block automated access",
  llm: "Check your OpenRouter API key in Settings or try again",
  vault: "Verify Obsidian is running with the REST API plugin enabled",
  unknown: "An unexpected error occurred. Try again or check the error details",
};
