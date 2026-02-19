export const DEFAULT_VAULT_URL = "http://localhost:27123";
export const VAULT_CONTEXT_CACHE_TTL = 60 * 60 * 1000; // 1 hour
export const MAX_FOLDERS = 50;
export const MAX_TAGS = 100;
export const MAX_CONTENT_TOKENS = 8000;
export const MAX_HISTORY = 100;

// Only HTTP is supported - HTTPS with self-signed certs is blocked by Chrome extensions
export const VAULT_URL_PRESETS = [
  { label: "Default (localhost:27123)", value: "http://localhost:27123" },
] as const;

export const SUMMARY_DETAIL_OPTIONS = [
  { value: "brief", label: "Brief", description: "1-2 sentence summary, 2-3 key points" },
  { value: "standard", label: "Standard", description: "2-3 sentence summary, 3-5 key points" },
  { value: "detailed", label: "Detailed", description: "Detailed summary, 5-8 key points" },
] as const;

export const PARA_FOLDERS = ["Projects", "Areas", "Resources", "Archive"] as const;

export const PARA_DESCRIPTIONS: Record<string, string> = {
  Projects: "Short-term efforts with a clear goal and deadline",
  Areas: "Ongoing responsibilities you manage over time",
  Resources: "Topics or interests you want to reference later",
  Archive: "Inactive items from the other three categories",
};
