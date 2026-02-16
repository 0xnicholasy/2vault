import type {
  ExtractedContent,
  LLMProvider,
  ProcessedNote,
  VaultContext,
} from "@/core/types";
import { LLMProcessingError } from "@/core/types";
import {
  buildSummarizationPrompt,
  buildCategorizationPrompt,
  validateSummarizationResult,
  validateCategorizationResult,
} from "@/core/llm-shared";
import type { SummarizationResult } from "@/core/llm-shared";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_AUTH_URL = "https://openrouter.ai/api/v1/auth/key";
const SUMMARIZATION_MODEL = "google/gemini-2.0-flash-001";
const CATEGORIZATION_MODEL = "google/gemini-2.0-flash-001";

/**
 * Test OpenRouter API key validity by calling their auth/key endpoint.
 * Returns true if the key is valid and has credits.
 */
export async function testOpenRouterConnection(apiKey: string): Promise<boolean> {
  const response = await fetch(OPENROUTER_AUTH_URL, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  return response.ok;
}

const SUMMARIZE_FUNCTION = {
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
  },
};

const CATEGORIZE_FUNCTION = {
  type: "function" as const,
  function: {
    name: "categorize_content",
    description:
      "Choose the best folder and tags for this content based on the user's vault structure.",
    parameters: {
      type: "object",
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
  },
};

interface OpenRouterMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface OpenRouterToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenRouterChoice {
  message: {
    role: "assistant";
    content: string | null;
    tool_calls?: OpenRouterToolCall[];
  };
  finish_reason: string;
}

interface OpenRouterResponse {
  id: string;
  choices: OpenRouterChoice[];
  model: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

function extractToolCallResult(
  response: OpenRouterResponse,
  toolName: string
): unknown {
  const choice = response.choices[0];
  if (!choice) {
    throw new Error("No choices in response");
  }

  const toolCalls = choice.message.tool_calls;
  if (!toolCalls || toolCalls.length === 0) {
    throw new Error(`No tool_calls in response for tool "${toolName}"`);
  }

  const call = toolCalls.find((tc) => tc.function.name === toolName);
  if (!call) {
    throw new Error(`No tool_call found for tool "${toolName}"`);
  }

  return JSON.parse(call.function.arguments);
}

export class OpenRouterProvider implements LLMProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async processContent(
    content: ExtractedContent,
    vaultContext: VaultContext
  ): Promise<ProcessedNote> {
    const summarized = await this.summarize(content);

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

  private async callApi(
    model: string,
    messages: OpenRouterMessage[],
    tools: Array<typeof SUMMARIZE_FUNCTION | typeof CATEGORIZE_FUNCTION>,
    toolChoice: { type: "function"; function: { name: string } }
  ): Promise<OpenRouterResponse> {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/nicholasgriffintn/2vault",
        "X-Title": "2Vault",
      },
      body: JSON.stringify({
        model,
        messages,
        tools,
        tool_choice: toolChoice,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `OpenRouter API returned ${response.status}: ${body}`
      );
    }

    return (await response.json()) as OpenRouterResponse;
  }

  private async summarize(
    content: ExtractedContent
  ): Promise<SummarizationResult> {
    let response: OpenRouterResponse;
    try {
      response = await this.callApi(
        SUMMARIZATION_MODEL,
        [{ role: "user", content: buildSummarizationPrompt(content) }],
        [SUMMARIZE_FUNCTION],
        { type: "function", function: { name: "summarize_content" } }
      );
    } catch (err) {
      throw new LLMProcessingError(
        `Summarization API call failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        "summarization",
        err instanceof Error ? err : undefined
      );
    }

    try {
      const input = extractToolCallResult(response, "summarize_content");
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
  ): Promise<ReturnType<typeof validateCategorizationResult>> {
    let response: OpenRouterResponse;
    try {
      response = await this.callApi(
        CATEGORIZATION_MODEL,
        [
          {
            role: "user",
            content: buildCategorizationPrompt(
              summarized,
              content,
              vaultContext
            ),
          },
        ],
        [CATEGORIZE_FUNCTION],
        { type: "function", function: { name: "categorize_content" } }
      );
    } catch (err) {
      throw new LLMProcessingError(
        `Categorization API call failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        "categorization",
        err instanceof Error ? err : undefined
      );
    }

    try {
      const input = extractToolCallResult(response, "categorize_content");
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
