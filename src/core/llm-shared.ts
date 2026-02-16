import type { ExtractedContent, VaultContext } from "@/core/types";

export interface SummarizationResult {
  title: string;
  summary: string;
  keyTakeaways: string[];
}

export interface CategorizationResult {
  suggestedFolder: string;
  suggestedTags: string[];
}

export function buildSummarizationPrompt(content: ExtractedContent): string {
  const parts = [
    `Title: ${content.title}`,
    content.author ? `Author: ${content.author}` : null,
    content.datePublished ? `Published: ${content.datePublished}` : null,
    `URL: ${content.url}`,
    `Type: ${content.type} (${content.platform})`,
    "",
    "Content:",
    content.content,
  ];
  return parts.filter((p) => p !== null).join("\n");
}

export function buildCategorizationPrompt(
  summarized: SummarizationResult,
  content: ExtractedContent,
  vaultContext: VaultContext
): string {
  const folderList = vaultContext.folders.length > 0
    ? vaultContext.folders.join("\n")
    : "(no folders yet)";

  const tagList = vaultContext.tags.length > 0
    ? vaultContext.tags.join(", ")
    : "(no tags yet)";

  const noteExamples = vaultContext.recentNotes.length > 0
    ? vaultContext.recentNotes
        .slice(0, 20)
        .map((n) => `  - ${n.folder}/${n.title} [${n.tags.join(", ")}]`)
        .join("\n")
    : "(no existing notes)";

  const parts: string[] = [
    "Categorize this content into the user's Obsidian vault.",
    "",
    `Title: ${summarized.title}`,
    `Summary: ${summarized.summary}`,
    `Type: ${content.type} (${content.platform})`,
    `URL: ${content.url}`,
    "",
  ];

  // PARA organization instructions
  if (vaultContext.organization === "para") {
    parts.push(
      "This vault uses the PARA organization system. Categorize into one of these top-level folders:",
      "  - Projects: Short-term efforts with a clear goal and deadline",
      "  - Areas: Ongoing responsibilities you manage over time",
      "  - Resources: Topics or interests you want to reference later",
      "  - Archive: Inactive items from the other three categories",
      "",
      "Choose the PARA bucket (level 1) and a topic subfolder (level 2), e.g., Resources/AI or Areas/Health.",
      ""
    );
  }

  parts.push(
    "Available folders:",
    folderList,
    "",
    "Existing tags:",
    tagList,
    ""
  );

  // Tag groups
  if (vaultContext.tagGroups.length > 0) {
    parts.push("User-defined tag groups (prefer tags from these groups):");
    for (const group of vaultContext.tagGroups) {
      parts.push(`  ${group.name}: ${group.tags.join(", ")}`);
    }
    parts.push(
      "",
      "Prefer tags from the above user-defined groups. Only create new tags if no group fits."
    );
    parts.push("");
  }

  parts.push(
    "Example notes in vault:",
    noteExamples,
    "",
    "Choose the best existing folder for this content. Suggest tags that are relevant,",
    "preferring existing tags when they fit. You may suggest new tags if needed."
  );

  return parts.join("\n");
}

export function validateSummarizationResult(
  input: unknown
): SummarizationResult {
  if (
    typeof input !== "object" ||
    input === null ||
    !("title" in input) ||
    !("summary" in input) ||
    !("keyTakeaways" in input)
  ) {
    throw new Error("Invalid summarization result: missing required fields");
  }

  const obj = input as Record<string, unknown>;

  if (typeof obj.title !== "string" || typeof obj.summary !== "string") {
    throw new Error(
      "Invalid summarization result: title and summary must be strings"
    );
  }

  if (!Array.isArray(obj.keyTakeaways)) {
    throw new Error(
      "Invalid summarization result: keyTakeaways must be an array"
    );
  }

  return {
    title: obj.title,
    summary: obj.summary,
    keyTakeaways: obj.keyTakeaways as string[],
  };
}

export function validateCategorizationResult(
  input: unknown,
  folders: string[],
  tagGroups?: Array<{ name: string; tags: string[] }>
): CategorizationResult {
  if (
    typeof input !== "object" ||
    input === null ||
    !("suggestedFolder" in input) ||
    !("suggestedTags" in input)
  ) {
    throw new Error(
      "Invalid categorization result: missing required fields"
    );
  }

  const obj = input as Record<string, unknown>;

  if (typeof obj.suggestedFolder !== "string") {
    throw new Error(
      "Invalid categorization result: suggestedFolder must be a string"
    );
  }

  if (!Array.isArray(obj.suggestedTags)) {
    throw new Error(
      "Invalid categorization result: suggestedTags must be an array"
    );
  }

  let suggestedFolder = obj.suggestedFolder;

  // Validate folder exists in vault; fall back to first folder if not
  if (folders.length > 0 && !folders.includes(suggestedFolder)) {
    suggestedFolder = folders[0]!;
  }

  const suggestedTags = obj.suggestedTags as string[];

  // Warn about tags not in any user-defined group (observability)
  if (tagGroups && tagGroups.length > 0) {
    const allGroupTags = new Set(tagGroups.flatMap((g) => g.tags));
    const inventedTags = suggestedTags.filter((t) => !allGroupTags.has(t));
    if (inventedTags.length > 0) {
      console.warn(
        `LLM suggested tags not in any group: ${inventedTags.join(", ")}`
      );
    }
  }

  return {
    suggestedFolder,
    suggestedTags,
  };
}
