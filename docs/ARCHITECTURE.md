# Architecture

<!-- Claude Code Tooling:
  - browser-extension-builder (skill): Manifest V3 patterns, content scripts, service worker architecture
  - typescript-expert (skill): Type design, async patterns, strict mode issues
  - sprint-architect (agent): Breaking architectural changes into sprint tasks
  - pr-review-toolkit:type-design-analyzer (agent): Review new types/interfaces
  - pr-review-toolkit:silent-failure-hunter (agent): Review error handling strategy
  - bug-detective (agent): Vulnerability analysis across extension + core modules
-->

## System Overview

```
Browser Extension (Chrome Manifest V3)
├── Popup UI
│   ├── Bookmark folder browser (chrome.bookmarks API)
│   ├── Direct URL input (paste URLs without bookmarking)
│   ├── Processing status/progress
│   ├── Tag group management (user-defined tag groups)
│   ├── PARA / Custom organization selector
│   └── Settings (API key, vault config, shortcuts)
│
├── Background Service Worker
│   ├── Orchestrator (batch processing pipeline)
│   ├── LLM Client (abstracted provider: Claude, OpenAI, etc.)
│   │   ├── BYOK mode: direct API call from extension
│   │   └── Managed mode: call via serverless proxy
│   └── Vault Client (Obsidian Local REST API)
│
├── Content Scripts
│   ├── Article extractor (Readability + Turndown)
│   ├── X/Twitter DOM extractor
│   └── LinkedIn DOM extractor
│
└── Storage (chrome.storage.sync)
    ├── API key (encrypted per profile)
    ├── Vault connection settings
    └── Processing history/queue
```

## Processing Pipeline

```
User selects bookmark folder, current page via shortcut, or pastes URLs directly
        |
        v
[1. URL Collection]
  - chrome.bookmarks API reads folder contents
  - Or: capture current tab URL
  - Or: parse pasted URLs from direct input
  - Output: URL[]
        |
        v
[1.5. Duplicate Check] (per URL)
  - Search vault for existing notes with same source URL via POST /search/simple/
  - Parse frontmatter source: field from search results to confirm match
  - Skip URL if duplicate found, record as "skipped" in results
  - Output: filtered URL[] (non-duplicates only) + skipped count
        |
        v
[2. Content Extraction] (per URL, via content scripts)
  - Article: inject Readability + Turndown -> clean markdown
  - X/Twitter: content script extracts post text, author, date from DOM
  - LinkedIn: content script extracts post text, author, date from DOM
  - Fallback: raw fetch + Readability (for already-closed tabs)
  - Output: ExtractedContent[]
        |
        v
[3. Vault Analysis] (once per batch, cached)
  - GET vault folder structure via Obsidian Local REST API
  - GET existing tags from vault
  - Build vault context for LLM categorization (PARA-aware if PARA mode)
  - Include user-defined tag groups in vault context
  - Cache for 1 hour (invalidate on manual refresh)
  - Output: VaultContext (with tagGroups and organization mode)
        |
        v
[4. AI Processing] (per URL)
  - LLM: summarize content + extract metadata
  - LLM: match to vault folder + tags (using vault context + tag groups + PARA rules)
  - PARA mode: LLM picks bucket + topic subfolder (e.g., Resources/AI/)
  - Output: ProcessedNote[]
        |
        v
[5. Note Creation] (per note)
  - Format as markdown (note template + YAML frontmatter + wiki-links)
  - POST to Obsidian vault via Local REST API
  - Output: creation status per URL
        |
        v
[5.5. Hub Note Management] (per tag used)
  - Check if tag hub note exists (e.g., Tags/typescript.md)
  - If exists: PATCH to append [[new-note]] wiki-link
  - If not: POST to create hub note with initial link
  - Non-critical: failures logged but don't affect main note
        |
        v
[6. Results Summary]
  - Show in popup: URL -> folder -> status table
  - Show skipped duplicates count
  - Categorize errors with actionable suggestions
  - Log failures with reasons
```

## Extension Architecture Detail

### Manifest V3 Structure

```
2vault-extension/
├── manifest.json
├── src/
│   ├── popup/                    # Extension popup UI
│   │   ├── popup.html
│   │   ├── popup.tsx             # React popup app
│   │   ├── components/
│   │   │   ├── BookmarkBrowser.tsx
│   │   │   ├── ProcessingStatus.tsx
│   │   │   ├── Settings.tsx
│   │   │   ├── ResultsSummary.tsx
│   │   │   └── TagGroupEditor.tsx
│   │   └── styles/
│   ├── background/               # Service worker
│   │   ├── service-worker.ts
│   │   ├── orchestrator.ts       # Main pipeline
│   │   ├── llm-client.ts         # Abstracted LLM provider
│   │   └── vault-client.ts       # Obsidian REST API client
│   ├── content-scripts/          # DOM extractors
│   │   ├── article-extractor.ts  # Readability + Turndown
│   │   ├── twitter-extractor.ts  # X/Twitter DOM parser
│   │   └── linkedin-extractor.ts # LinkedIn DOM parser
│   ├── core/                     # Shared processing logic
│   │   ├── processor.ts          # LLM summarization + categorization
│   │   ├── note-formatter.ts     # Markdown + YAML formatting
│   │   ├── vault-analyzer.ts     # Vault structure analysis
│   │   └── types.ts              # Shared TypeScript types
│   └── utils/
│       ├── config.ts             # Settings management
│       └── storage.ts            # chrome.storage wrapper
├── tests/
├── package.json
├── tsconfig.json
├── vite.config.ts                # Vite for extension bundling
└── README.md
```

### Key Permissions (manifest.json)

```json
{
  "manifest_version": 3,
  "name": "2Vault",
  "permissions": [
    "bookmarks",          // Read bookmark folders
    "activeTab",          // Capture current tab content
    "storage",            // Store API key + settings
    "scripting"           // Inject content scripts
  ],
  "host_permissions": [
    "https://x.com/*",
    "https://twitter.com/*",
    "https://www.linkedin.com/*",
    "http://localhost:*",         // Obsidian Local REST API
    "https://openrouter.ai/*"     // BYOK direct calls via OpenRouter
  ],
  "commands": {
    "capture-current-page": {
      "suggested_key": { "default": "Ctrl+Shift+V" },
      "description": "Capture current page to 2Vault"
    }
  }
}
```

## Content Extraction Detail

### Article Extraction (Default)

Uses Readability + Turndown running inside the extension (or injected via content script):

```typescript
interface ExtractedContent {
  url: string;
  title: string;
  content: string;         // Clean markdown via Turndown
  author: string | null;
  datePublished: string | null;
  wordCount: number;
  type: 'article' | 'social-media';
  platform: 'web' | 'x' | 'linkedin';
  status: 'success' | 'failed';
  error?: string;
}
```

**Pipeline:** Fetch HTML -> Readability extracts main content -> Turndown converts to markdown -> Return ExtractedContent

### X/Twitter DOM Extractor

Content script injected into `x.com` / `twitter.com` pages:

```typescript
// Targets:
// - Single tweet: article[data-testid="tweet"] text content
// - Thread: all tweets in conversation
// - Author: [data-testid="User-Name"]
// - Date: time[datetime] attribute
// - Media: images alt text, video placeholder

// Returns: ExtractedContent with type='social-media', platform='x'
```

**Why DOM over API:** X API basic tier is $100/mo. DOM extraction is free, reliable for public posts, and captures the actual rendered content including quote tweets and thread context.

**Limitation:** Only works for pages the user has open or navigates to. Cannot fetch arbitrary tweet URLs without opening them. For batch processing of bookmarked tweet URLs, the extension will need to open tabs briefly to extract content (or use a fallback like Jina Reader best-effort).

### LinkedIn DOM Extractor

Content script injected into `linkedin.com` pages:

```typescript
// Targets:
// - Post text: .feed-shared-update-v2__description
// - Author: .feed-shared-actor__name
// - Date: .feed-shared-actor__sub-description
// - Reactions/comments count (metadata)

// Returns: ExtractedContent with type='social-media', platform='linkedin'
```

**Limitation:** LinkedIn requires login. Content scripts only work when the user is logged in and viewing the page. Same tab-opening approach for batch processing.

## Vault Integration

### Obsidian Local REST API

**Prerequisite:** User installs the "Local REST API" community plugin in Obsidian.

**Default endpoint:** `https://localhost:27124` (configurable in extension settings)

**Key endpoints used:**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/vault/` | List all files/folders in vault |
| `GET` | `/vault/{path}` | Read a specific note |
| `POST` | `/vault/{path}` | Create a new note (also used for PARA folder creation) |
| `PATCH` | `/vault/{path}` | Append to existing note (used for hub note updates) |
| `POST` | `/search/simple/` | Search vault for duplicate source URLs |

**Authentication:** API key generated by the plugin, stored in extension settings.

### Vault Context for Categorization

```typescript
interface VaultContext {
  folders: string[];              // Top 2 levels: ["Resources/AI/", "Resources/Web Dev/", "Projects/", ...]
  tags: string[];                 // Existing tags: ["#typescript", "#ai", "#architecture", ...]
  recentNotes: NotePreview[];     // 5-10 recent notes per folder (for folder purpose inference)
  tagGroups: TagGroup[];          // User-defined tag groups from Settings
  organization: "para" | "custom"; // Vault organization mode
}

interface NotePreview {
  folder: string;
  title: string;
  tags: string[];
}

interface TagGroup {
  name: string;                   // Group label (e.g., "Programming Languages")
  tags: string[];                 // Tags in this group (e.g., ["typescript", "python", "rust"])
}
```

**Optimization for large vaults:**
- Limit folder list to top 2 levels, max 50 folders
- Sample 5-10 notes per folder for context (not entire vault)
- Limit tag list to top 100 most-used
- Cache vault context for 1 hour
- Total vault context target: <2000 tokens

## LLM Client Architecture

### Abstracted Provider Interface

```typescript
interface LLMProvider {
  processContent(content: ExtractedContent, vaultContext: VaultContext): Promise<ProcessedNote>;
}

// Current implementation:
class OpenRouterProvider implements LLMProvider { ... }  // OpenRouter (multi-model gateway)
// Future: additional providers can implement LLMProvider interface
```

### BYOK Mode (Free Tier)

```
Extension -> Direct HTTPS -> openrouter.ai/api
```

- OpenRouter API key stored in `chrome.storage.sync` (encrypted per Chrome profile)
- All processing happens client-side
- Zero backend infrastructure needed
- User sees their own API usage/costs
- One API key accesses all models (Gemini, Claude, GPT, etc.)

### Managed Mode (Paid Tier)

```
Extension -> HTTPS -> 2vault-proxy.vercel.app -> openrouter.ai/api
```

- Serverless proxy on Vercel (Edge Functions)
- Proxy holds the API key (user never sees it)
- Authentication via session token / subscription check
- Payment via Stripe
- Proxy adds rate limiting, usage tracking

### Model Selection

| Use Case | Default Model | Cost/Article |
|----------|--------------|-------------|
| Summarization + Categorization | Google Gemini 2.0 Flash | ~$0.001-0.003 |

Default: Single Gemini 2.0 Flash model for both stages via OpenRouter. Users can switch models via OpenRouter dashboard without code changes.

## Error Handling

| Scenario | Handling |
|----------|----------|
| URL fetch fails (404, timeout, paywall) | Log warning, skip, continue batch. Show in results. |
| Social media DOM not found (page structure changed) | Fallback to raw text extraction. Log warning. |
| LLM returns non-existent folder | Use user's configured default folder |
| Obsidian REST API not reachable | Alert user: "Is Obsidian open with Local REST API enabled?" |
| REST API auth fails | Alert user: "Check your API key in 2Vault settings" |
| Duplicate filename in target folder | Append `-2`, `-3`, etc. |
| Content too long for context window | Truncate to first 4000 tokens before summarizing |
| Rate limit from LLM provider | Exponential backoff, max 3 retries |
| Extension storage quota exceeded | Clear processing history older than 30 days |
| Duplicate URL found in vault | Skip URL, record as "skipped" in results. Show count in summary. |
| Hub note creation/append fails | Non-critical: log warning and continue. Main note already created. |
| PARA folder creation fails | Log error, fall back to default folder. Alert user in results. |

## Security Considerations

- API keys stored in `chrome.storage.sync` (per-profile encryption by Chrome)
- No telemetry or data collection in free/BYOK tier
- Managed tier: content is processed ephemerally (no storage on proxy)
- AGPL-3.0 license: users can audit the code
- Content scripts have minimal permissions (read-only DOM access)
- Obsidian REST API runs on localhost only (no external exposure)
