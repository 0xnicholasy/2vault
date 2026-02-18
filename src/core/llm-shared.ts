import type { ExtractedContent, SummaryDetailLevel, VaultContext } from "@/core/types";

export interface SummarizationResult {
  title: string;
  summary: string;
  keyTakeaways: string[];
}

export interface CategorizationResult {
  suggestedFolder: string;
  suggestedTags: string[];
}

const DETAIL_LEVEL_INSTRUCTIONS: Record<SummaryDetailLevel, string> = {
  brief:
    "Write a 1-2 sentence summary. List 2-3 key takeaways as single short sentences.",
  standard:
    "Write a 2-3 sentence summary. List 3-5 key takeaways or insights.",
  detailed:
    "Write a 4-6 sentence summary that captures the nuance and key arguments. List 5-8 key takeaways with enough context that each point is useful standalone.",
};

export function getMaxTokensForDetailLevel(level: SummaryDetailLevel): number {
  switch (level) {
    case "brief":
      return 512;
    case "standard":
      return 1024;
    case "detailed":
      return 1536;
  }
}

export function getSummarizeFunctionSchema(level: SummaryDetailLevel) {
  const descriptions: Record<SummaryDetailLevel, { summary: string; takeaways: string }> = {
    brief: {
      summary: "A 1-2 sentence summary of the content",
      takeaways: "2-3 key takeaways as short sentences",
    },
    standard: {
      summary: "A 2-3 sentence summary of the content",
      takeaways: "3-5 key takeaways or insights from the content",
    },
    detailed: {
      summary: "A 4-6 sentence summary capturing the nuance and key arguments",
      takeaways: "5-8 key takeaways with enough standalone context",
    },
  };

  const desc = descriptions[level];
  return {
    type: "function" as const,
    function: {
      name: "summarize_content",
      description:
        "Summarize web content into a structured format for an Obsidian note.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "A concise, descriptive title for the note",
          },
          summary: {
            type: "string",
            description: desc.summary,
          },
          keyTakeaways: {
            type: "array",
            items: { type: "string" },
            description: desc.takeaways,
          },
        },
        required: ["title", "summary", "keyTakeaways"],
      },
    },
  };
}

export function buildSummarizationPrompt(
  content: ExtractedContent,
  detailLevel: SummaryDetailLevel = "standard"
): string {
  const parts: Array<string | null> = [
    `Title: ${content.title}`,
    content.author ? `Author: ${content.author}` : null,
    content.datePublished ? `Published: ${content.datePublished}` : null,
    `URL: ${content.url}`,
    `Type: ${content.type} (${content.platform})`,
    "",
    `Summary instructions: ${DETAIL_LEVEL_INSTRUCTIONS[detailLevel]}`,
    "",
  ];

  // Add thread/conversation context hints for better LLM summarization
  const hasTopReplies = content.content.includes("## Top Replies");
  const hasTopComments = content.content.includes("## Top Comments");

  if (hasTopReplies) {
    parts.push(
      "Note: This is a threaded conversation. Summarize the author's thread first, then note key discussion points from replies.",
      ""
    );
  } else if (hasTopComments) {
    parts.push(
      "Note: This is a forum post with comments. Summarize the post first, then note key insights from the discussion.",
      ""
    );
  }

  parts.push("Content:", content.content);

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
