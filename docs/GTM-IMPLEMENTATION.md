# GTM Implementation Plan

## Progress Tracking Legend

| Symbol | State | Meaning |
|--------|-------|---------|
| `[x]` | DONE | Completed and committed to main branch |
| `[>]` | IN-PROGRESS | Actively being worked on |
| `[ ]` | TODO | Not started yet |
| `[~]` | DEFERRED | Intentionally skipped or deferred |

---

<!-- Claude Code Tooling (per sprint):

  Sprint 3.1 Planning & Decisions:
    - product-manager (agent): GTM strategy validation, messaging review
    - cofounder (agent): Build order, MVP scope cuts
    - project-manager (agent): Timeline, risk assessment
    - clarification (skill): When decisions are ambiguous

  Sprint 3.2 In-Extension Onboarding:
    - browser-extension-builder (skill): Manifest V3, onboarding tab entry point, CRXJS config
    - typescript-expert (skill): Storage types, hook patterns, strict mode
    - frontend-design (skill): Onboarding step UI, dark mode, progress indicator
    - expert-react-frontend-engineer (agent): Component architecture, state management
    - pr-review-toolkit:code-reviewer (agent): After writing components
    - pr-review-toolkit:silent-failure-hunter (agent): Connection test error handling
    - javascript-testing-patterns (skill): Onboarding component tests

  Sprint 3.3 Landing Page:
    - frontend-design (skill): Landing page sections, responsive layout, dark mode
    - frontend-developer (agent): Vite + React SPA implementation
    - interactive-portfolio (skill): Landing page conversion patterns
    - ui-designer (agent): Visual design, hero section, layout
    - brand-strategist (agent): Copy review, headline testing, positioning validation

  Sprint 3.4 Chrome Web Store:
    - product-manager-toolkit (skill): Store listing, screenshots, descriptions
    - browser-extension-builder (skill): Manifest review, permissions justification

  Sprint 3.5 Launch:
    - cofounder (agent): Launch channel strategy, post timing
    - product-manager (agent): Post-launch metrics, iteration priorities

  Cross-cutting (use throughout):
    - pr-review-toolkit:code-reviewer (agent): After writing code
    - git-commit (skill): Conventional commits
    - sprint-execute (skill): Full sprint loop
    - claude-md-management:revise-claude-md (skill): Update CLAUDE.md with learnings
-->

Go-to-market implementation: onboarding wizard, landing page, Chrome Web Store submission, and public launch.

- **Phase 3:** GTM - Onboarding + Landing Page + Launch
- **Depends on:** Phase 2 complete (Sprints 1.1-2.7 all DONE)

**Reference docs:**
- `docs/GTM-STRATEGY-SUMMARY.md` - strategic decisions, messaging framework, success metrics
- `docs/LANDING-PAGE-COPY.md` - ready-to-use copy for all landing page sections
- `docs/LANDING-ONBOARDING-FLOW-DIAGRAMS.md` - ASCII mockups, user journey, state flows
- `docs/REFERENCE-EXAMPLES.md` - competitive analysis (Raycast, Linear, Notion patterns)
- `tasks/ONBOARDING-LANDING-PAGE-TASKS.md` - granular task reference with effort estimates

---

## Resolved Decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Onboarding location | **New tab** (`chrome-extension://id/onboarding.html`) | Full-page layout needed for setup instructions + screenshots. Opens via `chrome.runtime.onInstalled`. |
| 2 | Landing page tech | **Vite + React SPA** (static build, Tailwind CSS) | Same stack as extension (familiar tooling), zero server cost, deploy as static build to Vercel/GitHub Pages. |
| 3 | Onboarding steps | **3 steps** (Obsidian Connection, OpenRouter Key, Done) | Minimal drop-off. PARA defaults applied automatically. User discovers Settings later. |
| 4 | Domain | **2vault.dev** | Clean dev domain (~$12/yr). |
| 5 | Analytics | **None at launch** | Use Chrome Web Store dashboard for install metrics. Add analytics later if needed. |

### Brand-Strategist Review Notes (incorporated into sprints below)

1. **Hero headline must name Obsidian directly.** Generic productivity messaging bounces the target user. Use: "Your bookmark backlog, filed into Obsidian." Not: "Paste your bookmarks. Get organized knowledge."
2. **SSL certificate error is the #1 onboarding drop-off risk.** Obsidian REST API uses self-signed cert. Must add explicit error state + fix instructions in Step 1.
3. **Move Obsidian YouTuber outreach to pre-launch.** A single mention from a 50K+ subscriber Obsidian creator outperforms all social media channels combined.
4. **Replace placeholder testimonials with GitHub credibility block at launch.** Open source code is the trust signal for this audience, not fake quotes.
5. **Articulate vault learning angle.** Position vault-awareness as compounding value ("the more you use it, the better it understands your vault"), not a one-time read.

---

## Phase 3: Go-to-Market

### Sprint 3.1: Planning & Decisions (Day 1) [ ] TODO

**Goal:** Resolve all open decisions, gather assets, set up infrastructure.

**Effort:** 4-6 hours
**Dependencies:** None (can start immediately)

#### 3.1.1 Resolve Open Decisions

- [ ] Answer Decision 1-5 above
- [ ] Create GitHub Issue `gtm-decisions` documenting all answers
- [ ] Update this file: replace decision tables with chosen option marked `[CHOSEN]`

#### 3.1.2 Gather Visual Assets

- [ ] Screenshot extension popup: BookmarkBrowser tab (folder tree + process button)
- [ ] Screenshot processing modal (progress bar, per-URL status labels)
- [ ] Screenshot results summary (processed/skipped/failed counts)
- [ ] Screenshot Obsidian note created by 2Vault (frontmatter + summary visible)
- [ ] Screenshot Settings page (API key inputs + connection test)
- [ ] Compress all screenshots <200KB each (tinypng.com)
- [ ] Create OG image for social sharing (1200x630)

#### 3.1.3 Infrastructure Setup

- [ ] Purchase domain (if Decision 4 chosen)
- [ ] Set up hosting account (Vercel or GitHub Pages based on Decision 2)
- [ ] Create Chrome Web Store developer account ($5 one-time fee)
- [ ] Verify Obsidian Local REST API running for onboarding testing

---

### Sprint 3.2: In-Extension Onboarding (Day 2-4) [x] DONE

**Goal:** First-time users get a guided setup flow that validates connections before proceeding.

**Effort:** 8-12 hours (if Decision 1A: new tab) or 6-8 hours (if Decision 1B: popup)
**Dependencies:** Sprint 3.1 complete (decisions resolved)

#### 3.2.1 Storage Schema + First-Time Detection

**Files:** `src/utils/storage.ts` (modify)

- [x] Add `onboardingComplete: boolean` to `chrome.storage.sync` schema
- [x] Add `onboardingStep: number` to `chrome.storage.sync` schema (for resume on close/reopen)
- [x] Implement `isFirstTimeUser(): Promise<boolean>` helper
- [x] Implement `markOnboardingComplete(): Promise<void>` helper
- [x] Implement `setOnboardingStep(step: number): Promise<void>` helper

#### 3.2.2 Onboarding Entry Point (New Tab)

**Files:** `src/onboarding/onboarding.html` (new), `src/onboarding/onboarding.tsx` (new), `src/onboarding/OnboardingApp.tsx` (new), `vite.config.ts` (modify), `manifest.json` (modify)

- [x] Create `src/onboarding/onboarding.html` as second Vite/CRXJS entry point
- [x] Register in `vite.config.ts` rollupOptions.input
- [~] Add `web_accessible_resources` for onboarding.html in `manifest.json` (not needed - CRXJS handles it)
- [x] Create `src/onboarding/onboarding.tsx` React root (same pattern as popup.tsx)
- [x] Create `src/onboarding/OnboardingApp.tsx` with step state machine + progress bar
- [x] Add `chrome.runtime.onInstalled` listener in `src/background/service-worker.ts` to open tab on fresh install
- [x] Modify `src/popup/popup.tsx`: if `!onboardingComplete`, redirect to onboarding tab and close popup
- [x] Verify built path for onboarding.html after `bun run build`

#### 3.2.3 Onboarding State Hook

**File:** `src/onboarding/hooks/useOnboardingState.ts` (new)

- [x] Define `OnboardingData` interface: `{ vaultUrl, vaultApiKey, openRouterKey, vaultOrganization, tagGroups }`
- [x] Implement `useOnboardingState()` hook with:
  - `currentStep: number` (persisted to `chrome.storage.sync` for resume)
  - `data: OnboardingData` (held in React state, written atomically on completion)
  - `goToStep(step)`: updates step in storage (resume support)
  - `updateData(partial)`: merges into React state
  - `completeOnboarding()`: writes full Config to storage + sets `onboardingComplete: true`
- [x] On mount: restore `currentStep` from `chrome.storage.sync` (data not persisted until completion for security)

#### 3.2.4 Step Components (3 Steps)

**Files:** `src/onboarding/steps/` (new directory)

**Step 1: ObsidianConnectionStep** (`src/onboarding/steps/ObsidianConnectionStep.tsx`)

- [x] Header: "Connect to Obsidian" with plugin install link
- [x] Link to install plugin: `obsidian://show-plugin?id=obsidian-local-rest-api` (deep link opens Obsidian directly)
- [x] Vault URL dropdown: `https://localhost:27124` (default), `http://localhost:27123`, Custom text input
- [x] Vault API key input (password field with eye toggle)
- [x] "Test Connection" button: calls `VaultClient.testConnection()` from `@/core/vault-client`
- [x] Inline format validation via `validateVaultApiKey()` from `@/utils/validation`
- [x] Loading state while testing
- [x] Success state: green banner "Connected to Obsidian vault successfully"
- [x] Error states with categorized guidance:
  - **SSL certificate error:** link to open vault URL and accept cert
  - **Connection refused:** guidance to check Obsidian and plugin
  - **401 Unauthorized:** guidance to check API key
  - **Fallback:** suggest switching HTTP/HTTPS
- [x] "Next" button disabled until test passes

**Step 2: OpenRouterStep** (`src/onboarding/steps/OpenRouterStep.tsx`)

- [x] API key input with real-time format validation via `validateOpenRouterKey()` from `@/utils/validation`
- [x] "Get a free API key" link opens `https://openrouter.ai/keys` in new tab
- [x] "Test Key" button: validates against OpenRouter API via `testOpenRouterConnection()`
- [x] Success state: green banner "API key verified successfully"
- [x] Error states with guidance (invalid key, network error)
- [x] "Next" button disabled until test passes

**Step 3: CompletionStep** (`src/onboarding/steps/CompletionStep.tsx`)

- [x] Green checkmarks for completed steps (Obsidian connected, AI configured, organization mode)
- [x] Config summary (vault URL, organization mode)
- [x] **Contextual nudge**: "Pick a small bookmark folder (5-10 bookmarks) and click Process to see 2Vault in action."
- [x] "Open 2Vault" button -> saves config atomically, sends OPEN_POPUP message, closes onboarding tab

#### 3.2.5 Verification

- [x] `bun run typecheck` passes with zero errors
- [x] `bun run test` passes: 428 tests (including 6 new onboarding storage tests)
- [x] `bun run build` includes `src/onboarding/onboarding.html` in dist/
- [ ] Fresh install opens onboarding (new tab) -- manual verification needed
- [ ] Each step validates before Next is enabled -- manual verification needed
- [ ] Back button preserves data from previous steps -- manual verification needed
- [ ] Closing mid-setup and reopening resumes at correct step -- manual verification needed
- [ ] After completion, popup shows normal tabs (Bookmarks default) -- manual verification needed
- [ ] Second open of popup does NOT show onboarding again -- manual verification needed
- [ ] Test with invalid Obsidian URL -> shows helpful error + recovery -- manual verification needed
- [ ] Test with invalid API key format -> shows format hint -- manual verification needed
- [ ] Test with Obsidian not running -> shows troubleshooting steps -- manual verification needed

---

### Sprint 3.3: Landing Page (Day 3-5) [ ] TODO

**Goal:** Single-page marketing site live at chosen domain, explaining what 2Vault does and linking to Chrome Web Store.

**Effort:** 6-10 hours
**Dependencies:** Sprint 3.1 complete (Decision 2 resolved, assets gathered)
**Can run in parallel with:** Sprint 3.2

#### 3.3.1 Project Setup (Vite + React SPA)

- [ ] `bun create vite 2vault-landing --template react-ts`
- [ ] `cd 2vault-landing && bun install`
- [ ] Install Tailwind: `bun add -d tailwindcss @tailwindcss/vite` and configure `vite.config.ts`
- [ ] Install react-icons: `bun add react-icons`
- [ ] Configure `@/` path alias in `tsconfig.json` + `vite.config.ts`
- [ ] Create `/public/images/` folder, copy screenshots from Sprint 3.1.2
- [ ] Initialize git repo, push to GitHub as `2vault-landing`
- [ ] Verify `bun dev` works at `localhost:5173`

#### 3.3.2 Design System

- [ ] Define color palette: primary `#5e5ce6` (Obsidian purple), accent `#4ec9b0` (teal), dark bg `#1e1e1e`
- [ ] Define typography scale (h1-h3, body, small)
- [ ] Set dark mode as default background
- [ ] Define spacing utilities (section padding, container max-width)

#### 3.3.3 Landing Page Sections

Copy source: `docs/LANDING-PAGE-COPY.md`
Layout reference: `docs/LANDING-ONBOARDING-FLOW-DIAGRAMS.md`

**Navigation (sticky):**

- [ ] Logo/name left, nav links center, "Install on Chrome" CTA right
- [ ] Links: How It Works, Setup, GitHub
- [ ] Responsive: hamburger on mobile or hide nav links

**Hero (brand-strategist revised):**

- [ ] Headline: **"Your bookmark backlog, filed into Obsidian."** (names Obsidian directly, assumes vault literacy)
- [ ] Subheading: "2Vault batch-processes your bookmarks with AI and files each note in your vault's own folder structure -- in the right PARA folder, with your own tags."
- [ ] 2 CTAs: "Install on Chrome" (primary) + "View on GitHub" (outline)
- [ ] Hero image: before/after screenshot (bookmarks -> Obsidian note with frontmatter + tags visible)
- [ ] 2-column layout desktop, stacked mobile

**How It Works:**

- [ ] 3-4 step visual: Select bookmarks -> AI processes -> Notes appear (+ optional keyboard shortcut step)
- [ ] Screenshot per step
- [ ] Numbered steps with connecting visual flow

**Vault-Aware Feature (brand-strategist revised copy):**

- [ ] Rewrite vault-aware description: "Before filing each note, 2Vault reads your current vault structure -- every folder, every existing tag. The more organized your vault is, the more precisely 2Vault categorizes new content. Your organizational work compounds."
- [ ] This positions vault-awareness as compounding value, not a one-time read

**Setup Guide:**

- [ ] 3 collapsible accordion items: Install Extension, Get API Keys (Obsidian + OpenRouter), Configure 2Vault
- [ ] Be honest about time: "15 minutes to set up, then seconds per bookmark" (not "5 minutes")
- [ ] Links to plugin install pages
- [ ] This section is a **filter** (helps users self-select), not a tutorial (that's in the onboarding tab)

**GitHub Credibility Block (replaces testimonials at launch):**

- [ ] "Open source under AGPL-3.0. Every line of code is public. Inspect the extraction logic, the LLM prompts, the vault-client implementation. Your bookmarks are processed in your browser. Nothing is stored on our servers because we have no servers."
- [ ] "View on GitHub" CTA
- [ ] Replace with real testimonials after collecting 5+ user quotes post-launch

**Footer:**

- [ ] Links: GitHub, X/Twitter, Privacy Policy, License (AGPL-3.0)
- [ ] Copyright line
- [ ] Final CTA: "Install on Chrome"

#### 3.3.4 SEO + Social Meta

- [ ] Page title: "2Vault - AI Chrome Extension for Obsidian"
- [ ] Meta description: from `LANDING-PAGE-COPY.md`
- [ ] Open Graph tags: `og:title`, `og:description`, `og:image`, `og:url`
- [ ] Twitter Card tags: `twitter:card`, `twitter:title`, `twitter:image`
- [ ] OG image from Sprint 3.1.2

#### 3.3.5 Privacy Policy Page

- [ ] Sections: Data We Collect, What We Don't Do, Open Source, Contact
- [ ] <500 words, plain language (not legalese)
- [ ] "Last updated" date
- [ ] Linked from footer

#### 3.3.6 Deploy

- [ ] Build: `bun run build` -> outputs to `dist/`
- [ ] Deploy static `dist/` to Vercel, GitHub Pages, or Cloudflare Pages
- [ ] Configure custom domain: `2vault.dev`
- [ ] Verify site loads on `https://2vault.dev`
- [ ] Test mobile responsiveness (375px, 768px, 1200px)
- [ ] Test all links work (Chrome Web Store link can be placeholder until Sprint 3.4)
- [ ] Verify OG image renders in social share preview (use https://opengraph.xyz)

---

### Sprint 3.4: Chrome Web Store Submission (Day 5-6) [ ] TODO

**Goal:** Extension submitted to Chrome Web Store with all required assets and copy.

**Effort:** 3-5 hours
**Dependencies:** Sprint 3.2 complete (onboarding working)
**Can run in parallel with:** Sprint 3.3 (landing page)

#### 3.4.1 Store Assets

- [ ] Create 5 screenshots (1280x800 each):
  1. Bookmark Browser UI (folder tree + process button)
  2. Processing status (progress bar, per-URL status)
  3. Results summary (processed/skipped/failed)
  4. Obsidian note result (frontmatter + summary in vault)
  5. Settings/onboarding page (API key inputs + test buttons)
- [ ] Verify extension icon exists: 128x128 PNG
- [ ] Compress all images

#### 3.4.2 Store Copy

**File:** `docs/CHROME-STORE-COPY.md` (new)

- [ ] Short description (132 chars max): `"Batch-process bookmarks with AI. Files them into your Obsidian vault with smart tagging."`
- [ ] Detailed description (~500 words): what it does, why you need it, how to start, technical details, permissions explained, pricing
- [ ] Copy source: adapt from `docs/LANDING-PAGE-COPY.md`

#### 3.4.3 Build + Package

- [ ] `bun run build` -> verify `dist/` contains manifest.json, popup, service-worker, content scripts, icons
- [ ] Create zip: `cd dist && zip -r ../2vault-extension.zip .`
- [ ] Load from `dist/` in `chrome://extensions` for final smoke test

#### 3.4.4 Submit

- [ ] Go to Chrome Web Store Developer Dashboard
- [ ] Upload `2vault-extension.zip`
- [ ] Fill listing: name, descriptions, category (Productivity), language, website, privacy policy URL, support email
- [ ] Upload icon + 5 screenshots
- [ ] Review all fields
- [ ] Click "Submit for review"
- [ ] Note: Review takes 24-72 hours

---

### Sprint 3.5: Launch (Day 7-8 + Week 1 monitoring) [ ] TODO

**Goal:** Public announcement across multiple channels, monitor early feedback, iterate.

**Effort:** 4-6 hours launch + 1 hour/day for 7 days monitoring
**Dependencies:** Sprint 3.3 complete (landing page live), Sprint 3.4 approved (store listing live)

#### 3.5.0 Pre-Launch Outreach (Start 2 weeks before launch)

- [ ] Identify 3-5 Obsidian content creators (YouTube, blog)
- [ ] Send short personal DM offering demo/setup help (not asking for review)
- [ ] Priority targets: Obsidian YouTubers with 50K+ subscribers who cover PKM workflows
- [ ] Goal: creators know the product exists so they can mention it organically

#### 3.5.1 Pre-Launch Verification

- [ ] Landing page loads on `https://2vault.dev`
- [ ] All landing page links work (especially Chrome Web Store link)
- [ ] Extension installs from Chrome Web Store
- [ ] Onboarding completes successfully on fresh install
- [ ] Process 5 bookmarks -> notes appear in Obsidian
- [ ] Keyboard shortcut (Ctrl+Shift+V) works
- [ ] GitHub README updated with Chrome Web Store link + landing page link

#### 3.5.2 Social Media Posts

**File:** `docs/GTM-LAUNCH-POSTS.md` (new)

- [ ] Write X/Twitter launch thread (problem -> solution -> features -> links + demo GIF)
- [ ] Write Reddit post for r/ObsidianMD (personal story + features + links)
- [ ] Write Hacker News "Show HN" post (technical angle + GitHub + links)
- [ ] Write Obsidian Discord/Forum post (community angle + links)
- [ ] Create 15-30 second demo GIF (select folder -> processing -> note in Obsidian)

#### 3.5.3 Launch Day Execution (channels ordered by expected impact)

- [ ] **Primary:** Post to r/ObsidianMD (first-person, community tone, not promotional)
- [ ] **Primary:** Post to Obsidian Discord #share-showcase (GIF demo, direct)
- [ ] **Secondary:** Submit to Hacker News "Show HN" (technical angle, expect technical questions not installs)
- [ ] **Secondary:** Post X/Twitter thread (good for documentation/build-in-public, low install ROI without existing audience)
- [ ] **Optional:** Post to r/PKMS, r/productivity, Obsidian Forum
- [ ] Monitor and respond to comments throughout the day (Reddit and Discord are highest priority)
- [ ] Track: installs, stars, mentions, reviews

#### 3.5.4 Week 1 Post-Launch Monitoring

Daily checklist:
- [ ] Check Chrome Web Store reviews (respond within 24 hours)
- [ ] Monitor GitHub issues
- [ ] Track landing page traffic (if analytics enabled)
- [ ] Fix critical bugs immediately
- [ ] Collect user feedback -> document common questions
- [ ] Update FAQ/docs based on real questions

**Success targets (Week 1):**
- Chrome Web Store: >100 installs, >4.5 star rating
- GitHub: >50 stars
- Landing page: >1,000 visitors
- Onboarding: >55% completion rate (industry benchmark for 2-API-key setup is 40-55%; 70% was too optimistic)
- First bookmark processed: >50% of completers within 1 hour (track time-to-first-process as histogram, not just binary)

#### 3.5.5 Post-Launch Iteration [~]

- [~] Add testimonials section to landing page (after collecting real user quotes)
- [~] Update landing page stats ("500+ installs", "4.5 stars")
- [~] Analyze onboarding drop-off and simplify weakest step
- [~] Create video walkthrough (2-3 minute YouTube)
- [~] Write setup guide with screenshots (`docs/SETUP-GUIDE.md`)

---

## Critical Path

```
Sprint 3.1 (Decisions + Assets)
    |
    ├─── Sprint 3.2 (Onboarding) ──── Sprint 3.4 (Store Submit) ──┐
    |                                                                |
    └─── Sprint 3.3 (Landing Page) ────────────────────────────────┤
                                                                    |
                                                             Sprint 3.5 (Launch)
```

- **Sprints 3.2 and 3.3 can run in parallel** after 3.1 is done
- **Sprint 3.4** requires 3.2 complete (onboarding must work before store submission)
- **Sprint 3.5** requires both 3.3 and 3.4 complete (need live landing page + approved store listing)
- **Store review** takes 24-72 hours: submit in Sprint 3.4, build landing page during wait

## Timeline Estimates

| Sprint | Effort | Calendar Days | Status |
|--------|--------|---------------|--------|
| 3.1 Planning & Decisions | 4-6h | 1 day | [ ] TODO |
| 3.2 Onboarding Wizard | 6-12h | 2-3 days | [x] DONE |
| 3.3 Landing Page | 6-10h | 2-3 days | [ ] TODO |
| 3.4 Chrome Web Store | 3-5h | 1 day + 1-3 day review wait | [ ] TODO |
| 3.5 Launch | 4-6h + 7h monitoring | 1 day + 1 week | [ ] TODO |
| **Total** | **23-39h** | **7-10 active days** | |

**Compressed timeline (full-time):** 2 weeks including store review wait
**Part-time timeline:** 3-4 weeks

---

## Risk Mitigations

| Risk | Mitigation |
|------|-----------|
| Chrome Web Store rejection | Follow MV3 best practices, justify all permissions in description, privacy policy ready |
| Users can't find Obsidian REST API plugin | Direct link in onboarding: `obsidian://show-plugin?id=obsidian-local-rest-api` |
| High onboarding drop-off | Start with minimal steps (Decision 3B), add more later based on data |
| Landing page doesn't convert | Focus on hero + how it works (80% of value). Add sections post-launch based on user questions |
| Low launch traction | Cross-post to 4+ channels simultaneously. Obsidian community is niche but engaged |
| API key confusion (2 different keys) | Label clearly: "Obsidian API key (for vault access)" vs "OpenRouter API key (for AI processing)" |

---

## Testing Strategy

### Sprint 3.2 (Onboarding)

| Layer | Tool | What |
|-------|------|------|
| Manual | Chrome DevTools | Fresh install flow, storage inspection, error states |
| Unit | Vitest | Storage helpers (`isFirstTimeUser`, `markOnboardingComplete`) |
| Integration | Manual | Real Obsidian vault + real OpenRouter key through full onboarding |

### Sprint 3.3 (Landing Page)

| Layer | Tool | What |
|-------|------|------|
| Visual | Browser | Mobile (375px), tablet (768px), desktop (1200px) responsive check |
| Links | Manual | All CTAs, nav links, footer links, privacy policy |
| SEO | Browser DevTools | OG tags render in social preview |

### Sprint 3.4 (Chrome Web Store)

| Layer | Tool | What |
|-------|------|------|
| Build | `bun run build` | dist/ contains all required files |
| Smoke | Chrome | Load unpacked -> onboarding -> process bookmark -> verify in Obsidian |
