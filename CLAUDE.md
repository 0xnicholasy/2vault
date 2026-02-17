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

## Planning Documents

Detailed specs are in `docs/` (single source of truth - no other spec directories):
- `docs/PRODUCT.md` - user stories, MVP scope, pricing, competitive landscape, strategic decisions
- `docs/ARCHITECTURE.md` - system design, data flow, extension structure, error handling
- `docs/IMPLEMENTATION.md` - sprint breakdown with progress tracking (follow this for build order)
- `docs/BRANDING.md` - naming, build-in-public plan, launch strategy

Each doc file has a `<!-- Claude Code Tooling -->` comment at the top listing which agents and skills to use for work described in that file.

**Start with `docs/IMPLEMENTATION.md`** - it has the sprint order, progress legend, checkboxes, and per-sprint agent/skill mapping. Progress is visible at a glance using the legend: `[x]` (done), `[>]` (in-progress), `[ ]` (todo), `[~]` (deferred).

**IMPORTANT -- Progress Sync Rule:** After completing any sprint, ALWAYS update ALL of these files to reflect the new status:
1. The sprint's implementation doc (`docs/IMPLEMENTATION.md` or `docs/GTM-IMPLEMENTATION.md`) -- mark checkboxes and sprint header
2. The **Current Progress** section in this file (`CLAUDE.md`) -- update status line and phase boundary
3. `tasks/todo.md` if it has related items

These files must stay in sync. Stale progress markers cause confusion across sessions.

### GTM & Onboarding Documents

Go-to-market strategy, landing page, and first-run onboarding flow docs:

| Document | Purpose | When to Use |
|----------|---------|-------------|
| `docs/GTM-IMPLEMENTATION.md` | **Sprint-based implementation plan** (same format as IMPLEMENTATION.md) | **Start here for GTM build work** - sprint order, checkboxes, dependencies |
| `docs/GTM-STRATEGY-SUMMARY.md` | High-level GTM decisions, messaging, metrics | Product strategy, positioning, success metrics |
| `docs/LANDING-PAGE-COPY.md` | Ready-to-use copy (headlines, CTAs, FAQ, A/B variants) | Writing landing page content, Chrome Web Store listing |
| `docs/LANDING-ONBOARDING-FLOW-DIAGRAMS.md` | ASCII mockups, user journey swimlanes, state flows | UI design reference for onboarding wizard and landing page layout |
| `docs/REFERENCE-EXAMPLES.md` | Analysis of Raycast, Linear, Notion, Stripe onboarding | Design inspiration, competitive patterns |
| `docs/GTM-LANDING-ONBOARDING.md` | Full landing page + onboarding strategy spec | Deep reference for implementation details |
| `docs/README-GTM.md` | Navigation guide for all GTM docs | Overview of all GTM documents |

**Resolved decisions:** New tab onboarding (`chrome-extension://id/onboarding.html`), Vite + React SPA landing page, 3-step onboarding (Obsidian, OpenRouter, Done), `2vault.dev` domain, no analytics at launch. See `docs/GTM-IMPLEMENTATION.md` for full details.

## Current Progress

Progress is tracked in `docs/IMPLEMENTATION.md` using this legend:
- `[x]` = DONE (committed code exists)
- `[>]` = IN-PROGRESS (actively being worked on)
- `[ ]` = TODO (not started yet)
- `[~]` = DEFERRED (intentionally skipped or deferred)

**Status:**
- **Phase 1 (Core Module):** Sprints 1.1-1.4 [x] DONE. API frozen.
- **Phase 2 (Extension):** Sprints 2.1-2.4 [x] DONE.
- **Phase 2.5 (Core Intelligence):** [x] DONE. Duplicate detection, PARA organization, tag groups, tag consistency, graph linkage.
- **Phase 2.6 (UX Polish):** [x] DONE. Better error UI, direct URL input, API key validation, vault URL dropdown.
- **Phase 2.7 (UIUX Fixes):** [x] DONE. Parallel processing, status labels, progress bug, URL normalization.
- **Phase 2.8 (Thread & Forum Extraction):** [x] DONE. X thread extraction (author vs replies), Reddit content script, pipeline thread context.
- **Phase 3 (GTM):** [>] IN-PROGRESS. Sprint 3.2 onboarding wizard DONE. Sprints 3.3-3.5 TODO. See `docs/GTM-IMPLEMENTATION.md`.
- **Phase 4 (Managed Tier):** [~] DEFERRED (only after Phase 3 live with 100+ installs).

## Phase Boundaries

### Phase 1 (Week 1): Core Module - Sprints 1.1-1.3 DONE

Build and test `src/core/` only. No extension code yet. Validate with standalone test scripts against real URLs and real Obsidian vault.

**Done when:** 20+ URLs processed, >80% categorized correctly, notes appear in Obsidian.

### Phase 2 (Week 2-3): Extension - Sprints 2.1-2.4 DONE

Wire core module into Chrome extension. Build popup UI, content scripts, service worker.

**Done when:** Extension installed from `dist/`, bookmark folder batch processing works, X/LinkedIn capture works, settings page functional.

### Phase 2.5-2.7: Intelligence + Polish + UIUX - DONE

Sprint 2.5: Duplicate detection, PARA organization, tag groups, tag consistency, graph linkage via hub notes.
Sprint 2.6: Better error UI, direct URL input, API key validation, vault URL dropdown.
Sprint 2.7: Parallel processing, status labels, progress bug, URL normalization.

**Done when:** PARA organization works, duplicates are skipped, tag hub notes appear in graph view, URLs can be pasted directly.

### Phase 2.8: Thread & Forum Extraction - DONE

Sprint 2.8: X/Twitter thread extraction (author vs replies, top replies), Reddit content script, pipeline thread context.

**Done when:** X threads capture author's thread + top replies with metadata. Reddit posts extract title + body + top 5 comments. LLM prompts handle conversation context. Tests pass.

### Phase 3: GTM - Onboarding + Landing Page + Launch - IN PROGRESS

5 sprints tracked in `docs/GTM-IMPLEMENTATION.md`:
- Sprint 3.1: Planning & Decisions (resolve 5 open decisions)
- Sprint 3.2: In-Extension Onboarding [x] DONE (3-step wizard: Obsidian, OpenRouter, Completion)
- Sprint 3.3: Landing Page (single-page marketing site)
- Sprint 3.4: Chrome Web Store Submission
- Sprint 3.5: Launch (social media, monitoring, iteration)

**Done when:** Extension on Chrome Web Store, landing page live, >100 installs in week 1.

### Phase 4 (Future): Managed Tier

Serverless proxy, Stripe, additional LLM providers, Facebook/Instagram.

**Only start after:** Phase 3 live with 100+ Chrome Web Store installs.

## Agent & Skill Guide

When working on this project, use these specialized tools. Each `docs/*.md` file also has tooling annotations in HTML comments at the top.

### Skills (invoke via `/skill-name` or Skill tool)

| Skill | When to Use |
|-------|-------------|
| `browser-extension-builder` | Manifest V3 patterns, content scripts, service worker, CRXJS setup |
| `typescript-expert` | Type design issues, async patterns, strict mode problems |
| `javascript-testing-patterns` | Unit test strategy, Vitest patterns, mocking |
| `frontend-design` | Popup UI components, settings page, dark mode styling |
| `webapp-testing` | Interactive UI testing with Playwright |
| `e2e-testing-patterns` | Full extension E2E test suites |
| `product-manager-toolkit` | Feature prioritization, Chrome Web Store listing, GTM |
| `git-commit` | Conventional commits |
| `clarification` | When requirements are ambiguous - ask before deciding |
| `pr-review-toolkit:review-pr` | Comprehensive PR review before merging |
| `claude-md-management:revise-claude-md` | Update this file with session learnings |
| `sprint-execute` | Full sprint implementation loop: plan, build, verify, fix, commit, update progress |
| `interactive-portfolio` | Landing page design patterns, conversion optimization |

### Agents (invoke via Task tool)

| Agent | When to Use |
|-------|-------------|
| `sprint-architect` | Break features into sprint tasks, analyze integration points |
| `bug-detective` | Vulnerability analysis, edge case detection |
| `pr-review-toolkit:code-reviewer` | After writing code - style and pattern check |
| `pr-review-toolkit:silent-failure-hunter` | After error handling code - find swallowed errors |
| `pr-review-toolkit:type-design-analyzer` | After adding new types/interfaces |
| `pr-review-toolkit:pr-test-analyzer` | After writing tests - coverage gap analysis |
| `cofounder` | Product strategy decisions, roadmap pivots |
| `product-manager` | GTM strategy, onboarding UX, landing page content, launch planning |
| `ui-designer` | Onboarding wizard UI, landing page visual design |
| `frontend-developer` | Landing page implementation, onboarding tab UI |


<claude-mem-context>
# Recent Activity

<!-- This section is auto-generated by claude-mem. Edit content outside the tags. -->

*No recent activity*
</claude-mem-context>