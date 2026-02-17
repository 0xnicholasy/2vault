# Implementation Plan

## Progress Tracking Legend

| Symbol | State | Meaning |
|--------|-------|---------|
| `[x]` | DONE | Completed and committed to main branch |
| `[>]` | IN-PROGRESS | Actively being worked on |
| `[ ]` | TODO | Not started yet |
| `[~]` | DEFERRED | Intentionally skipped or deferred |

---

<!-- Claude Code Tooling (per sprint):

  Phase 1 (Core Module) - COMPLETED: Sprints 1.1-1.3
  Sprint 1.4 Validation:
    - bug-detective (agent): Find edge cases in extraction/categorization
    - pr-review-toolkit:silent-failure-hunter (agent): Review error handling
    - pr-review-toolkit:type-design-analyzer (agent): Review types.ts design
    - pr-review-toolkit:pr-test-analyzer (agent): Test coverage gaps
    - javascript-testing-patterns (skill): Unit test strategy
    - typescript-expert (skill): Type-level issues

  Phase 2 (Chrome Extension):
  Sprint 2.1 Extension Scaffold:
    - browser-extension-builder (skill): Manifest V3, CRXJS, service worker
    - sprint-architect (agent): Break down scaffold into tasks
    - frontend-design (skill): Settings UI
  Sprint 2.2 Bookmark Browser + Batch:
    - browser-extension-builder (skill): chrome.bookmarks API patterns
    - frontend-design (skill): Tree view, processing modal
    - webapp-testing (skill): Interactive UI testing with Playwright
  Sprint 2.3 Content Scripts (X/LinkedIn):
    - browser-extension-builder (skill): Content script injection, messaging
    - bug-detective (agent): DOM selector fragility, edge cases
  Sprint 2.4 Polish + Store Prep:
    - frontend-design (skill): Processing status, results summary UI
    - e2e-testing-patterns (skill): Full extension E2E tests
    - product-manager-toolkit (skill): Chrome Web Store listing, screenshots
    - pr-review-toolkit:review-pr (skill): Final review before release
  Sprint 2.5 Core Intelligence:
    - backend-developer (agent): VaultClient methods, orchestrator logic, LLM prompt engineering
    - typescript-pro (agent): Type definitions (TagGroup, VaultOrganization, ProcessingResult extension)
    - expert-react-frontend-engineer (agent): Settings UI (PARA selector, TagGroupEditor)
    - cofounder (agent): PARA strategy validation, product direction
    - product-manager (agent): Tag group strategy, user story refinement
    - project-manager (agent): Risk assessment, dependency ordering
  Sprint 2.6 UX Polish:
    - expert-react-frontend-engineer (agent): ResultsSummary, BookmarkBrowser, Settings UI
    - typescript-pro (agent): Validation logic types
    - product-manager (agent): UX review of failed results UI

  Cross-cutting (use throughout):
    - pr-review-toolkit:code-reviewer (agent): After writing code
    - pr-review-toolkit:silent-failure-hunter (agent): After error handling code
    - git-commit (skill): Conventional commits
    - sprint-execute (skill): Full sprint loop - plan, build, verify, fix, commit, update
    - claude-md-management:revise-claude-md (skill): Update CLAUDE.md with learnings
    - clarification (skill): When requirements are ambiguous
-->

Coding-level TODOs organized into phases and sprints.

- **Phase 1:** Core processing module + Claude Code skill validation (1 week)
- **Phase 2:** Chrome browser extension (2 weeks)
- **Phase 3:** Managed tier + growth features (future)

---

## Phase 1: Core Processing Module (Week 1)

Build and validate the AI pipeline independently before wrapping it in an extension. Test via Claude Code skill with article URLs.

### Sprint 1.1: Content Extraction Module (Day 1-2) [DONE]

**Goal:** Reliably extract clean markdown from web URLs.

#### 1.1.1 Extraction library setup

**Location:** Standalone module (will be imported into extension later)

- [x] Set up TypeScript project with Vite (library mode)
- [x] Install dependencies:
  - `@mozilla/readability` - content extraction from HTML
  - `turndown` - HTML to markdown conversion
  - `linkedom` - lightweight DOM implementation for Node.js
- [x] Implement `extractArticle(html: string): ExtractedContent`
  - Readability parses HTML -> extracts main content
  - Turndown converts to clean markdown
  - Extract metadata: title, author, datePublished
  - Return `ExtractedContent` type

#### 1.1.2 URL fetcher

- [x] Implement `fetchAndExtract(url: string): Promise<ExtractedContent>`
  - Fetch HTML with appropriate User-Agent header
  - Pass to `extractArticle()`
  - Handle errors: timeout (10s), 404, redirects, empty content
  - Return `{ status: 'failed', error: '...' }` on failure
- [x] Content length guard: truncate markdown to ~8000 tokens if too long

#### 1.1.3 Test with diverse URLs

- [x] Test 10+ URLs across content types:
  - Standard blog post (dev.to, Medium)
  - Technical documentation (MDN, React docs)
  - News article (TechCrunch, The Verge)
  - GitHub README
  - Short social media-style post
- [x] Document success rate and failure modes
- [x] Target: >85% of article URLs extract cleanly

### Sprint 1.2: Vault Analysis + Categorization (Day 2-3) [DONE]

**Goal:** Read Obsidian vault structure and categorize content intelligently.

#### 1.2.1 Vault client

- [x] Implement `VaultClient` class wrapping Obsidian Local REST API:
  - `listFolders(): Promise<string[]>` - top 2 levels
  - `listTags(): Promise<string[]>` - existing tag taxonomy
  - `sampleNotes(folder: string, limit: number): Promise<NotePreview[]>`
  - `createNote(path: string, content: string): Promise<void>`
- [x] Connection test: verify Obsidian + Local REST API plugin is running
- [x] Handle auth: API key from config

#### 1.2.2 Vault context builder

- [x] Implement `buildVaultContext(client: VaultClient): Promise<VaultContext>`
  - List folders (max 50, top 2 levels, exclude `.obsidian`, `.trash`)
  - Collect existing tags (max 100 most-used)
  - Sample 5-10 notes per folder for purpose inference
  - Build concise context string (<2000 tokens)
- [x] Test on personal Obsidian vault
- [x] Verify context accurately represents vault structure

#### 1.2.3 LLM processor

- [x] Implement `LLMProvider` interface:
  ```typescript
  interface LLMProvider {
    processContent(content: ExtractedContent, vaultContext: VaultContext): Promise<ProcessedNote>;
  }
  ```
- [x] Implement `OpenRouterProvider` via OpenRouter API (OpenAI-compatible):
  - Summarization prompt: title, summary (2-3 sentences), key takeaways (3-5 bullets)
  - Categorization prompt: given vault folders + tags, pick best-fit
  - Use function calling for structured JSON output
  - Model: Google Gemini 2.0 Flash (single model for both stages)
- [x] Validate categorization accuracy on 10+ articles against personal vault
- [x] Target: >80% correct folder assignment on first try

### Sprint 1.3: Note Creation + End-to-End Test (Day 3-4) [DONE]

**Goal:** Full pipeline from URL to Obsidian note.

#### 1.3.1 Note formatter

- [x] Implement `formatNote(processed: ProcessedNote): string`
  - YAML frontmatter: source, author, date_published, date_saved, tags, type, status
  - Markdown body: title, summary, key takeaways, source link
  - Sanitize special characters in YAML values
  - Generate filename: kebab-case from title, max 60 chars
- [x] Separate templates for articles vs social media posts

#### 1.3.2 Orchestrator

- [x] Implement `processUrls(urls: string[], config: Config): Promise<ProcessingResult[]>`
  - Step 1: Fetch all URLs (sequential, with rate limiting)
  - Step 2: Build vault context (once, cached)
  - Step 3: Process each via LLM
  - Step 4: Create notes in vault
  - Step 5: Return results summary
- [x] Progress callbacks for status reporting
- [x] Handle partial failures (continue batch on individual URL failure)

#### 1.3.3 Claude Code skill for testing

- [x] Create skill prompt that uses the processing module
- [x] Test full pipeline: 20+ personal bookmarks
- [x] Review created notes in Obsidian
- [x] Iterate on prompts based on real results
- [x] Document what works and what needs fixing

### Sprint 1.4: Validation + Iteration (Day 4-5) [DONE]

- [x] Process personal bookmark backlog (30-50 URLs)
- [x] Review all created notes in Obsidian
- [x] Measure metrics:
  - Extraction success rate (target: >85%)
  - Categorization accuracy (target: >80%)
  - Summary usefulness (subjective: "would I read this instead of the original?")
- [x] Fix issues found during validation
- [x] Freeze core module API (this becomes the extension's backend)

---

## Phase 2: Chrome Browser Extension (Week 2-3)

Wrap the validated core module in a Chrome Manifest V3 extension.

### Sprint 2.1: Extension Scaffold (Day 1-2) [DONE]

#### 2.1.1 Project setup

**Repo:** New repo `2vault` (separate from personal-website)

- [x] Initialize Chrome extension project:
  - Manifest V3
  - Vite + React for popup
  - TypeScript throughout
  - CRXJS or similar Vite plugin for extension dev
- [x] Configure manifest.json:
  - Permissions: `bookmarks`, `activeTab`, `storage`, `scripting`
  - Host permissions: `x.com`, `twitter.com`, `linkedin.com`, `localhost:*`, `openrouter.ai`
  - Commands: keyboard shortcut `Ctrl+Shift+V` for capture
  - Service worker: `background/service-worker.ts`
- [x] Import core processing module from Phase 1
- [x] Verify extension loads in Chrome (`chrome://extensions` dev mode)

#### 2.1.2 Settings page

- [x] Build settings UI in popup:
  - API key input (with show/hide toggle)
  - LLM provider dropdown (Claude, OpenAI -- future: more)
  - Obsidian REST API URL (default: `https://localhost:27124`)
  - Obsidian REST API key input
  - Default folder path
  - Connection test button ("Test Vault Connection")
- [x] Store settings in `chrome.storage.sync`
- [~] Onboarding flow for first-time setup (3 steps: API key -> Vault connection -> Done)

### Sprint 2.2: Bookmark Browser + Batch Processing (Day 2-4) [DONE]

#### 2.2.1 Bookmark folder UI

- [x] Build `BookmarkBrowser` component:
  - Use `chrome.bookmarks.getTree()` to list all bookmark folders
  - Tree view with expandable folders
  - Show URL count per folder
  - "Process This Folder" button per folder
  - Select/deselect individual URLs within a folder
- [x] Style with minimal, clean UI (match Obsidian aesthetic: dark mode default)

#### 2.2.2 Batch processing flow

- [x] When user clicks "Process":
  1. Collect selected URLs
  2. Show processing modal with progress bar
  3. Pass URLs to orchestrator (from core module)
  4. Display real-time status per URL (fetching... / summarizing... / created / failed)
  5. Show results summary when done
- [x] Handle cancellation (user closes popup mid-process)
- [x] Background processing via service worker (popup can close, processing continues)

#### 2.2.3 Keyboard shortcut capture

- [x] Register `Ctrl+Shift+V` command in manifest
- [x] On shortcut: capture current tab URL + page content
- [x] Process immediately (single URL, no batch UI needed)
- [x] Show browser notification on completion: "Saved to [folder] in Obsidian"

### Sprint 2.3: Social Media Content Scripts (Day 4-6) [DONE]

#### 2.3.1 X/Twitter extractor

**File:** `src/content-scripts/twitter-extractor.ts`

- [x] Content script matches: `https://x.com/*`, `https://twitter.com/*`
- [x] Extract from DOM:
  - Post text: `article[data-testid="tweet"]` inner text
  - Author name + handle: `[data-testid="User-Name"]`
  - Timestamp: `time[datetime]` attribute
  - Thread detection: check for multiple tweets in conversation
  - Quote tweets: nested tweet content
  - Media: image alt text, video placeholder text
- [x] Return `ExtractedContent` with `type: 'social-media'`, `platform: 'x'`
- [x] Handle edge cases:
  - Long threads (collect all posts in thread)
  - Quote tweets with context
  - Posts with only images (extract alt text + "Image post" label)

#### 2.3.2 LinkedIn extractor

**File:** `src/content-scripts/linkedin-extractor.ts`

- [x] Content script matches: `https://www.linkedin.com/*`
- [x] Extract from DOM:
  - Post text: `.feed-shared-update-v2__description` or similar selector
  - Author: `.feed-shared-actor__name`
  - Date: `.feed-shared-actor__sub-description` or `time` element
  - Article link (if shared article): `.feed-shared-article` href
- [x] Return `ExtractedContent` with `type: 'social-media'`, `platform: 'linkedin'`
- [x] Handle: "See more" truncated posts (click expand first)
- [x] Handle: LinkedIn articles (different from posts)

#### 2.3.3 Batch social media via tab opening

- [x] For bookmarked X/LinkedIn URLs in batch mode:
  1. Open URL in background tab
  2. Wait for page load
  3. Inject content script to extract
  4. Close tab
  5. Return extracted content
- [x] Rate limit: max 2 concurrent background tabs
- [x] Timeout: 15s per URL (close tab on timeout)
- [~] User notification: "2Vault is processing your bookmarks (opening tabs briefly)"

### Sprint 2.4: Polish + Extension Store Prep (Day 6-8) [DONE]

#### 2.4.1 Processing status UI

- [x] Build `ProcessingStatus` component:
  - List of URLs being processed
  - Per-URL status: queued / fetching / summarizing / categorizing / creating / done / failed
  - Overall progress bar
  - Error details expandable per failed URL
  - "View in Obsidian" link for completed notes

#### 2.4.2 Results summary

- [x] Build `ResultsSummary` component:
  - Table: URL | Folder | Tags | Status
  - Filter: show all / show failures only
  - Retry button for failed URLs
  - "Process More" button to return to bookmark browser

#### 2.4.3 Extension icon + branding

- [x] Design extension icon (16x16, 32x32, 48x48, 128x128)
- [x] Extension name: "2Vault - AI Bookmark Digester"
- [x] Short description for Chrome Web Store (132 char limit)
- [~] Screenshots (1280x800 or 640x400) for store listing

#### 2.4.4 Error states + edge cases

- [x] No API key configured -> redirect to settings with helper text
- [~] Obsidian not running -> clear error message + setup guide link
- [x] Empty bookmark folder -> "No bookmarks in this folder" state
- [x] All URLs failed -> "Something went wrong" with retry + troubleshooting
- [x] Extension update handling (preserve settings across updates)

### Sprint 2.5: Core Intelligence [DONE]

**Goal:** Add duplicate detection, PARA organization, tag groups, tag consistency, and graph linkage to make vault categorization significantly smarter.

**Dependencies:** Sprint 2.5.4 depends on 2.5.3. Sprint 2.5.5 depends on 2.5.3 and 2.5.4.

#### 2.5.1 Duplicate URL Detection

**Goal:** Search vault before processing each URL. Skip if a note with the same source URL already exists.

- [x] Add `searchNotes(query: string): Promise<SearchResult[]>` to `VaultClient` using `POST /search/simple/`
- [x] Add `readNote(path: string): Promise<string>` to `VaultClient` using `GET /vault/{path}`
- [x] Extend `ProcessingResult` with `"skipped"` status and `skipReason` field
- [x] Add duplicate check in orchestrator between vault context build and content extraction
- [x] Parse frontmatter `source:` field from search results to confirm match
- [x] Update `ResultsSummary` to show skipped count with distinct badge
- [x] Update `ProcessingStatus` to show "Skipped (duplicate)" per-URL status
- [x] Add unit tests for duplicate detection logic in orchestrator
- [x] Add unit tests for new VaultClient methods

#### 2.5.2 PARA Organization System

**Goal:** Offer PARA (Projects, Areas, Resources, Archive) as the default folder organization system for new users, with a Custom option for existing vault structures.

- [x] Add `VaultOrganization` type: `"para" | "custom"` to `Config` in `types.ts`
- [x] Define `PARA_FOLDERS` constant: `["Projects/", "Areas/", "Resources/", "Archive/"]` in `config.ts`
- [x] Add `vaultOrganization` to `chrome.storage.sync` schema in `storage.ts`
- [x] Add organization mode selector (radio group) in `Settings.tsx`
- [x] Show PARA folder descriptions when PARA mode is selected
- [x] Modify `buildCategorizationPrompt()` in `llm-shared.ts`: if PARA mode, inject PARA-aware instructions
- [x] LLM picks PARA bucket + topic subfolder (e.g., `Resources/AI/`, `Areas/Health/`)
- [x] Two-level depth: PARA bucket is level 1, topic subfolder is level 2
- [x] Auto-create PARA root folders in vault on first use if they don't exist (via `POST /vault/{path}`)
- [x] Default to PARA for new installations, Custom for existing users with vault data
- [x] Add unit tests for PARA-aware prompt building
- [x] Add unit tests for PARA folder creation logic

#### 2.5.3 User-Defined Tag Groups in Settings

**Goal:** Let users define tag groups (e.g., "Tech: typescript, react, python") in Settings so the LLM uses consistent tags.

- [x] Define `TagGroup` interface in `types.ts`: `{ name: string; tags: string[] }`
- [x] Extend `Config` with `tagGroups: TagGroup[]`
- [x] Add `tagGroups` to `chrome.storage.sync` schema in `storage.ts`
- [x] Build `TagGroupEditor` component in `src/popup/components/TagGroupEditor.tsx`
  - Add/remove tag groups
  - Add/remove tags within a group
  - Inline editing with tag chips
- [x] Integrate `TagGroupEditor` into `Settings.tsx`
- [~] Add unit tests for TagGroupEditor component (deferred - no React component test infrastructure for this component)
- [x] Add unit tests for tag group storage serialization

#### 2.5.4 Tag Consistency Rules for LLM

**Goal:** Make the LLM prioritize user-defined tag groups when assigning tags, complementing PARA organization.

**Depends on:** 2.5.3

- [x] Extend `VaultContext` with `tagGroups: TagGroup[]` field
- [x] Modify `buildCategorizationPrompt()` in `llm-shared.ts` to inject tag groups prominently
- [x] Prompt instructs LLM: "Prefer tags from these user-defined groups. Only create new tags if no group fits."
- [x] Pass `tagGroups` from `Config` into `VaultContext` in orchestrator
- [x] Validate LLM output tags against user groups (warn if inventing new tags)
- [x] Add unit tests for tag group prompt injection
- [x] Add integration test: tag groups influence LLM categorization output

#### 2.5.5 Graph Linkage via Tag Hub Notes

**Goal:** Create wiki-links in notes and auto-manage tag hub notes for Obsidian graph view connectivity.

**Depends on:** 2.5.3, 2.5.4

- [x] Add `appendToNote(path: string, content: string): Promise<void>` to `VaultClient` using `PATCH /vault/{path}`
- [x] Add `noteExists(path: string): Promise<boolean>` to `VaultClient`
- [x] Add `## Related Tags` section to note templates with `[[tag]]` wiki-links
- [x] Create `formatTagHubNote(tag: string, linkedNotes: string[]): string` template in `note-formatter.ts`
- [x] Hub note format: YAML frontmatter + list of `[[linked-note]]` wiki-links
- [x] Auto-create hub notes in orchestrator post-processing step (after note creation)
- [x] If hub note exists, append new `[[note]]` link instead of recreating
- [x] Hub notes stored in configurable location (default: `Tags/` folder)
- [x] Non-critical: if hub note creation fails, log warning and continue (main note already saved)
- [x] Add unit tests for hub note formatting
- [x] Add unit tests for append-vs-create logic
- [x] Add integration test for full pipeline with hub note creation

### Sprint 2.6: UX Polish [DONE]

**Goal:** Improve error visibility, add direct URL input, and validate settings inputs.

#### 2.6.1 Better Failed Results UI

**Goal:** Categorize errors, show actionable suggestions, and make failure details easy to explore.

- [x] Add `errorCategory` field to `ProcessingResult`: `"network" | "extraction" | "llm" | "vault" | "unknown"`
- [x] Set `errorCategory` in orchestrator catch blocks based on error source
- [x] Define error suggestion map: category -> user-facing help text (e.g., network -> "Check your internet connection")
- [x] Redesign `ResultsSummary` with:
  - Error category badge per failed URL
  - Expandable error details row
  - Copy URL button for failed items
  - Actionable suggestion text per category
- [x] Add "Retry Failed" button that re-processes only failed URLs
- [x] Add unit tests for error categorization logic
- [x] Add component tests for new ResultsSummary layout

#### 2.6.2 Direct URL Input

**Goal:** Let users paste URLs directly without bookmarking first.

- [x] Add URL textarea + "Process URLs" button above bookmark tree in `BookmarkBrowser.tsx`
- [x] URL parsing logic: split by newlines, trim whitespace, validate with `new URL()`, deduplicate
- [x] Show valid URL count below textarea
- [x] Disable "Process URLs" button when no valid URLs
- [x] Feed parsed URLs into existing processing pipeline (same as bookmark batch)
- [x] Add unit tests for URL parsing and validation logic
- [x] Add component tests for textarea integration

#### 2.6.3 API Key Format Validation

**Goal:** Validate API key format inline in Settings before save.

- [x] Create `validateOpenRouterKey(key: string): ValidationResult` in `src/utils/validation.ts`
  - Must start with `sk-or-`
  - Minimum length check (>20 chars)
- [x] Create `validateVaultApiKey(key: string): ValidationResult` in `src/utils/validation.ts`
  - Non-empty, minimum length check
- [x] `ValidationResult` type: `{ valid: boolean; error?: string }`
- [x] Add inline validation error messages in `Settings.tsx` below each input
- [x] Disable Save button when any validation fails
- [x] Validate on blur and on input change (debounced)
- [x] Add unit tests for validation functions
- [x] Add component tests for inline error display

#### 2.6.4 Obsidian URL Dropdown

**Goal:** Replace the vault URL text input with a preset dropdown for common configurations.

- [x] Define `VAULT_URL_PRESETS` constant in `config.ts`:
  - `{ label: "HTTP (localhost:27123)", value: "http://localhost:27123" }`
  - `{ label: "HTTPS (localhost:27124)", value: "https://localhost:27124" }`
  - `{ label: "Custom...", value: "custom" }`
- [x] Replace vault URL text input with dropdown in `Settings.tsx`
- [x] Show custom text input when "Custom..." is selected
- [x] Default selection: `https://localhost:27124` (current default)
- [x] Preserve backward compatibility: if stored URL doesn't match a preset, select "Custom..."
- [x] Add component tests for dropdown + custom input behavior

### Sprint 2.7: UIUX Fixes - Parallel Processing, Status Labels, Progress Bug [DONE]

**Goal:** Fix 6 interconnected UIUX issues found during manual testing: parallel processing, status labels, progress bar bug, duplicate detection, X extraction stability.

#### 2.7.1 Parallel Processing + Progress Fix

- [x] Restructure `ProcessingState` in `messages.ts`: replace `currentIndex/currentUrl/currentStatus` with `urlStatuses: Record<string, UrlStatus>`
- [x] New `ProgressCallback` signature: `(url: string, status: string) => void` (remove index/total)
- [x] Implement `processWithConcurrency()` worker pool in `orchestrator.ts` (concurrency=5)
- [x] Add `isCancelled` parameter for graceful cancellation
- [x] Track hub note tags in `Set<string>` to prevent race conditions
- [x] Update service worker: `MAX_CONCURRENT_TABS=5`, `onProgress` writes `urlStatuses`
- [x] Fix progress bar: count terminal statuses from `urlStatuses` map instead of `results.length`

#### 2.7.2 Human-Readable Status Labels

- [x] Add `statusDisplayLabel()` mapping in `processing-ui.tsx`
- [x] Show labels in `ProcessingStatus.tsx` and `ProcessingModal.tsx`

#### 2.7.3 URL Normalization for Duplicate Detection

- [x] Add `normalizeUrl()`: strip tracking params, normalize protocol/www/trailing slash
- [x] Apply normalization in `checkDuplicate()` for both incoming and stored URLs
- [x] Use `hostname + pathname` as search query

#### 2.7.4 X/Twitter Extraction Stability

- [x] Add `waitForTweetElement()` DOM polling (500ms interval, 10s timeout)
- [x] Make content script message listener async (`return true`)
- [x] Fallback to `extractFromDom()` on timeout

#### 2.7.5 Test Updates

- [x] Update `ProgressCallback` mock assertions in orchestrator tests
- [x] Add `normalizeUrl` unit tests
- [x] Add cancellation test with `isCancelled`
- [x] Add parallel processing verification test

#### 2.7.6 Manual Testing with X Posts

- [ ] Test 5 X post URLs for extraction completeness
- [ ] Re-process same URLs to verify duplicate detection

---

### Sprint 2.8: Thread & Forum Extraction [DONE]

**Goal:** Improve X thread extraction (distinguish author thread vs. replies, capture top replies) and add Reddit as a supported platform. Thread/conversation context is critical for summarization quality before GTM launch.

<!-- Claude Code Tooling:
  - browser-extension-builder (skill): Content script patterns, manifest updates
  - bug-detective (agent): DOM selector fragility, edge cases
  - typescript-expert (skill): ExtractedContent type updates
  - javascript-testing-patterns (skill): DOM fixture testing strategy
  - sprint-execute (skill): Full sprint loop
-->

#### 2.8.1 Improve X/Twitter Thread Extraction

- [x] Distinguish author's own thread tweets from replies by other users
- [x] Label author thread vs. conversation replies in extracted content
- [x] Capture top replies (by engagement) beyond just author's thread
- [x] Add thread metadata: total reply count indicator ("Showing 5 of 47 replies")
- [~] Handle "Show more replies" button click to load additional replies (deferred - too fragile)
- [x] Set max extraction depth (author thread unlimited, replies capped at top 5)
- [x] Update note title format: `Thread by @handle (N tweets) + M replies`
- [ ] Test with 5+ real thread URLs of varying sizes (manual testing needed)

#### 2.8.2 Add Reddit Content Script

- [x] Create `src/content-scripts/reddit-extractor.ts`
- [x] Add Reddit URL patterns to `manifest.json` content_scripts + host_permissions
- [x] Extract post: title, author, subreddit, score, timestamp, flair
- [x] Extract post body (self-text or link post)
- [x] Extract top N comments (sorted by upvotes, default N=5)
- [~] Flatten nested replies into readable thread view (only top-level comments extracted)
- [x] Handle both old.reddit.com and new reddit.com DOM structures
- [x] Add `platform: "reddit"` to ExtractedContent type (via Platform type alias)
- [x] Fallback to body.innerText if DOM extraction fails
- [x] Shadow DOM traversal (deepQuerySelector/deepQuerySelectorAll) for new Reddit web components
- [ ] Test on 10+ Reddit URLs (manual testing needed)

#### 2.8.3 Update Core Pipeline for Thread Context

- [x] Add `Platform` type alias to `types.ts` with `"reddit"` variant
- [x] Update LLM prompts to handle thread/conversation context (## Top Replies / ## Top Comments hints)
- [x] note-formatter.ts already handles any platform value (no changes needed)
- [x] Add `old.reddit.com` -> `reddit.com` URL normalization for duplicate detection
- [x] Add Reddit URL patterns to service worker routing

#### 2.8.4 Tests

- [x] Unit tests for reddit-extractor.ts (21 tests, mock DOM fixtures)
- [x] Unit tests for improved X thread extraction (30 tests, author vs. replies)
- [x] Add `tests/fixtures/html/reddit-post.html` fixture (new Reddit DOM)
- [x] Add `tests/fixtures/html/twitter-thread-with-replies.html` fixture
- [x] Update llm-shared tests (thread context hints, 11 tests)
- [x] Update service-worker tests (Reddit URL routing, 19 tests)
- [x] Update orchestrator tests (old.reddit.com normalization, 45 tests)
- [x] All 413 tests pass, typecheck clean, build clean
- [ ] Manual testing: 5 Reddit + 5 X thread URLs end-to-end

---

## Phase 3: Managed Tier + Growth (Future) [DEFERRED]

Only after Phase 2 is live and has 100+ installs.

### 3.1 Serverless Proxy [DEFERRED]

- [~] Vercel Edge Function: `POST /api/process`
  - Accepts: content + vault context
  - Returns: processed note data
  - Auth: session token from Stripe subscription
  - Rate limiting: per-user, per-day
- [~] Stripe integration:
  - Checkout session for managed tier ($12-15/mo)
  - Customer portal for billing management
  - Webhook for subscription status
- [~] Usage tracking dashboard (for cost monitoring)

### 3.2 Additional LLM Providers [DEFERRED]

- [~] OpenAI provider (GPT-4o / GPT-4o-mini)
- [~] OpenRouter integration (multi-model BYOK)
- [~] Provider comparison in settings (cost/quality tradeoffs)

### 3.3 Duplicate Detection [MOVED to Sprint 2.5.1]

- [~] ~~Check vault for existing note with same source URL before creating~~ -> Sprint 2.5.1
- [~] Show "Already saved" indicator in bookmark browser (future enhancement)
- [~] Option to re-process (overwrite or create new version) (future enhancement)

### 3.4 Facebook + Instagram Extractors [DEFERRED]

- [~] Facebook DOM content script
- [~] Instagram DOM content script
- [~] Both: text-based first, media metadata later

### 3.5 YouTube Transcript Extraction [DEFERRED]

- [~] YouTube content script: extract video transcript
- [~] Or: use YouTube Transcript API
- [~] Summarize transcript instead of page content

---

## Testing Strategy

### Phase 1 (Core Module)

| Layer | Tool | What |
|-------|------|------|
| Unit | Vitest | Extraction, formatting, vault client (mocked HTTP) |
| Integration | Vitest | Full pipeline with fixture data + local Obsidian vault |
| E2E | Manual | Real URLs -> real Obsidian vault, review notes |

### Phase 2 (Extension)

| Layer | Tool | What |
|-------|------|------|
| Unit | Vitest | Components, content scripts, service worker logic |
| Integration | Vitest + WDIO | Extension loaded in Chrome, popup interactions |
| E2E | Manual | Install extension, process real bookmarks, verify in Obsidian |
| Social media | Manual | Test X and LinkedIn extractors on live pages |

### Test Fixtures

```
tests/fixtures/
├── html/
│   ├── blog-post.html            # Standard article
│   ├── medium-article.html       # JS-rendered (pre-captured)
│   ├── github-readme.html        # GitHub README page
│   ├── twitter-single.html       # Single tweet page DOM
│   ├── twitter-thread.html       # Thread page DOM
│   ├── linkedin-post.html        # LinkedIn post DOM
│   └── paywall.html              # Login-required page
├── expected/
│   ├── blog-post.md              # Expected output note
│   ├── twitter-single.md         # Expected social media note
│   └── linkedin-post.md          # Expected LinkedIn note
└── vault/
    ├── Resources/
    │   ├── AI/
    │   └── Web Dev/
    ├── Projects/
    └── .obsidian/
```

---

## Risk Mitigations

| Risk | Mitigation |
|------|-----------|
| X/Twitter DOM structure changes | Selector versioning + fallback to raw text extraction. Monitor for breakage. |
| LinkedIn anti-scraping blocks content script | Graceful failure + "paste text manually" fallback |
| Obsidian Local REST API plugin has bugs | Pin plugin version in docs. Test against specific version. |
| Chrome Web Store review rejection | Follow Manifest V3 best practices. Minimal permissions. Clear privacy policy. |
| LLM miscategorizes content | Default folder as safety net. Future: preview before commit. |
| Token costs surprise users (BYOK) | Show estimated cost before processing. Cost transparency in UI. |
| Extension popup closes during processing | Service worker continues in background. Resume state on reopen. |
| Project exceeds 3-week time budget | Kill if not 50% done by end of week 2. Ship MVP, cut nice-to-haves. |
