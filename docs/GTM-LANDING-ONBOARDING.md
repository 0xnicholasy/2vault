# Landing Page + Onboarding Strategy

<!-- Claude Code Tooling:
  - product-manager-toolkit (skill): Feature prioritization, user research synthesis, GTM strategy
  - frontend-design (skill): Landing page layout, form design, progressive disclosure
  - cofounder (agent): Product strategy decisions, roadmap priorities
-->

This document outlines the public landing page and in-extension onboarding strategy for 2Vault. The core principle: **make the first 5 minutes of the user journey feel effortless**.

Target: Users should be able to install the extension, set it up (even if they have to look up API keys), and process their first bookmark within 15 minutes.

---

## Part 1: Landing Page Strategy

### 1.1 Goals & Audience

**Primary audience:** Obsidian power users (PKM practitioners, developers, researchers) who:
- Bookmark 10-50 URLs per week
- Use Obsidian as their primary knowledge base
- Are frustrated with "saving to read later" tools that don't connect to their vault

**Secondary audience:** Chrome Web Store browsers searching for "Obsidian extension" or "bookmark management"

**Landing page goals:**
1. Answer: "What does this do in 5 seconds?"
2. Show: "How does it work?" (with demo/screenshot)
3. Prove: "Does it work with my vault?"
4. Guide: "How do I set it up?"
5. Convert: Install button is visible without scrolling (mobile-friendly)

**Success metric:** >60% of visitors who read past the headline click "Install on Chrome"

---

### 1.2 Content Structure (Single-Page Site)

A single landing page is optimal for a solo dev. Multi-page sites create maintenance burden. One page = one source of truth.

#### Header Section (Above Fold - Mobile & Desktop)
```
Logo + Navigation (sticky)
  - "Home" (scrolls to hero)
  - "How It Works" (scrolls to demo)
  - "Setup Guide" (scrolls to steps)
  - "GitHub" (external)

Hero Section (1200px viewport height)
  - Headline: "Paste your bookmarks. Get organized knowledge."
  - Subheading: "2Vault turns your bookmark graveyard into an Obsidian vault. Automatically. With AI."
  - CTA Button: "Install on Chrome" (primary color, large tap target)
  - Secondary CTA: "View on GitHub" (text link)
  - Hero Image: Screenshot of extension popup + resulting Obsidian note side-by-side
    (Show the before/after transformation)
  - Social proof: "Soon" (hold for post-launch: "500+ users" / "4.5★ on Chrome Web Store")
```

**Hero image strategy:**
- Left side: Extension popup with bookmark folder selected, "Process" button highlighted
- Right side: Obsidian vault showing created note with:
  - Clean markdown formatting
  - YAML frontmatter visible
  - Related tags section with wiki-links
  - Graph view showing tag connections
- Centered arrow or animation showing the flow
- Alt text: "2Vault processes bookmarks in seconds and files them into your Obsidian vault with proper tags and categorization"

---

#### Problem Section
```
3-4 Pain Points (Card Layout)

Card 1: "50+ Bookmarks. 3 Reads."
  - Problem: "You bookmark a ton. You read almost none."
  - Solution: "2Vault auto-digests them so you don't have to read the full article."
  - Icon: 📚 (bookmark icon from react-icons)

Card 2: "Generic Folders Don't Cut It"
  - Problem: "Save-it-later tools dump everything into 'Inbox'. No vault integration."
  - Solution: "2Vault reads YOUR vault structure. Files notes into the RIGHT folder."
  - Icon: 🗂️ (folder icon)

Card 3: "Social Media Disappears"
  - Problem: "X/LinkedIn posts get deleted, feeds move on. Lost context."
  - Solution: "2Vault captures posts from DOM before they vanish. Permanent archive."
  - Icon: 🔗 (link icon)

Card 4: "AI Shouldn't Cost $100/mo"
  - Problem: "Most tools charge $10-15/mo. Add API costs on top."
  - Solution: "Bring your own Claude/OpenAI key. ~$0.005 per bookmark."
  - Icon: 💰 (money icon)
```

**Rationale:** Each card solves one specific pain point with concrete contrast (problem -> solution).

---

#### How It Works Section
```
Title: "How It Works"

Timeline/Steps (Vertical on mobile, Horizontal on desktop, max 4 steps)

Step 1: "Select Bookmarks"
  - Illustration: Extension popup screenshot with folder selected
  - Copy: "Open 2Vault, pick a bookmark folder, click Process."

Step 2: "AI Digests"
  - Illustration: LLM processing animation or icon
  - Copy: "2Vault extracts content, summarizes it, and picks the best folder + tags."

Step 3: "Files Automatically"
  - Illustration: Obsidian note appearing in vault folder
  - Copy: "Notes appear in your vault with proper YAML frontmatter and wiki-links."

Step 4: "One Click from Anywhere"
  - Illustration: Keyboard shortcut visualization (Ctrl+Shift+V)
  - Copy: "Use Ctrl+Shift+V on any page to instantly save + process."

Video Option (Nice-to-have, post-MVP):
  - 30-second demo GIF showing: bookmark selection -> processing -> note appears in Obsidian
  - Hosted on Vimeo or as inline MP4 (not YouTube for faster loading)
```

---

#### Features Section
```
Title: "Features Built for Your Vault"

6-Column Feature Grid (3x2)

Feature 1: Vault-Aware Categorization
  - Icon: 🎯 (target)
  - Copy: "Reads your folder structure and existing tags. Files notes where they belong, not in a generic inbox."

Feature 2: Batch Processing
  - Icon: ⚡ (lightning bolt)
  - Copy: "Process 50+ bookmarks in one batch. Select a folder, walk away, done."

Feature 3: Social Media Capture
  - Icon: 🔄 (loop/cycle)
  - Copy: "Captures X posts, LinkedIn posts, and web articles without flaky APIs."

Feature 4: Bring Your Own Key
  - Icon: 🔐 (lock)
  - Copy: "No subscription. Bring your Claude/OpenAI API key. Full cost transparency."

Feature 5: Duplicate Detection
  - Icon: 🚫 (no symbol)
  - Copy: "Won't re-process URLs already in your vault. Smart deduplication."

Feature 6: Open Source (AGPL)
  - Icon: 💻 (code)
  - Copy: "Inspect the code. Run locally. No surveillance. Modify for your needs."

Comparison Table (Optional, Nice-to-Have):
  - Readwise Reader vs 2Vault: (what makes us different)
  - Obsidian Web Clipper vs 2Vault: (batch + AI)
  - Fabric CLI vs 2Vault: (native Chrome + vault integration)
  - Table columns: Feature | Readwise | Obsidian Clipper | 2Vault
  - Shows 2Vault's unique combination
```

---

#### Setup Guide Section
```
Title: "Get Started in 5 Minutes"

3-Step Overview (with expand/collapse for details)

Step 1: Install Extension
  - CTA Button: "Install on Chrome Web Store"
  - Copy: "Add to Chrome, then open the popup to configure."

Step 2: Get Your API Keys
  - Subsection: "Obsidian Local REST API Key"
    - Copy: "Install the 'Obsidian Local REST API' plugin in Obsidian (free, ~300K downloads)"
    - Screenshot: Settings -> Community plugins -> search for 'Local REST API' -> Install
    - Copy: "Enable the plugin. Your API key appears in plugin settings."
    - Screenshot: Plugin settings showing API key field

  - Subsection: "OpenRouter API Key" (Recommended)
    - Copy: "Sign up at https://openrouter.ai (free account). No credit card needed for first 10 requests."
    - Link: https://openrouter.ai/docs/quick-start
    - Screenshot: OpenRouter dashboard showing API key generation
    - Alternative: "Or use your own Claude/OpenAI key"

Step 3: Configure 2Vault
  - Screenshot: Extension settings popup showing:
    - API Key input field
    - Vault URL dropdown (HTTPS://localhost:27124 default)
    - Vault API Key input
    - "Test Connection" button
    - (It shows green checkmark when working)

Troubleshooting (Expandable Section):
  - Q: "Obsidian says 'Port not recognized'"
    A: "The plugin defaults to HTTPS port 27124. If you're on HTTP, use port 27123."
  - Q: "OpenRouter says my API key is invalid"
    A: "Make sure you're using the full key from https://openrouter.ai/keys (starts with 'sk-or-')"
  - Q: "Connection test fails"
    A: "Check that Obsidian is running and the Local REST API plugin is enabled."
  - Link: "Full setup guide" -> to dedicated /docs/setup page (not on landing page)
```

**Rationale:** Collapse details to avoid wall-of-text on landing page. Expandable sections keep it scannable.

---

#### Social Proof Section (Post-Launch)
```
Title: "Loved by Obsidian Power Users"

Testimonial Cards (3-4 quotes, for post-launch):
  Card 1:
    - Quote: "This is exactly what I needed. Finally a way to actually READ my bookmarks in my vault."
    - Author: @username | Platform: Obsidian Discord / Twitter
    - Profile image: (optional)

Card 2:
    - Quote: "Saves me ~$15/mo compared to other tools. I control my data."
    - Author: Reddit user | r/ObsidianMD

Stats Bar:
  - 500+ installs
  - 4.5★ rating (Chrome Web Store)
  - 200+ GitHub stars
```

**Timeline:** Don't include testimonials pre-launch. Placeholder: "Share your experience" -> link to GitHub Issues

---

#### FAQ Section (Collapsible)
```
Q: "Is my data private?"
A: "Yes. 2Vault runs in your browser. Nothing is sent to our servers except to OpenRouter (for LLM processing). Reads your vault locally. You own your vault."

Q: "Can I use ChatGPT instead of Claude?"
A: "Yes. OpenRouter supports 200+ models. Bring any API key."

Q: "What if I already have bookmarks?"
A: "2Vault processes them on demand. Select a folder and click Process. It won't touch your vault until you explicitly run it."

Q: "Does it work offline?"
A: "No, you need internet for the LLM (OpenRouter) and to reach Obsidian. But you own all the code."

Q: "Can I modify the summarization prompts?"
A: "Post-launch. For now, there's a default prompt. Future: custom prompts in settings."

Q: "Will there be a managed/paid tier?"
A: "Yes, planned for later (no subscription yet). For now it's free + BYOK."

Q: "What about other Obsidian sync providers?"
A: "Only Local REST API for MVP. Obsidian Sync, iCloud, etc. are handled by Obsidian itself."
```

---

#### Footer
```
Links:
  - GitHub
  - Twitter/X (@2vault_app or similar)
  - Email (contact form linking to mailto:)
  - Privacy Policy (simple one-pager)
  - License (AGPL-3.0)

Copyright: "2Vault © 2026. Open source under AGPL-3.0."

Call-to-Action: "Ready to get started?" -> Install button (repeats from top)
```

---

### 1.3 Tech Stack (For Solo Dev)

**Recommendation: Minimal, Low-Maintenance Stack**

**Option 1 (Fastest to Launch): Static HTML + CSS**
- Plain HTML + CSS (no build step)
- Hosted on Vercel (free tier) or Netlify (free tier)
- Inline SVG icons or react-icons CSS
- Pros: Zero dependencies, deploy in 5 minutes, easy to update
- Cons: No reusable components, updating copy requires editing HTML

**Option 2 (Slightly More Flexible): Next.js (App Router)**
- Next.js with static export
- React components for reusable sections
- Tailwind CSS for styling
- Hosted on Vercel (auto-deploy from GitHub)
- Pros: Component structure, easy to add blog posts later
- Cons: Build step, more dependencies
- **Recommendation: Start here if you want a blog long-term**

**Option 3 (Middle Ground): Astro**
- Astro for static site generation
- Markdown-based pages
- Fast, minimal JS
- Pros: Perfect for content-heavy sites, great SEO, can add blog easily
- Cons: Different ecosystem

**My Recommendation for 2Vault:** **Option 2 (Next.js App Router)** because:
- You're already TypeScript-proficient
- Vercel integration = 1-click deploys
- Easy to add blog posts, docs pages later
- Components make it easy to iterate (e.g., swap hero image quickly)
- Minimal JS sent to browser (static export)

**Anti-recommendation:** Webflow, no-code builders. They lock you in and can't be version-controlled.

---

### 1.4 Design System

**Aesthetic:** Match Obsidian's vibe (minimal, dark-mode-first, clean typography)

**Color Palette:**
- Primary: `#5e5ce6` (Obsidian purple) or custom brand color
- Secondary: `#1e1e1e` (dark background)
- Accent: `#4ec9b0` (teal, for CTAs)
- Text: `#e8e8e8` (light gray on dark)

**Typography:**
- Headings: System font `-apple-system, BlinkMacSystemFont, "Segoe UI"` (matches Obsidian)
- Body: Same system font (no custom fonts = faster load)
- Line height: 1.6 for readability

**Components:**
- Buttons: Large tap targets (48px min height), clear states (hover, active)
- Cards: Subtle border or shadow (matching Obsidian plugin cards)
- Icons: `react-icons` (IoHome, IoGitBranch, etc.)
- Animations: Minimal. Fade-ins on scroll (Intersection Observer). No auto-playing videos.

**Responsive Design:**
- Mobile-first
- Hero section: Full viewport height on desktop, 80vh on mobile
- Feature cards: 1 column mobile, 2 columns tablet, 3 columns desktop
- Hero image: Stacked (left/right) on desktop, single column on mobile

---

### 1.5 SEO & Discoverability

**Domain:** `2vault.dev` (preferred) or `2vault.app`
- Short, memorable, matches brand
- `.dev` signals open-source/technical

**URL Structure:**
```
2vault.dev/                        (landing page, all content inline)
2vault.dev/docs/setup             (detailed setup guide - link from landing page)
2vault.dev/blog/building-2vault   (post-launch, long-form content)
```

**Meta Tags (Landing Page):**
```
<title>2Vault - AI Bookmark Digester for Obsidian</title>
<meta name="description" content="Chrome extension that digests bookmarks with AI and files them into your Obsidian vault with proper tags and categorization.">
<meta name="og:image" content="/og-image.png">
(1200x630px showing hero screenshot)
<meta name="og:title" content="2Vault - AI Bookmark Digester for Obsidian">
<meta name="og:description" content="Process bookmarks in batches. Vault-aware categorization. Social media capture. BYOK.">
```

**Organic Search Strategy (Post-Launch):**
- Blog post: "How to Organize 500+ Bookmarks with AI and Obsidian" (targets "organize bookmarks")
- Blog post: "Best Obsidian AI Extensions 2026" (affiliate/backlink potential)
- Targeted keywords: Obsidian + bookmark, AI + knowledge management, read-it-later alternatives
- Cross-post to Dev.to, Medium (with backlink to 2vault.dev)

**No-cost discoverability:**
- Twitter/X: Regular posts with demo GIFs
- Reddit: r/ObsidianMD, r/PKMS, r/productivity (not spammy, genuine posts)
- Hacker News: "Show HN: 2Vault" on launch day
- Product Hunt (optional, if you have time)

---

### 1.6 Launch Checklist

**Week of Launch:**
- [ ] Domain + hosting set up
- [ ] Landing page live (mobile-tested)
- [ ] Chrome Web Store listing page filled out
- [ ] Extension reviewed and approved by Chrome Web Store
- [ ] Links in place: Chrome Web Store, GitHub, Twitter
- [ ] Privacy policy + Terms of Service (simple one-pagers)
- [ ] Social media posts drafted (X, Reddit, Discord)
- [ ] Email: Announce to personal newsletter (if you have one)

**Chrome Web Store Listing Fields to Fill:**
- Short description (132 chars): "Batch-process bookmarks with AI. File them into your Obsidian vault with proper tags."
- Detailed description (~500 words): Feature list + key differentiators
- Category: Productivity
- Screenshots (1280x800 minimum, 5 screenshots):
  1. Bookmark browser UI
  2. Processing status
  3. Results in Obsidian vault
  4. Settings page
  5. Social media capture example
- Icon: 128x128px (matches browser icon)
- Privacy policy link: Link to privacy policy on landing page

---

## Part 2: In-Extension Onboarding Flow

### 2.1 Problem Analysis

**Current state (from Settings.tsx):**
- User lands in Settings page
- Sees form fields with no context
- API key validation exists but user doesn't know what values are valid
- No step-by-step guidance for first-time setup

**Pain points:**
1. Users don't know what Obsidian Local REST API plugin is
2. Hard to find the API key in Obsidian settings
3. Unknown if OpenRouter or personal API keys work
4. Vault URL field is cryptic ("https://localhost:27124" - what's this?)
5. No way to tell if setup succeeded until you try processing (then it fails)
6. No "next steps" after setup (should point to bookmark browser)

**User mental model:**
- "I installed 2Vault. Now what?" <- Need super-clear first run experience
- "These API keys are scary. Am I messing up my vault?" <- Need safety/validation
- "Is this working? Where's my Obsidian?" <- Need confirmation at each step

---

### 2.2 Two Approaches: Wizard vs. Guided Settings

**Option A: Dedicated Onboarding Wizard**
- First popup shows: "Welcome to 2Vault. Let's set up in 3 steps"
- Step 1: Obsidian API key
- Step 2: LLM API key (OpenRouter or Claude)
- Step 3: Verify connection
- Finish: "All set! Try processing a bookmark folder"
- Future visits: Settings page (no wizard)

**Pros:**
- Clear, focused flow
- Hides complexity behind "Next" buttons
- Can show help text per step

**Cons:**
- More code to maintain
- Users still need to find API keys somewhere (redirects to docs)
- Extra context switching (popup -> Obsidian -> back)

**Option B: Guided Settings Page with Progressive Disclosure**
- First visit: Settings page with 4 tabs:
  - "Get Started" tab (default, open first)
  - "API Keys" tab (collapsed by default)
  - "Advanced" tab
  - "Help" tab
- "Get Started" shows checklist:
  - [ ] Install Obsidian Local REST API plugin
  - [ ] Copy your API key from plugin settings
  - [ ] Paste here: [input field]
  - [ ] Test connection [button]
  - [After pass] [ ] Get OpenRouter API key
  - [ ] Paste your OpenRouter key: [input field]
  - [ ] Test LLM connection [button]
  - [After pass] "You're all set! [Go to Bookmark Browser]"
- Tab stays open as long as any tests are failing

**Pros:**
- No extra code for wizard (leverages existing Settings.tsx)
- Single source of truth for config (no two-page flows)
- Can expand sections on-demand
- Clear progress indicators (checkmarks)

**Cons:**
- Still need to navigate to Obsidian to copy API key (context switching)
- Requires more thought on visual hierarchy

**My Recommendation: Option B (Guided Settings)**

Rationale: Matches your existing architecture. Minimal code. Clearer mental model for users ("Settings is where setup happens"). Single source of truth.

---

### 2.3 Guided Settings Implementation Plan

**Visual Structure:**

```
┌─────────────────────────────────────────┐
│  2Vault Setup                       [X] │
├─────────────────────────────────────────┤
│                                         │
│  Welcome to 2Vault                      │
│  Let's get your vault connected         │
│  [Progress: 2/4 steps complete]         │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  Step 1: Obsidian Connection [✓]       │
│  ───────────────────────────────────    │
│  Install "Obsidian Local REST API"     │
│  plugin in your vault.                 │
│                                         │
│  [Screenshot of Obsidian plugin page]   │
│  (collapsible/expandable)              │
│                                         │
│  Paste your API key:                   │
│  [sk-***-*** input field]              │
│  [Test Connection button]               │
│  ✓ Connected!                           │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  Step 2: LLM API Key [ ]               │
│  ────────────────────────────────────   │
│  (Click to expand)                      │
│  Option 1: OpenRouter (Recommended)    │
│    - Free to try                        │
│    - Supports all models                │
│    - [Get API Key button]               │
│                                         │
│  Option 2: Claude/OpenAI (Advanced)    │
│    - Bring your own key                 │
│    - Full cost control                  │
│    - [Link to docs]                     │
│                                         │
│  Paste your API key:                   │
│  [sk-*** input field]                  │
│  [Test LLM button]                     │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  Step 3: Vault Settings [ ]            │
│  ────────────────────────────────────   │
│  (Click to expand)                      │
│  Vault URL: [dropdown: HTTPS preset]   │
│  Default Folder: [text input]          │
│  Organization: [ ] PARA  [ ] Custom    │
│                                         │
│  [More options...]                      │
│                                         │
├─────────────────────────────────────────┤
│  [< Back]     [Skip]    [Next >]        │
│           [You're all set!]             │
│        [Go to Bookmark Browser]         │
└─────────────────────────────────────────┘
```

**Tab Structure (Alternative - More Flexible):**

```
┌─────────────────────────────────────────┐
│ [Get Started] [Settings] [Help]      [X]│
├─────────────────────────────────────────┤
│                                         │
│  Get Started tab (visible by default):  │
│  ───────────────────────────────────── │
│                                         │
│  Checklist-style setup:                 │
│  ─────────────────────────────────      │
│                                         │
│  ☑ Obsidian Connection                 │
│    [✓ Connected to https://...]        │
│    [Reconnect]                          │
│                                         │
│  ☐ LLM API Key                         │
│    [Click to setup]                     │
│                                         │
│  ☐ (Optional) Vault Settings           │
│    [Click to customize]                 │
│                                         │
│                                         │
│  Next Steps:                            │
│  ───────────────────────────────────   │
│  Ready to process bookmarks!            │
│  [Go to Bookmark Browser]               │
│  [View Setup Guide]                     │
│                                         │
└─────────────────────────────────────────┘
```

**My Pick: Tab structure (Option 2).** It's cleaner, follows extension UI conventions, and matches Obsidian's sidebar navigation.

---

### 2.4 Onboarding Flow: User Journey

**User opens extension for the first time:**

1. **First Popup:**
   - Current behavior: Shows popup.tsx (defaults to first tab)
   - Desired behavior: Shows "Get Started" tab first
   - Currently Settings.tsx handles all tabs
   - Change: Add `isFirstTime` flag to detect first-time users
   - When `isFirstTime === true`: Show "Get Started" tab. Disable other tabs.

2. **Step 1: Obsidian Connection**
   - User sees: "Connect to Obsidian"
   - Instructions:
     ```
     1. Open Obsidian
     2. Settings > Community plugins > Browse
     3. Search for "Local REST API"
     4. Install + Enable
     5. Copy API Key from plugin settings
     6. Paste below:
     ```
   - Input: [Vault API Key field]
   - Button: [Test Connection]
   - On click: Calls `VaultClient.testConnection()`
   - Result: "Connected to [vault-name]" or "Error: Could not connect"
   - Blocks progression to next step if test fails
   - Link: "Having trouble? [View setup guide]" -> opens in new tab to 2vault.dev/docs/setup

3. **Step 2: LLM API Key**
   - [Collapsed initially, expands when Obsidian connection succeeds]
   - Offer two options:
     - Option A (Default): "Get Free OpenRouter Key"
       - Button: "Sign Up for OpenRouter"
       - Opens: https://openrouter.ai/signup
       - User returns with key, pastes it
       - Input field: [OpenRouter API Key]
     - Option B (Advanced): "Use Your Own API Key"
       - Dropdown: Claude | OpenAI | [Other] (from LLMProvider interface)
       - Input field: [API Key]
       - Link: "Don't have one? [Get API Key]" -> directs to provider signup
   - Button: [Test LLM]
   - On click: Calls `testOpenRouterConnection()` (or provider-specific test)
   - Result: "✓ Connected! Using Google Gemini 2.0 Flash" or "✗ Invalid key"
   - Blocks progression if test fails
   - Error help: "API key must start with 'sk-or-'. [Copy from OpenRouter]"

4. **Step 3: Vault Settings** (Optional, Collapsible)
   - [Collapsed initially]
   - User scrolls or clicks "More Options"
   - Fields:
     - Vault URL: [Dropdown preset] (HTTPS localhost:27124 is default)
     - Default Folder: [Text input] (e.g., "Inbox" or "0-Inbox")
     - Organization: [Radio] PARA | Custom
       - If PARA: Show PARA description
     - Tag Groups: [Link to TagGroupEditor] "Configure later" button
   - Note: "You can change these anytime in Settings"

5. **Final Step: Confirmation**
   - All required tests pass (Obsidian + LLM)
   - Show: Green checkmarks, summary of config
   - Button: [Go to Bookmark Browser]
   - Popup navigates to BookmarkBrowser tab
   - On next open: Default tab is Bookmark Browser (not Settings)

**Error Handling:**

| Error | User Sees | Action |
|-------|-----------|--------|
| Can't reach Obsidian | "Obsidian not running or plugin disabled. [Troubleshoot]" | Stops setup progression. Offer fallback: skip for now |
| Invalid Vault API Key format | "Key format invalid. Must start with 'sk-or-'. [Paste from settings]" | Inline red text. Test button disabled until fixed |
| OpenRouter key too short | "Key too short. Must be 50+ characters." | Same as above |
| LLM connection fails (no internet) | "Can't reach OpenRouter. Check internet connection. [Retry]" | Offer retry, or link to documentation |
| Vault URL can't be reached | "Can't connect to Vault URL. Try a different preset. [Help]" | Show dropdown to select different URL |

---

### 2.5 Code Changes Required

**New/Modified Files:**

```
src/popup/components/
  ├── OnboardingFlow.tsx       [NEW] - Top-level container for first-time flow
  └── OnboardingTabs.tsx       [NEW] - Tab navigation (Get Started | Settings | Help)

src/popup/components/onboarding/
  ├── GetStartedTab.tsx        [NEW] - Checklist-style setup (Obsidian -> LLM -> Vault)
  ├── Step1Obsidian.tsx        [NEW] - Obsidian connection step
  ├── Step2LLM.tsx             [NEW] - LLM API key step
  ├── Step3VaultSettings.tsx   [NEW] - Vault customization (collapsible)
  └── OnboardingComplete.tsx   [NEW] - Congratulations screen

src/popup/components/
  ├── Settings.tsx             [MODIFIED] - Extract onboarding logic, add isFirstTime flag
  └── popup.tsx                [MODIFIED] - Check isFirstTime, render OnboardingFlow vs Settings

src/utils/
  ├── storage.ts               [MODIFIED] - Add "hasCompletedOnboarding" flag
  ├── validation.ts            [MODIFIED] - Enhance validation errors (move format checks here)
  └── onboarding-state.ts      [NEW] - Manage onboarding progress (which steps done, test results)

src/core/
  └── openrouter-provider.ts   [MODIFIED] - Expose testConnection() as public method
```

**State Management:**

```typescript
// New storage key in chrome.storage.sync:
{
  hasCompletedOnboarding: boolean;  // Set to true after step confirmations
  onboardingStep: 'obsidian' | 'llm' | 'vault' | 'complete';  // For resuming
}

// Transient UI state (component state):
{
  obsidianTestResult?: 'success' | 'error';
  obsidianTestError?: string;
  llmTestResult?: 'success' | 'error';
  llmTestError?: string;
  expandedSections: Set<'obsidian' | 'llm' | 'vault'>;
}
```

---

### 2.6 Detailed UX: Step-by-Step Wireframes

**GetStartedTab.tsx Render:**

```
┌──────────────────────────────────────┐
│ 2Vault Setup                      [X]│
├──────────────────────────────────────┤
│                                      │
│  Checklist: 3 Steps to Get Started   │
│                                      │
│  ╭──────────────────────────────────╮│
│  │ ☑ Connect Obsidian            ✓ ││
│  │                                  ││
│  │   Your vault is connected to:   ││
│  │   "My Vault" at                 ││
│  │   https://localhost:27124       ││
│  │                                  ││
│  │   [Reconnect] [Change URL]      ││
│  ╰──────────────────────────────────╯│
│                                      │
│  ╭──────────────────────────────────╮│
│  │ ☐ Set Up LLM API Key          ✗ ││
│  │ Click to expand                  ││
│  │                                  ││
│  │   (Hidden until Obsidian passes) ││
│  ╰──────────────────────────────────╯│
│                                      │
│  ╭──────────────────────────────────╮│
│  │ ☐ (Optional) Vault Settings    ⚙ ││
│  │ Click to expand                  ││
│  ╰──────────────────────────────────╯│
│                                      │
│  Next Steps:                         │
│  ──────────────────────────────────  │
│  [Go to Bookmark Browser]            │
│  [View Setup Documentation]          │
│                                      │
│           [Settings]  [Help]         │
└──────────────────────────────────────┘
```

**Step2LLM.tsx Expanded Render:**

```
┌──────────────────────────────────────┐
│ 2Vault Setup                      [X]│
├──────────────────────────────────────┤
│ ... (checkboxes above)               │
│                                      │
│  ╭──────────────────────────────────╮│
│  │ ☐ Set Up LLM API Key               │
│  │                                    │
│  │   Choose your LLM provider:        │
│  │                                    │
│  │   ( ) OpenRouter [Recommended]    │
│  │       Free to try, all models     │
│  │       [Get OpenRouter Key]        │
│  │                                    │
│  │   (x) Claude Direct              │
│  │       Use your own Claude key    │
│  │       [Get Claude Key]           │
│  │                                    │
│  │   ( ) OpenAI                      │
│  │       Use ChatGPT or GPT-4       │
│  │       [Get OpenAI Key]           │
│  │                                    │
│  │   ───────────────────────────────  │
│  │   Paste your API key:             │
│  │   [sk-*** input field (focused)]  │
│  │                                    │
│  │   [Test LLM]                      │
│  │                                    │
│  │   ✓ Connected! Using Google      │
│  │     Gemini 2.0 Flash on OpenRouter│
│  ╰──────────────────────────────────╯│
│                                      │
│           [Back]    [Next >]         │
└──────────────────────────────────────┘
```

**Error State:**

```
┌──────────────────────────────────────┐
│ 2Vault Setup                      [X]│
├──────────────────────────────────────┤
│                                      │
│  ╭──────────────────────────────────╮│
│  │ ☑ Connect Obsidian            ✗ ││
│  │                                  ││
│  │   Paste Obsidian API Key:        │
│  │   [sk-****** input field]        │
│  │   [Test Connection]              │
│  │                                  │
│  │   ✗ Connection failed            │
│  │   Error: Can't reach Obsidian   │
│  │   at https://localhost:27124    │
│  │                                  │
│  │   Troubleshooting:               │
│  │   - Is Obsidian running?         │
│  │   - Is the plugin enabled?       │
│  │   - Try HTTPS vs HTTP:           │
│  │     [http://localhost:27123]     │
│  │     [https://localhost:27124]    │
│  │                                  │
│  │   [Retry] [View Setup Guide]    │
│  ╰──────────────────────────────────╯│
│                                      │
└──────────────────────────────────────┘
```

---

### 2.7 Help Tab & Links

**Help Tab Content:**

```
What is 2Vault?
- Short explanation + video link (future)

How do I get API keys?
- Obsidian Local REST API
  [Screenshot showing: Obsidian > Settings > Community Plugins > Local REST API]
  [Screenshot showing: Plugin settings > Copy API Key]
- OpenRouter
  [Link to OpenRouter signup]
  [Screenshot: Dashboard > Create Key]

Troubleshooting

Why can't I connect to Obsidian?
  Solution: Check that Obsidian is running and plugin is enabled

Why is my API key invalid?
  Solution: OpenRouter keys start with 'sk-or-'. Claude keys start with 'sk-ant-'

Can I use a different LLM model?
  Yes! OpenRouter supports 200+. Visit OpenRouter dashboard to pick a model.
  2Vault defaults to Google Gemini 2.0 Flash (cheap, fast).

How much does this cost?
  The extension is free. You pay for API calls:
  - Obsidian Local REST API: Free plugin
  - LLM processing: ~$0.005 per bookmark (with Google Gemini 2.0)
  - Estimated: 50 bookmarks = $0.25

Keyboard Shortcut
  Ctrl+Shift+V (Windows/Linux)
  Cmd+Shift+V (Mac)

  Press on any page to instantly capture and process the current URL.

Can I modify the summarization quality?
  Not yet. For now, 2Vault uses a default prompt.
  Future: Custom prompts in Settings.

[Links]
- Full Documentation: 2vault.dev/docs
- GitHub Issues: github.com/2vault/issues
- Discord/Reddit: r/ObsidianMD
```

**Help Tab Layout:**

```
┌──────────────────────────────────────┐
│ [Get Started] [Settings] [Help]   [X]│
├──────────────────────────────────────┤
│                                      │
│  FAQ                                 │
│  ┌──────────────────────────────────┐
│  │ > What is 2Vault?                 │
│  │ > How do I get API keys?          │
│  │ > How much does it cost?          │
│  │ > Troubleshooting                 │
│  │ > Keyboard shortcut               │
│  └──────────────────────────────────┘
│                                      │
│  [Expand all] [Collapse all]        │
│                                      │
│  Resources:                          │
│  [Docs] [GitHub] [Reddit]           │
│  [Email Support]                     │
│                                      │
└──────────────────────────────────────┘
```

---

### 2.8 Success Criteria & Metrics

**User should:**
- [ ] Complete setup in <10 minutes (benchmark: faster than reading docs)
- [ ] Understand what each API key is for (no confusion between Obsidian + LLM keys)
- [ ] Know when setup succeeded (green checkmarks)
- [ ] Be able to recover from errors (actionable help text)
- [ ] Process their first bookmark immediately after setup (no more configuration needed)

**Metrics to track (add to analytics):**

```typescript
// Track in service worker or popup components:
amplitude.track('onboarding_started');
amplitude.track('onboarding_step_completed', {
  step: 'obsidian_connection',
  success: true,
  duration_seconds: 180
});
amplitude.track('onboarding_step_failed', {
  step: 'obsidian_connection',
  error: 'connection_timeout'
});
amplitude.track('onboarding_completed', {
  total_duration_seconds: 480,
  num_retries: 1,
  provider: 'openrouter'
});
amplitude.track('first_bookmark_processed', {
  source: 'onboarding_flow',
  time_since_install: 300  // seconds
});
```

**Post-launch goal:**
- >70% of installs complete onboarding
- >80% of completers process first bookmark within 1 hour
- <5% drop-off at Obsidian connection step (most confusing)
- <10% drop-off at LLM API key step

---

## Part 3: Integrated User Journey

### 3.1 Timeline: Discovery to First Note

```
USER JOURNEY PHASES:

Phase 1: DISCOVERY (Before Install)
  └─> Sees link on Twitter / Reddit / Google
  └─> Lands on 2vault.dev
  └─> Reads headline + hero image
  └─> Clicks "Install on Chrome"
  └─> Chrome Web Store page
  └─> Clicks [Add to Chrome]
  └─> Chrome permission dialog
  └─> [Allow] -> Extension installed

Phase 2: ONBOARDING (First 15 min after install)
  └─> First popup: "Get Started" tab
  └─> Step 1: Connect Obsidian (2 min)
       - User switches to Obsidian
       - Installs Local REST API plugin
       - Copies API key
       - Comes back to 2Vault
       - Pastes key
       - Clicks [Test] -> Success
  └─> Step 2: Get LLM API key (3 min)
       - User clicks [Get OpenRouter Key]
       - Signs up on OpenRouter (2 min)
       - Copies key
       - Returns to 2Vault
       - Pastes key
       - Clicks [Test] -> Success
  └─> Step 3: (Optional) Customize vault settings (2 min)
       - Chooses PARA vs Custom
       - Picks default folder
       - Click [Save]
  └─> Popup shows: [Go to Bookmark Browser]
  └─> Onboarding complete

Phase 3: FIRST PROCESSING (Next 5 min)
  └─> User sees BookmarkBrowser tab (default after onboarding)
  └─> Sees bookmark folder tree
  └─> Clicks a folder with 5-10 bookmarks
  └─> Clicks [Process This Folder]
  └─> ProcessingModal shows:
       - Progress bar
       - Per-URL status (fetching, summarizing, creating)
       - Takes ~30 seconds for 5 bookmarks
  └─> [Done!]
  └─> ResultsSummary shows:
       - 4 bookmarks processed, filed in vault
       - 1 skipped (duplicate)
       - [View in Obsidian]
  └─> User opens Obsidian
  └─> Sees new notes with proper frontmatter, tags, wiki-links
  └─> Reads summaries instead of full articles
  └─> Amazed. Posts on Reddit.

Phase 4: RETENTION (1 week later)
  └─> User processes more bookmarks weekly
  └─> Customizes tag groups for consistency
  └─> Notices tag hub notes creating graph connections
  └─> Loves the vault integration

RISK DROP-OFF POINTS:
  1. Discovering Obsidian Local REST API plugin (Step 1)
     Mitigation: Screenshots + link to 2vault.dev/docs/setup
  2. Getting API key URL (Step 2)
     Mitigation: Direct link [Get OpenRouter Key] opens signup
  3. Vault URL configuration
     Mitigation: Dropdown presets, default to HTTPS
  4. First processing fails (e.g., API key invalid)
     Mitigation: Error categories + actionable suggestions in ResultsSummary
```

---

### 3.2 Page Flow Diagram

```
2vault.dev/
  ├─ Hero: "Paste your bookmarks"
  ├─ CTA: [Install on Chrome]
  │   └─> Chrome Web Store
  │       └─> [Add to Chrome]
  │           └─> Extension installs
  │
  ├─ How It Works section
  ├─ Features section
  ├─ Setup Guide section
  │   └─ 3-step overview
  │   └─ Links: 2vault.dev/docs/setup
  │       ├─ Detailed Obsidian REST API setup
  │       ├─ OpenRouter signup walkthrough
  │       ├─ Troubleshooting
  │       └─ FAQ
  │
  ├─ Footer links
  │   ├─ GitHub (readme, star)
  │   ├─ Twitter (follow for updates)
  │   ├─ Privacy Policy
  │   └─ Discord/Reddit (community)
  │
  └─ Blog (Post-launch)
      ├─ "Building 2Vault in 3 weeks"
      ├─ "Obsidian AI extensions 2026"
      └─ Updates

In-Extension Flow:
  ├─ First install: OnboardingFlow (Get Started tab)
  │   ├─ Step 1: Obsidian Connection
  │   ├─ Step 2: LLM API Key
  │   ├─ Step 3: Vault Settings
  │   └─ [Go to Bookmark Browser]
  │
  ├─ BookmarkBrowser tab (default after onboarding)
  │   ├─ Folder tree
  │   ├─ [Process This Folder]
  │   ├─ [Or paste URLs above]
  │   └─> ProcessingModal -> ResultsSummary
  │
  ├─ ProcessingStatus tab (shows ongoing/recent)
  │   └─ Per-URL status + results
  │
  └─ Settings tab (revisit later)
      ├─ API keys
      ├─ Vault customization
      ├─ Tag groups
      └─ [Reconnect / Test buttons]
```

---

### 3.3 Messaging: Key Value Propositions by Audience Segment

**For Obsidian Power Users:**
- "Vault-aware categorization. Your folders, your tags. Not a generic inbox."
- "Brings social media content (X/LinkedIn) into your permanent knowledge base."
- "Duplicates won't flood your vault. Smart deduplication."

**For Knowledge Workers (Non-Obsidian Users):**
- "Finally process your bookmarks instead of saving and forgetting."
- "AI summaries mean you don't need to read 50 long articles."
- "BYOK = no subscription. Pay per-use, stay in control."

**For Privacy-Conscious Users:**
- "Open source (AGPL). Inspect the code. No surveillance."
- "Your data stays in your vault. Runs in your browser."
- "API keys in your hands. No vendor lock-in."

**For Cost-Conscious Users:**
- "50 bookmarks = ~$0.25 in LLM costs (with Gemini). No $15/mo subscription."
- "Free extension. Only pay for what you use."

---

## Part 4: Implementation Priority & Timeline

### 4.1 MVP (Week 1-2 post-extension-launch)

**Landing Page (1 week):**
- [ ] Domain + hosting (Vercel + GitHub)
- [ ] Single-page landing with sections: Hero, Problem, How It Works, Features, Setup Guide, Footer
- [ ] Mobile-responsive
- [ ] Links to Chrome Web Store (when approved)
- [ ] Links to GitHub
- [ ] Minimal copy (aim for <3 minutes reading time)

**In-Extension Onboarding (1 week):**
- [ ] Detect first-time user (isFirstTime flag)
- [ ] Modify Settings.tsx to show GetStartedTab first
- [ ] Obsidian connection step with [Test Connection]
- [ ] LLM API key step with provider selector
- [ ] Vault settings step (collapsible, optional)
- [ ] Completion screen with [Go to Bookmark Browser]

**Total effort:** ~80 hours (1 week solo dev, 2 weeks part-time)

---

### 4.2 V1 (Week 2-3)

**Landing Page Polish:**
- [ ] FAQ section (collapsible)
- [ ] Feature comparison table (vs Readwise, Obsidian Clipper, etc.)
- [ ] Testimonials (placeholder section for post-launch)
- [ ] Copy refinement based on early user feedback

**In-Extension Onboarding:**
- [ ] Help tab with detailed FAQ
- [ ] Inline video (30s demo, hosted on Vimeo or as MP4)
- [ ] Better error messages with troubleshooting links
- [ ] Skip button for advanced users who want to set up manually

**Analytics:**
- [ ] Track onboarding step completions
- [ ] Track time-to-first-process
- [ ] Track drop-off points

---

### 4.3 Post-Launch (Week 4+)

**Landing Page Growth:**
- [ ] Blog post: "Building 2Vault in 3 weeks"
- [ ] SEO blog posts (target keywords: Obsidian AI, bookmark management)
- [ ] Testimonials (collect from early users)
- [ ] YouTube short (30s demo)

**In-Extension Enhancements:**
- [ ] Custom LLM prompt editing
- [ ] Preview before creating notes
- [ ] Settings > Onboarding tab (for re-onboarding)

---

## Part 5: Quick Start for You

**Immediate Actions (Next 2 Days):**

1. **Choose landing page tech stack**
   - Recommendation: Next.js App Router + Vercel
   - Time: 1 hour setup

2. **Create landing page structure**
   - HTML/components for: Hero, Problem, How It Works, Features, Setup Guide, FAQ
   - Time: 4 hours

3. **Gather hero image**
   - Screenshot: Extension popup (left) + Obsidian note (right) with arrow
   - Time: 1 hour (screenshot + Figma/Photoshop)

4. **Plan onboarding flow**
   - Wireframes for: GetStartedTab, Step1Obsidian, Step2LLM, Step3Vault
   - Time: 2 hours (sketch in Figma or on paper)

5. **Estimate implementation**
   - Landing page: 4-6 hours
   - Onboarding: 8-12 hours
   - Total: 12-18 hours = 2-3 days of focused work

---

## Summary: Your Roadmap

| Phase | Scope | Timeline | Effort | Metrics |
|-------|-------|----------|--------|---------|
| **Landing Page MVP** | Single page: Hero, Problem, How It Works, Features, Setup, CTA | Week 1 | 4-6h | >60% click "Install" |
| **Onboarding MVP** | Get Started tab: 3 checklist steps, test buttons, skip option | Week 1 | 6-8h | >70% completion rate |
| **V1 Polish** | FAQ, comparison table, inline video, help tab | Week 2 | 4-6h | <5% Obsidian connection drop-off |
| **Post-Launch Growth** | Blog, SEO, testimonials, YouTube | Week 3+ | 4-8h | 50+ GitHub stars, 200+ installs |

**Success definition:**
- Landing page: Users understand what 2Vault does in <30 seconds
- Onboarding: Users complete setup without leaving the extension in <15 minutes
- First process: Users process their first bookmark within 1 hour of install
- Retention: >70% of users who complete onboarding process bookmarks again in week 2

---

**Next Steps:**

1. Review this document and provide feedback (anything feel missing?)
2. Decide on landing page tech stack
3. Create Figma wireframes for landing page + onboarding screens
4. Build landing page (4-6 hours)
5. Build onboarding flow (6-8 hours)
6. Test with 5-10 beta users before public launch

I'm ready to help you build either piece. Which would you like to tackle first?
