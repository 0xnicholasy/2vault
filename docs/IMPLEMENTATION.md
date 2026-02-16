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

### Sprint 2.4: Polish + Extension Store Prep (Day 6-8) [TODO]

#### 2.4.1 Processing status UI

- [ ] Build `ProcessingStatus` component:
  - List of URLs being processed
  - Per-URL status: queued / fetching / summarizing / categorizing / creating / done / failed
  - Overall progress bar
  - Error details expandable per failed URL
  - "View in Obsidian" link for completed notes

#### 2.4.2 Results summary

- [ ] Build `ResultsSummary` component:
  - Table: URL | Folder | Tags | Status
  - Filter: show all / show failures only
  - Retry button for failed URLs
  - "Process More" button to return to bookmark browser

#### 2.4.3 Extension icon + branding

- [ ] Design extension icon (16x16, 32x32, 48x48, 128x128)
- [ ] Extension name: "2Vault - AI Bookmark Digester"
- [ ] Short description for Chrome Web Store (132 char limit)
- [ ] Screenshots (1280x800 or 640x400) for store listing

#### 2.4.4 Error states + edge cases

- [ ] No API key configured -> redirect to settings with helper text
- [ ] Obsidian not running -> clear error message + setup guide link
- [ ] Empty bookmark folder -> "No bookmarks in this folder" state
- [ ] All URLs failed -> "Something went wrong" with retry + troubleshooting
- [ ] Extension update handling (preserve settings across updates)

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

### 3.3 Duplicate Detection [DEFERRED]

- [~] Check vault for existing note with same source URL before creating
- [~] Show "Already saved" indicator in bookmark browser
- [~] Option to re-process (overwrite or create new version)

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
