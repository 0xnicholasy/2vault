# Visual Flow Diagrams: Landing Page + Onboarding

ASCII diagrams and flow charts for quick reference during implementation.

---

## Landing Page Sections (Top-to-Bottom)

```
┌─────────────────────────────────────────────────────────────┐
│                         NAVIGATION (sticky)                  │
│  Logo  [Home] [How It Works] [Setup] [GitHub]    [Install]  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                            HERO                              │
│                                                              │
│    Headline: "Paste your bookmarks. Get organized knowledge."│
│    Subheading: "2Vault turns your bookmark graveyard into   │
│               an Obsidian vault. Automatically. With AI."    │
│                                                              │
│             [Install on Chrome]  [View on GitHub]           │
│                                                              │
│              [Screenshot of transformation]                  │
│              [Extension UI] ──→ [Obsidian note]            │
│              (Before/After side-by-side)                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      PROBLEM SECTION                         │
│                                                              │
│  Title: "Why Bookmarks Don't Work"                           │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │📚 50+ Read 3│  │🗂️ Generic Box│  │🔗 Lost       │      │
│  │            │  │             │  │             │      │
│  │You bookmark│  │Save-it-later│  │X/LinkedIn   │      │
│  │tons. Read  │  │tools dump   │  │posts get    │      │
│  │almost none.│  │everything   │  │deleted.     │      │
│  │2Vault: AI  │  │into inbox.  │  │2Vault:      │      │
│  │summaries   │  │2Vault: reads│  │captures     │      │
│  │            │  │YOUR vault   │  │before they  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│  ┌──────────────┐                                            │
│  │💰 Expensive │                                            │
│  │            │                                            │
│  │Other tools:│                                            │
│  │$10-15/mo + │                                            │
│  │API costs   │                                            │
│  │2Vault: Free│                                            │
│  │BYOK, $0.01 │                                            │
│  │per bookmark│                                            │
│  └──────────────┘                                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   HOW IT WORKS SECTION                       │
│                                                              │
│  Title: "How It Works"                                       │
│                                                              │
│  Step 1          Step 2          Step 3          Step 4     │
│  ────────        ────────        ────────        ────────    │
│                                                              │
│  [Screenshot]   [Processing]    [Note appears]  [Shortcut]  │
│  of extension   animation/icon  in vault with   Ctrl+Shift+V│
│  bookmark tree                  proper tags     on any page │
│                                                              │
│  "Select a      "AI Summarizes  "Notes appear   "Or use     │
│   Bookmark      & Categorizes   with proper     Ctrl+Shift+V│
│   Folder"       Content"        Formatting"     to capture" │
│                                                              │
│  1 ──→ 2 ──→ 3 ──→ 4                                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    FEATURES SECTION                          │
│                                                              │
│  Title: "Features Built for Your Second Brain"              │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │🎯 Vault-    │  │⚡ Batch       │  │🔄 Captures  │      │
│  │ Aware       │  │ Processing   │  │ Social Media│      │
│  │             │  │             │  │            │      │
│  │Reads your   │  │Process 50+  │  │X/LinkedIn  │      │
│  │folder       │  │bookmarks    │  │posts via   │      │
│  │structure    │  │in one click  │  │DOM (no API)│      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │🔐 BYOK       │  │🚫 Smart       │  │💻 Open      │      │
│  │              │  │ Deduplication│  │ Source      │      │
│  │No API key    │  │             │  │            │      │
│  │costs, you    │  │Won't reprocess│  │AGPL-3.0    │      │
│  │control       │  │duplicates    │  │Inspect code│      │
│  │pricing       │  │             │  │            │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   SETUP GUIDE SECTION                        │
│                                                              │
│  Title: "Get Started in 5 Minutes"                           │
│                                                              │
│  [1. Install Extension]                                      │
│      Button: [Install on Chrome]                             │
│      Copy: "Click to add to Chrome"                          │
│                                                              │
│  [2. Get Your API Keys]                                      │
│      A. Obsidian Local REST API                             │
│         Steps & screenshots...                               │
│         "Copy your API key"                                  │
│      B. OpenRouter API (Recommended)                         │
│         Steps & screenshots...                               │
│         "Sign up free, no credit card"                       │
│      C. Or use Claude/OpenAI directly                        │
│                                                              │
│  [3. Configure 2Vault]                                       │
│      Screenshot of settings popup                            │
│      "Paste keys, click Test, done"                          │
│                                                              │
│  [Troubleshooting (Collapsible)]                             │
│      Q: "What's the difference between these keys?"          │
│      Q: "Can I use ChatGPT instead?"                         │
│      Q: "Connection test fails"                              │
│      etc.                                                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    FOOTER                                    │
│                                                              │
│  Links: GitHub | Twitter | Email | Privacy Policy | License │
│                                                              │
│  Copyright: 2Vault © 2026. Open source under AGPL-3.0.     │
│                                                              │
│  [Ready to get started?] [Install on Chrome]               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Extension Onboarding Flow

### First Install

```
User installs extension
        ↓
┌─────────────────────────────────────────┐
│   Extension opens popup for first time  │
├─────────────────────────────────────────┤
│  Check: isFirstTimeUser() === true?     │
└─────────────────────────────────────────┘
        ↓ YES
┌─────────────────────────────────────────┐
│      Show OnboardingFlow Component      │
│  (GetStartedTab, HelpTab visible)       │
│  (BookmarkBrowser, Settings hidden)     │
└─────────────────────────────────────────┘
        ↓
   User in GetStartedTab
```

### GetStartedTab - Checklist View

```
┌────────────────────────────────────────────┐
│ 2Vault Setup                            [X]│
├────────────────────────────────────────────┤
│                                            │
│  Welcome to 2Vault                         │
│  Let's get your vault connected            │
│  [Progress: 1/3 steps complete]            │
│                                            │
├────────────────────────────────────────────┤
│                                            │
│  ☑ Obsidian Connection               ✓    │
│  Connected to "My Vault"                   │
│  https://localhost:27124                   │
│  [Reconnect]                               │
│                                            │
│  ────────────────────────────────────────  │
│                                            │
│  ☐ LLM API Key                             │
│  Click to expand...                        │
│  (Hidden until Obsidian passes)            │
│                                            │
│  ────────────────────────────────────────  │
│                                            │
│  ☐ (Optional) Vault Settings              │
│  Click to expand...                        │
│                                            │
│                                            │
│  Next Steps:                               │
│  [Go to Bookmark Browser]                  │
│  [View Help]                               │
│                                            │
└────────────────────────────────────────────┘
```

### Step 1: Obsidian Connection (Expanded)

```
┌────────────────────────────────────────────┐
│ ☑ Obsidian Connection               [Edit]│
├────────────────────────────────────────────┤
│                                            │
│  Install "Obsidian Local REST API"        │
│  plugin in Obsidian                        │
│                                            │
│  [Screenshot showing plugin settings]      │
│                                            │
│  Paste your API key:                       │
│  [sk-*** input field]                      │
│  [Test Connection]                         │
│                                            │
│  ✓ Connected to "My Vault"                 │
│  (Green checkmark + success message)       │
│                                            │
└────────────────────────────────────────────┘
```

### Step 2: LLM API Key (Expanded)

```
┌────────────────────────────────────────────┐
│ ☐ LLM API Key                              │
├────────────────────────────────────────────┤
│                                            │
│  Choose your LLM provider:                 │
│                                            │
│  ( ) OpenRouter [Recommended]              │
│      Free to try, supports all models      │
│      [Get OpenRouter Key]                  │
│                                            │
│  (•) Claude Direct                         │
│      Use your own Claude API key           │
│      [Get Claude Key]                      │
│                                            │
│  ( ) OpenAI                                │
│      Use ChatGPT or GPT-4                  │
│      [Get OpenAI Key]                      │
│                                            │
│  ────────────────────────────────────────  │
│                                            │
│  Paste your API key:                       │
│  [sk-ant-*** input field (error)]          │
│  ✗ Key too short (must be 50+ chars)       │
│                                            │
│  [Test LLM]                                │
│                                            │
│  [Help] [Learn more about API keys]        │
│                                            │
└────────────────────────────────────────────┘
```

### Step 2: LLM Success

```
┌────────────────────────────────────────────┐
│ ☑ LLM API Key                         ✓    │
│                                            │
│  ✓ Connected! Using Google Gemini 2.0     │
│    Flash on OpenRouter                     │
│                                            │
│  [Change Provider]                         │
│                                            │
└────────────────────────────────────────────┘
```

### Error State Example

```
┌────────────────────────────────────────────┐
│ ☐ Obsidian Connection                      │
├────────────────────────────────────────────┤
│                                            │
│  Paste your API key:                       │
│  [sk-*** input field]                      │
│  [Test Connection]                         │
│                                            │
│  ✗ Connection failed                       │
│  Error: Can't reach Obsidian at            │
│  https://localhost:27124                   │
│                                            │
│  Next steps:                               │
│  1. Check that Obsidian is running         │
│  2. Enable the Local REST API plugin       │
│  3. Try a different vault URL:             │
│     [http://localhost:27123] (HTTP)        │
│     [https://localhost:27124] (HTTPS)      │
│                                            │
│  [Retry] [View Setup Guide]                │
│                                            │
└────────────────────────────────────────────┘
```

### Completion Screen

```
┌────────────────────────────────────────────┐
│ You're all set!                         [X]│
├────────────────────────────────────────────┤
│                                            │
│  ✓ Obsidian Connection                     │
│  ✓ LLM API Key                             │
│  ✓ Vault Settings (optional)               │
│                                            │
│  Your vault: "My Vault"                    │
│  Organization: PARA                        │
│  LLM Provider: Google Gemini 2.0           │
│                                            │
│                                            │
│  Ready to process bookmarks!               │
│                                            │
│  [Go to Bookmark Browser]                  │
│  [View Help] [Settings]                    │
│                                            │
│  Next: Select a bookmark folder and        │
│  click [Process] to get started.            │
│                                            │
└────────────────────────────────────────────┘
```

---

## Tab Navigation

### GetStartedTab (Active During Onboarding)

```
┌──────────────────────────────────────────────────────────┐
│ [Get Started] [Help]                                  [X]│
├──────────────────────────────────────────────────────────┤
│                                                          │
│  (Onboarding checklist and steps)                        │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### HelpTab (Active During Onboarding)

```
┌──────────────────────────────────────────────────────────┐
│ [Get Started] [Help]                                  [X]│
├──────────────────────────────────────────────────────────┤
│                                                          │
│  FAQ                                                    │
│  ┌──────────────────────────────────────────────────┐   │
│  │ > What is 2Vault?                                │   │
│  │   2Vault is a Chrome extension that...           │   │
│  │                                                  │   │
│  │ > How do I get API keys?                         │   │
│  │   Obsidian key: [link]                           │   │
│  │   OpenRouter key: [link]                         │   │
│  │                                                  │   │
│  │ > Troubleshooting                                │   │
│  │   If you see X error, do Y                       │   │
│  │                                                  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  [Expand all] [Collapse all]                            │
│                                                          │
│  Resources:                                             │
│  [Docs] [GitHub] [Discord] [Email]                      │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Post-Onboarding Tabs (After Completion)

```
┌──────────────────────────────────────────────────────────┐
│ [Bookmarks] [Status] [Settings] [Help]               [X]│
├──────────────────────────────────────────────────────────┤
│                                                          │
│  (Normal extension UI)                                  │
│  Default: BookmarkBrowser tab                           │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## User Journey Swimlane

```
Timeline
│
Day 0: Discovery & Install
│  User sees X/Twitter post → Clicks link → Lands on 2vault.dev
│  ├─ Scans hero section (30 seconds)
│  ├─ Reads problem section (1 minute)
│  └─ Clicks [Install on Chrome]
│       └─ Chrome Web Store page
│           └─ Clicks [Add to Chrome]
│               └─ Extension installed ✓
│
Day 0-1: Onboarding
│  User opens extension popup
│  ├─ Sees GetStartedTab (welcome)
│  ├─ Step 1: Connect Obsidian (2-3 minutes)
│  │   ├─ Switches to Obsidian
│  │   ├─ Installs Local REST API plugin
│  │   ├─ Copies API key
│  │   └─ Returns to 2Vault
│  │       └─ [Test Connection] ✓
│  │
│  ├─ Step 2: Get LLM Key (3-5 minutes)
│  │   ├─ Clicks [Get OpenRouter Key]
│  │   ├─ Signs up for free account
│  │   ├─ Copies API key
│  │   └─ Returns to 2Vault
│  │       └─ [Test LLM] ✓
│  │
│  ├─ (Optional) Step 3: Vault Settings (1-2 minutes)
│  │   └─ Selects PARA / Custom
│  │
│  └─ [Go to Bookmark Browser]
│      └─ Sees BookmarkBrowser tab ✓
│
Day 1: First Process
│  User in BookmarkBrowser tab
│  ├─ Selects folder with 5-10 bookmarks
│  ├─ Clicks [Process This Folder]
│  ├─ Sees ProcessingStatus (progress bar, per-URL status)
│  │   └─ Takes ~30 seconds
│  ├─ [Done!]
│  └─ Sees ResultsSummary
│      ├─ 4 bookmarks processed
│      ├─ 1 skipped (duplicate)
│      └─ [View in Obsidian]
│          └─ Opens Obsidian
│              └─ Sees new notes with summaries ✓
│
Day 2-7: Ongoing Use
│  User processes more bookmarks
│  ├─ Weekly routine: Click extension → Process folder → Done
│  ├─ Uses Ctrl+Shift+V shortcut for individual URLs
│  ├─ Customizes tag groups
│  ├─ Notices tag hub notes creating graph connections
│  └─ ❤️ Loves it, posts on Reddit/Discord
```

---

## Conversion Funnel

```
Discovery (Landing Page)
│
└─→ 100 visitors
    │
    ├─→ 60% read past hero
    │
    ├─→ 40% scroll to setup guide
    │
    └─→ 25% click "Install on Chrome"
        │
        └─→ 20% (5 per 100 visitors) install extension ✓

Installation (Chrome Web Store)
│
└─→ 100 installs
    │
    ├─→ 80% open extension (80)
    │
    ├─→ 70% start onboarding (56)
    │
    ├─→ 85% complete Obsidian step (48)
    │
    ├─→ 80% complete LLM key step (38)
    │
    └─→ 70% complete onboarding (27) ✓

First Process (BookmarkBrowser)
│
└─→ 27 completers
    │
    ├─→ 90% see BookmarkBrowser tab (24)
    │
    ├─→ 75% select a folder (18)
    │
    ├─→ 70% click Process (12-13)
    │
    └─→ 60% process successfully (7-8) ✓

Retention (Week 2)
│
└─→ 8 successful processors
    │
    └─→ 50% return and process again (4) ✓
```

**Key metrics:**
- Landing page → Install: 25% (5 per 100 visitors)
- Install → Onboarding complete: 27% (if 100 installs)
- Onboarding complete → First process: 50% (if 27 completers)
- First process → Week 2 retention: 50% (if 8 processors)

**Overall conversion:** 100 visitors → ~0.5 weekly active users

---

## Component Dependency Graph

```
app/page.tsx (Landing Page)
├─ Navigation.tsx
├─ Hero.tsx
│   ├─ Button.tsx
│   └─ Image component
├─ ProblemSection.tsx
│   └─ ProblemCard.tsx
├─ HowItWorks.tsx
│   └─ Step.tsx
├─ Features.tsx
│   └─ FeatureCard.tsx
├─ SetupGuide.tsx
│   ├─ StepAccordion.tsx
│   └─ FAQ.tsx
├─ Footer.tsx
│   └─ Link components
└─ (PostLaunch) Testimonials.tsx
    └─ TestimonialCard.tsx

popup/popup.tsx (Extension Popup)
├─ useFirstTimeUser() hook
├─ isFirstTime === true → OnboardingFlow.tsx
│   ├─ OnboardingTabs.tsx
│   │   ├─ GetStartedTab.tsx
│   │   │   ├─ StepCard.tsx
│   │   │   ├─ Step1Obsidian.tsx
│   │   │   ├─ Step2LLM.tsx
│   │   │   ├─ Step3VaultSettings.tsx
│   │   │   └─ OnboardingComplete.tsx
│   │   └─ HelpTab.tsx
│   │       ├─ FAQ.tsx
│   │       └─ Links
│   └─ useOnboardingState() hook
│
└─ isFirstTime === false → NormalFlow.tsx
    ├─ BookmarkBrowser.tsx
    ├─ ProcessingStatus.tsx
    ├─ ResultsSummary.tsx
    └─ Settings.tsx
```

---

## State Flow

### First Install

```
chrome.storage.sync:
  hasCompletedOnboarding: false
  onboardingStep: "obsidian"

Component:
  popup.tsx:
    isFirstTime = true
    → render OnboardingFlow

GetStartedTab:
  expandedSections: { 'obsidian' }
  obsidianTestResult: undefined
  llmTestResult: undefined

Step1Obsidian:
  vaultApiKey: ""
  testLoading: false
  testError: undefined
  testSuccess: false
```

### After Obsidian Test Passes

```
chrome.storage.sync:
  vaultUrl: "https://localhost:27124"
  vaultApiKey: "sk-***"
  vaultName: "My Vault"

Component:
  GetStartedTab:
    expandedSections: { 'llm' }  ← LLM section now visible
    obsidianTestResult: "success"

Step2LLM:
  provider: "openrouter"
  apiKey: ""
  testLoading: false
  testError: undefined
  testSuccess: false
```

### After LLM Test Passes

```
chrome.storage.sync:
  apiKey: "sk-or-***"
  llmProvider: "openrouter"

Component:
  GetStartedTab:
    obsidianTestResult: "success"
    llmTestResult: "success"
    ← Shows [Go to Bookmark Browser] button

Step3VaultSettings:
  vaultOrganization: "para" (pre-selected)
  defaultFolder: "Inbox"
  tagGroups: []
```

### Onboarding Complete

```
chrome.storage.sync:
  hasCompletedOnboarding: true
  onboardingStep: "complete"

Component:
  popup.tsx:
    isFirstTime = false
    → render NormalFlow
    → default tab = BookmarkBrowser

User sees:
  [Bookmarks] [Status] [Settings] [Help] tabs
```

---

This should give you a complete visual roadmap for implementation.
