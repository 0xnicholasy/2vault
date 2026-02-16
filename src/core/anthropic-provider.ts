import Anthropic from "@anthropic-ai/sdk";
import type { Message, ContentBlock, Tool } from "@anthropic-ai/sdk/resources/messages";
import type {
  ExtractedContent,
  LLMProvider,
  ProcessedNote,
  VaultContext,
} from "@/core/types";
import { LLMProcessingError } from "@/core/types";

const HAIKU_MODEL = "claude-haiku-4-5-20251001";
const SONNET_MODEL = "claude-sonnet-4-5-20250929";

const SUMMARIZE_TOOL: Tool = {
  name: "summarize_content",
  description:
    "Summarize web content into a structured format for an Obsidian note.",
  input_schema: {
    type: "object" as const,
    properties: {
      title: {
        type: "string",
        description: "A concise, descriptive title for the note",
      },
      summary: {
        type: "string",
        description: "A 2-3 sentence summary of the content",
      },
      keyTakeaways: {
        type: "array",
        items: { type: "string" },
        description: "3-5 key takeaways or insights from the content",
      },
    },
    required: ["title", "summary", "keyTakeaways"],
  },
};

const CATEGORIZE_TOOL: Tool = {
  name: "categorize_content",
  description:
    "Choose the best folder and tags for this content based on the user's vault structure.",
  input_schema: {
    type: "object" as const,
    properties: {
      suggestedFolder: {
        type: "string",
        description:
          "The most appropriate existing folder path for this content",
      },
      suggestedTags: {
        type: "array",
        items: { type: "string" },
        description:
          "3-7 relevant tags, preferring existing vault tags when appropriate",
      },
    },
    required: ["suggestedFolder", "suggestedTags"],
  },
};

interface SummarizationResult {
  title: string;
  summary: string;
  keyTakeaways: string[];
}

interface CategorizationResult {
  suggestedFolder: string;
  suggestedTags: string[];
}

function buildSummarizationPrompt(content: ExtractedContent): string {
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

function buildCategorizationPrompt(
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

  return [
    "Categorize this content into the user's Obsidian vault.",
    "",
    `Title: ${summarized.title}`,
    `Summary: ${summarized.summary}`,
    `Type: ${content.type} (${content.platform})`,
    `URL: ${content.url}`,
    "",
    "Available folders:",
    folderList,
    "",
    "Existing tags:",
    tagList,
    "",
    "Example notes in vault:",
    noteExamples,
    "",
    "Choose the best existing folder for this content. Suggest tags that are relevant,",
    "preferring existing tags when they fit. You may suggest new tags if needed.",
  ].join("\n");
}

function extractToolUseResult(
  response: Message,
  toolName: string
): { input: unknown } {
  const block = response.content.find(
    (b: ContentBlock) => b.type === "tool_use" && b.name === toolName
  );

  if (!block || block.type !== "tool_use") {
    throw new Error(`No tool_use block found for tool "${toolName}"`);
  }

  return { input: block.input };
}

function validateSummarizationResult(
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

function validateCategorizationResult(
  input: unknown,
  folders: string[]
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

  return {
    suggestedFolder,
    suggestedTags: obj.suggestedTags as string[],
  };
}

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({
      apiKey,
      dangerouslyAllowBrowser: true,
    });
  }

  async processContent(
    content: ExtractedContent,
    vaultContext: VaultContext
  ): Promise<ProcessedNote> {
    // Call 1: Summarization with Haiku
    const summarized = await this.summarize(content);

    // Call 2: Categorization with Sonnet
    const categorized = await this.categorize(
      summarized,
      content,
      vaultContext
    );

    return {
      title: summarized.title,
      summary: summarized.summary,
      keyTakeaways: summarized.keyTakeaways,
      suggestedFolder: categorized.suggestedFolder,
      suggestedTags: categorized.suggestedTags,
      type: content.type,
      platform: content.platform,
      source: content,
    };
  }

  private async summarize(
    content: ExtractedContent
  ): Promise<SummarizationResult> {
    let response: Message;
    try {
      response = await this.client.messages.create({
        model: HAIKU_MODEL,
        max_tokens: 1024,
        tools: [SUMMARIZE_TOOL],
        tool_choice: { type: "tool", name: "summarize_content" },
        messages: [
          {
            role: "user",
            content: buildSummarizationPrompt(content),
          },
        ],
      });
    } catch (err) {
      throw new LLMProcessingError(
        `Summarization API call failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        "summarization",
        err instanceof Error ? err : undefined
      );
    }

    try {
      const { input } = extractToolUseResult(response, "summarize_content");
      return validateSummarizationResult(input);
    } catch (err) {
      throw new LLMProcessingError(
        `Summarization result invalid: ${err instanceof Error ? err.message : "Unknown error"}`,
        "summarization",
        err instanceof Error ? err : undefined
      );
    }
  }

  private async categorize(
    summarized: SummarizationResult,
    content: ExtractedContent,
    vaultContext: VaultContext
  ): Promise<CategorizationResult> {
    let response: Message;
    try {
      response = await this.client.messages.create({
        model: SONNET_MODEL,
        max_tokens: 1024,
        tools: [CATEGORIZE_TOOL],
        tool_choice: { type: "tool", name: "categorize_content" },
        messages: [
          {
            role: "user",
            content: buildCategorizationPrompt(
              summarized,
              content,
              vaultContext
            ),
          },
        ],
      });
    } catch (err) {
      throw new LLMProcessingError(
        `Categorization API call failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        "categorization",
        err instanceof Error ? err : undefined
      );
    }

    try {
      const { input } = extractToolUseResult(response, "categorize_content");
      return validateCategorizationResult(input, vaultContext.folders);
    } catch (err) {
      throw new LLMProcessingError(
        `Categorization result invalid: ${err instanceof Error ? err.message : "Unknown error"}`,
        "categorization",
        err instanceof Error ? err : undefined
      );
    }
  }
}
