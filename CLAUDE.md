# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

**2Vault** is a Chrome browser extension (Manifest V3) that reads, digests, and categorizes web bookmarks into an Obsidian vault using AI. It solves the universal problem of bookmarking content but never reading it.

**Stack:** TypeScript, React, Vite, Chrome Extension APIs, OpenRouter API, Readability + Turndown, Obsidian Local REST API
**License:** AGPL-3.0

## Development Commands

```bash
# Development
bun dev              # Start Vite dev server (extension hot reload via CRXJS)

# Type Checking & Building
bun run typecheck    # TypeScript type-check only (fast verification)
bun run build        # Production build -> dist/ (load as unpacked extension)

# Testing
bun run test         # Run Vitest tests (NOT `bun test` which uses bun's built-in runner)
bun run test:watch   # Watch mode

# Validation (requires .env with API keys + Obsidian running)
bun run validate     # Process URLs from scripts/urls.txt through full pipeline
```

**Verification workflow:** Use `bun run typecheck` after changes. Load `dist/` as unpacked extension in `chrome://extensions` for manual testing.

## Architecture

The project has two layers:

### Core Processing Module (`src/core/`)

Platform-independent logic. No Chrome APIs. Can be tested standalone. Supports PARA organization system and user-defined tag groups for vault-aware categorization.

```
src/core/
├── types.ts           # All shared TypeScript interfaces (incl. TagGroup, VaultOrganization)
├── extractor.ts       # HTML -> clean markdown (Readability + Turndown)
├── vault-client.ts    # Obsidian Local REST API HTTP client (incl. search, append)
├── vault-analyzer.ts  # Reads vault structure, builds LLM context (PARA-aware)
├── llm-shared.ts      # Shared LLM prompt building and validation logic (tag group injection)
├── openrouter-provider.ts  # OpenRouter LLM provider (default)
├── note-formatter.ts  # ProcessedNote -> markdown string + YAML frontmatter + wiki-links
└── orchestrator.ts    # Main pipeline: URLs -> dedupe -> extract -> analyze -> process -> create -> hub notes
```

### Extension Layer (`src/popup/`, `src/background/`, `src/content-scripts/`, `src/onboarding/`)

Chrome-specific code that wraps the core module.

```
src/popup/             # React popup UI (bookmark browser, settings, status)
src/background/        # Service worker (orchestration, keyboard shortcut handler)
src/content-scripts/   # DOM extractors for X/Twitter, LinkedIn, Reddit
src/onboarding/        # First-run onboarding wizard (full-page new tab)
src/utils/             # chrome.storage wrapper, config management
```

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Vault communication | Obsidian Local REST API plugin | Mature (~200K+ downloads), clean HTTP API, stable |
| Content extraction (articles) | Readability + Turndown | Runs in-extension, no external API dependency, free |
| Content extraction (social media) | DOM content scripts | Free, no API costs ($100/mo for X API), captures rendered content |
| LLM provider | OpenRouter (abstracted interface) | Single API key for all models, BYOK client-side |
| Batch bookmark processing | `chrome.bookmarks` API | Native, fast, user selects folders |
| Extension bundler | Vite + CRXJS | HMR for extension dev, React support |

## Core Types

See `src/core/types.ts` for full definitions. Key interfaces:

- **`ExtractedContent`**: Output of content extraction (URL, title, markdown content, author, platform)
- **`VaultContext`**: Vault folder structure + tag taxonomy + tag groups + organization mode for categorization
- **`ProcessedNote`**: LLM output (summary, key takeaways, suggested folder, suggested tags)
- **`LLMProvider`**: Abstracted provider interface (`processContent(content, vaultContext) -> ProcessedNote`)
- **`Config`**: Extension settings (API key, vault URL, default folder, LLM provider, vault organization, tag groups)
- **`TagGroup`**: User-defined tag group (`{ name: string; tags: string[] }`)
- **`VaultOrganization`**: `"para" | "custom"` -- vault folder organization mode

## Processing Pipeline

```
URLs -> [Duplicate Check] -> [Extract Content] -> [Analyze Vault] -> [LLM Process] -> [Format Note] -> [Create in Vault] -> [Hub Notes]
```

1. **Dedupe**: Search vault for existing notes with same source URL. Skip duplicates.
2. **Extract**: Readability + Turndown for articles. DOM content scripts for X/LinkedIn.
3. **Analyze**: Read vault folders + tags + user tag groups via REST API. PARA-aware context. Cache 1 hour.
4. **Process**: LLM summarizes content + picks best-fit folder and tags (using tag groups + PARA rules).
5. **Format**: Markdown with YAML frontmatter (source, author, dates, tags, type, status) + wiki-links.
6. **Create**: POST to Obsidian vault via Local REST API.
7. **Hub Notes**: Create/append tag hub notes with `[[note]]` wiki-links for graph connectivity.

## Content Extraction Patterns

### Articles (Default)

```typescript
// Pipeline: fetch HTML -> Readability extracts main content -> Turndown converts to markdown
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
```

### X/Twitter (Content Script)

```typescript
// DOM selectors (may change - version these):
// Post text: article[data-testid="tweet"]
// Author: [data-testid="User-Name"]
// Date: time[datetime]
```

### LinkedIn (Content Script)

```typescript
// DOM selectors (may change - version these):
// Post text: .feed-shared-update-v2__description
// Author: .feed-shared-actor__name
// Date: time element or .feed-shared-actor__sub-description
```

**Important:** Social media DOM selectors are fragile. Always wrap in try/catch with fallback to raw text extraction. Version selectors so breakage is easy to identify and fix.

## Vault Integration

### Obsidian Local REST API

**Default endpoint:** `https://localhost:27124`
**Auth:** API key from plugin settings, stored in `chrome.storage.sync`

Key endpoints:
- `GET /vault/` - list files/folders
- `POST /vault/{path}` - create note (also PARA folder creation)
- `GET /vault/{path}` - read note
- `PATCH /vault/{path}` - append to note (used for hub note updates)
- `POST /search/simple/` - search vault for duplicate source URLs

### Note Templates

Two templates in `note-formatter.ts`:

1. **Article template**: YAML frontmatter (source, author, dates, tags, type: article, status: unread) + Summary + Key Takeaways + Source link
2. **Social media template**: Same frontmatter + platform field + Summary + Key Points + quoted Original Content + Source link

## LLM Client

### Abstracted Provider Interface

```typescript
interface LLMProvider {
  processContent(content: ExtractedContent, vaultContext: VaultContext): Promise<ProcessedNote>;
}
```

### BYOK Mode (Free Tier)

Extension calls OpenRouter API directly from browser. API key in `chrome.storage.sync`.

```
Extension -> HTTPS -> openrouter.ai/api
```

### Managed Mode (Paid Tier - Future)

Extension calls serverless proxy. Proxy holds API key.

```
Extension -> HTTPS -> 2vault-proxy.vercel.app -> openrouter.ai/api
```

### Model Strategy

- **Default model:** Google Gemini 2.0 Flash via OpenRouter (cheap, fast, sufficient quality)
- Single model handles both summarization and categorization
- Use function calling (OpenAI-compatible tool format) for structured JSON output
- OpenRouter enables easy model switching without code changes

## Code Style Guidelines

1. **TypeScript strict mode** - no `any` or `unknown` without justification
2. **Never use `// eslint-disable`** comments
3. **Use `react-icons`** for all icons in popup UI - never inline SVG
4. **No emoji text in code** - avoid emoji rendering issues on Linux
5. **Use `bun`** not npm for all package management
6. **Path alias `@/`** maps to `./src/` - use for all imports
7. **Functional components with hooks** for all React components
8. **Error boundaries** around extension popup components (extension context can be invalidated)

## Extension-Specific Guidelines

### Manifest V3 Constraints

- Service workers are ephemeral (no persistent state in `service-worker.ts`)
- Use `chrome.storage` for all persistent data
- Content scripts run in isolated worlds - communicate via `chrome.runtime.sendMessage`
- `host_permissions` required for cross-origin fetch from service worker

### Chrome Storage Schema

```typescript
// chrome.storage.sync (synced across devices, 100KB limit)
{
  apiKey: string;              // Encrypted LLM API key
  llmProvider: 'openrouter';
  vaultUrl: string;            // Default: https://localhost:27124
  vaultApiKey: string;         // Obsidian REST API key
  defaultFolder: string;       // Fallback folder for uncategorized notes
  keyboardShortcut: string;    // Display only (actual shortcut in manifest)
  vaultOrganization: 'para' | 'custom';  // Vault organization mode (default: 'para')
  tagGroups: TagGroup[];       // User-defined tag groups for consistent categorization
  onboardingComplete: boolean; // First-run onboarding completed flag
  onboardingStep: number;      // Current onboarding step (for resume on close)
}

// chrome.storage.local (device-local, 10MB limit)
{
  vaultContextCache: VaultContext;  // Cached vault structure
  vaultContextTimestamp: number;    // Cache invalidation (1 hour)
  processingHistory: ProcessingResult[];  // Last 100 results
}
```

### Content Script Communication

```typescript
// Content script -> Service worker:
chrome.runtime.sendMessage({ type: 'EXTRACTED_CONTENT', data: extractedContent });

// Service worker -> Content script:
chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_CONTENT' });
```

## Testing

### Unit Tests (Vitest)

Test `src/core/` modules with mocked dependencies:
- `extractor.test.ts` - HTML fixtures -> expected markdown
- `processor.test.ts` - mock LLM responses -> expected ProcessedNote
- `note-formatter.test.ts` - ProcessedNote -> expected markdown string
- `vault-client.test.ts` - mock HTTP responses

### Test Fixtures

```
tests/fixtures/
├── html/          # Sample HTML for extraction tests
├── expected/      # Expected markdown output
└── vault/         # Mock vault folder structure
```

### Manual Testing

1. Load unpacked extension from `dist/`
2. Open Obsidian with Local REST API plugin enabled
3. Configure API keys in extension settings
4. Test: bookmark folder processing, keyboard shortcut, X post capture, LinkedIn post capture

## Planning & Progress

Planning docs, progress tracking, agents, and skills are now in the **parent `2vault/` workspace**. See `../../CLAUDE.md` for:
- All planning documents (`docs/`)
- Current progress across all sprints
- Agent & skill guide
- Progress sync rules
