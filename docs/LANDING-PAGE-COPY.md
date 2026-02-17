# Landing Page Copy & Assets

Reference doc: Concrete messaging, copy examples, and asset specifications for 2vault.dev landing page.

Use these as starting points—iterate based on early user feedback.

---

## Hero Section

### Headline (Most Important)
```
"Paste your bookmarks. Get organized knowledge."
```

**Why it works:**
- Verb-focused ("Paste") = actionable
- Problem → solution ("bookmarks" -> "organized knowledge")
- Shorter than alternatives: "Turn your bookmarks into an organized Obsidian vault with AI"

**Alternatives (test these):**
- "The bookmarks you actually read" (focuses on quality vs quantity)
- "From bookmark graveyard to knowledge base" (more descriptive, longer)
- "Batch-process bookmarks into Obsidian" (technical, less compelling)

### Subheading
```
"2Vault turns your bookmark graveyard into an Obsidian vault. Automatically. With AI."
```

**Why it works:**
- Builds on headline
- Three clauses: What → How → Tool
- "Graveyard" = relatable metaphor

**Alternatives:**
- "Select a bookmark folder. 2Vault summarizes, categorizes, and files notes into your vault."
- "An AI Chrome extension that understands your Obsidian vault. Process bookmarks in batches. Capture X/LinkedIn posts. Own your data."

### Call-to-Action
```
[Install on Chrome]
```
**Style:** Large button, primary color, high contrast
**Size:** 48px height, 200px+ width
**Placement:** Hero image lower-right. Also appears in top nav (sticky) for mobile.

### Hero Image
```
Layout: 2-column (desktop), 1-column stacked (mobile)

LEFT: Extension Popup Screenshot (60% width)
  - Shows BookmarkBrowser tab
  - Displays folder tree with 3-4 bookmark folders
  - Shows URL count per folder
  - Highlights "Process This Folder" button
  - Annotation: "1. Select bookmark folder"

ARROW / ANIMATION (center)
  - Big arrow or "→" with "2Vault processes" label
  - Or animated flow showing data passing through

RIGHT: Obsidian Vault Result (60% width)
  - Shows created note in vault with:
    - Filename: "2vault-processes-your-bookmarks.md"
    - YAML frontmatter (source, tags, date, status visible)
    - Summary section
    - Key Takeaways
    - Related Tags with [[wiki-links]]
  - Annotation: "2. Notes appear with proper tags + format"
  - Optional: Show Obsidian graph view peeking in corner

CAPTION (below both):
"From bookmarks to knowledge in seconds"
```

**Technical specs:**
- Image size: 1200x600px (desktop), 600x800px (mobile, stacked)
- Format: PNG or WebP (compress to <200KB)
- Alt text: "2Vault processes bookmarks in seconds and files them into your Obsidian vault with proper formatting and tags"

**How to create:**
1. Take screenshot of real 2Vault popup (your own extension with test data)
2. Take screenshot of real Obsidian note (from your vault)
3. Crop to show key details
4. Add in Figma/Photoshop: Arrow + annotations + caption
5. Export at 1200x600 (or 2x for Retina)

---

## Problem Section

### Section Title
```
"Why Bookmarks Don't Work"
```

### Card 1: Quantity Over Quality
**Headline:** "50+ Bookmarks. 3 Reads."
**Icon:** 📚 (use react-icons `IoBooksSharp` or similar)
**Copy:**
```
You bookmark a ton. You read almost none. The intention is there.
The follow-through isn't.

2Vault gives you AI-written summaries so you can consume the key ideas
without reading 20-page articles.
```

### Card 2: Generic Folders Don't Work
**Headline:** "Your Vault Deserves Better Than 'Inbox'"
**Icon:** 🗂️ (`IoFolderSharp`)
**Copy:**
```
Most bookmark tools dump everything into a catch-all folder.
Your Obsidian vault is organized. Your knowledge structure matters.

2Vault reads your vault structure and files each bookmark in the
RIGHT folder with the RIGHT tags. It understands PARA.
```

### Card 3: Social Media Disappears
**Headline:** "X Threads Vanish. Catch Them First."
**Icon:** 🔗 (`IoLink`)
**Copy:**
```
That brilliant X thread? Deleted. That LinkedIn post from the founder?
Lost in the feed. Gone forever.

2Vault captures X and LinkedIn posts before they disappear.
Permanent archive in your vault.
```

### Card 4: AI Shouldn't Be Expensive
**Headline:** "BYOK. Not $15/mo."
**Icon:** 💰 (`IoWallet`)
**Copy:**
```
Other tools charge $10-15/mo PLUS API costs on top.

2Vault is free. Bring your own Claude/OpenAI API key.
~$0.005 per bookmark. Transparent pricing. You control costs.
```

---

## Features Section

### Section Title
```
"Features Built for Your Second Brain"
```

### Feature Grid (6 columns, 2 rows)

**Feature 1: Vault-Aware**
- Icon: 🎯
- Headline: "Vault-Aware Categorization"
- Copy: "Reads your folder structure, PARA system, and tag taxonomy. Files notes where they belong."

**Feature 2: Batch Processing**
- Icon: ⚡
- Headline: "Batch Processing"
- Copy: "Select a bookmark folder. Process 50+ URLs in one click. Done in minutes."

**Feature 3: Social Media**
- Icon: 🔄
- Headline: "Captures X & LinkedIn"
- Copy: "DOM extraction, no flaky APIs. Grab X threads, LinkedIn posts before they vanish."

**Feature 4: BYOK**
- Icon: 🔐
- Headline: "Bring Your Own Key"
- Copy: "No subscription. Use Claude, OpenAI, or any model via OpenRouter. Full cost control."

**Feature 5: Smart Deduplication**
- Icon: 🚫
- Headline: "Duplicate Detection"
- Copy: "Won't re-process URLs already in your vault. Searches by source URL, ignores tracking params."

**Feature 6: Open Source**
- Icon: 💻
- Headline: "Open Source (AGPL-3.0)"
- Copy: "Inspect the code. Run locally. Modify for your needs. No vendor lock-in."

---

## Comparison Table (Optional)

### Title
```
"2Vault vs Alternatives"
```

### Table
```
| Feature | Readwise Reader | Obsidian Web Clipper | Fabric CLI | 2Vault |
|---------|-----------------|----------------------|------------|--------|
| AI Summarization | ✓ | ✗ | DIY | ✓ |
| Batch Processing | ✗ | ✗ | Manual CLI | ✓ |
| Obsidian Native | Highlights only | ✓ (but no AI) | ✗ | ✓ |
| Vault-Aware | ✗ | ✗ | ✗ | ✓ |
| Captures X/LinkedIn | Twitter sync only | ✗ | ✗ | ✓ (DOM) |
| PARA Organization | ✗ | ✗ | ✗ | ✓ |
| Free/BYOK | Subscription | Free | Free | ✓ |
| Cost per bookmark | $0.012-0.015/mo | $0 | DIY | $0.005 |
```

**Legend:**
- ✓ = Supported
- ✗ = Not supported
- DIY = User-configurable (complex)
- Blank = Not applicable

---

## Setup Guide Section

### Section Title
```
"Get Started in 5 Minutes"
```

### Step 1: Install
**Headline:** "1. Install the Extension"
**Copy:**
```
Click the button below to add 2Vault to Chrome.
It takes 10 seconds.
```
**CTA Button:** "Install on Chrome" (same as hero)

### Step 2: Get API Keys
**Headline:** "2. Get Your API Keys"

**Subsection A: Obsidian REST API**
```
Install the "Obsidian Local REST API" plugin (free, ~300K downloads)

1. Open Obsidian
2. Settings > Community Plugins > Browse
3. Search for "Local REST API"
4. Click Install, then Enable
5. Copy your API key from plugin settings

[Screenshot showing plugin settings page with API key visible]
```

**Subsection B: OpenRouter API (Recommended)**
```
Sign up for a free OpenRouter account (no credit card needed)

1. Visit https://openrouter.ai/signup
2. Create account
3. Go to https://openrouter.ai/keys
4. Click "Create API Key"
5. Copy your key

Your first 10 requests are free to try. Then pay-as-you-go (~$0.005 per bookmark).

Alternative: Bring your own Claude or OpenAI API key instead.
```

**Subsection C: 2Vault Configuration**
```
1. Open 2Vault extension
2. Go to Settings
3. Paste Obsidian API key -> Click "Test Connection"
4. Paste OpenRouter API key -> Click "Test LLM"
5. Click "Save"
6. Done!
```

### Troubleshooting (Collapsible)
```
Q: "What's the difference between these API keys?"
A: "Obsidian key = permission to access your vault. OpenRouter key = permission to use
   Claude/GPT. Both needed."

Q: "I don't want to use OpenRouter. Can I use Claude directly?"
A: "Yes. Instead of OpenRouter, you can paste your Claude API key. Same setup."

Q: "Vault connection test fails."
A: "Check: (1) Obsidian is running, (2) Local REST API plugin is enabled,
   (3) API key is correct, (4) Try HTTPS://localhost:27124 vs HTTP://localhost:27123"

Q: "Can I change my API key later?"
A: "Yes. Go to Settings > API Key anytime and update."
```

---

## How It Works Section

### Title
```
"How It Works"
```

### Timeline (4 Steps)

**Step 1: Select Bookmarks**
- Illustration: Screenshot of extension popup with folder tree
- Headline: "Pick a Bookmark Folder"
- Copy: "2Vault reads your Chrome bookmarks. Select a folder with any number of URLs."

**Step 2: AI Processes**
- Illustration: Animated icon showing processing (or screenshot of processing modal)
- Headline: "AI Summarizes & Categorizes"
- Copy: "2Vault extracts content, summarizes it, reads your vault, and picks the best folder + tags."

**Step 3: Files Into Vault**
- Illustration: Obsidian note appearing in folder
- Headline: "Notes Appear in Your Vault"
- Copy: "Automatically created with proper YAML frontmatter, markdown formatting, and wiki-links."

**Step 4: One Click Anywhere**
- Illustration: Keyboard shortcut visualization (Ctrl+Shift+V)
- Headline: "Or Use Ctrl+Shift+V"
- Copy: "On any webpage, press the shortcut to instantly capture and process. Works on X, LinkedIn, blogs."

---

## Social Proof Section (Post-Launch)

### Section Title
```
"Loved by Obsidian Users"
```

### Testimonial Cards (3-4)

**Testimonial 1:**
```
"This is exactly what I needed. I have 500 bookmarks I never read.
2Vault summarizes them so I can skim the key points instead."

— Sarah, Obsidian user
(from Obsidian Discord)
```

**Testimonial 2:**
```
"I was paying $15/mo for a tool that didn't integrate with my vault.
2Vault costs ~$0.01 per bookmark and actually understands my folder structure."

— Alex, Knowledge worker
(from r/ObsidianMD)
```

**Testimonial 3:**
```
"The X post capture is gold. I save threads all the time but they get deleted.
Now they live permanently in my vault with proper summaries."

— Jordan, Community member
(from Twitter)
```

### Stats
```
500+ Installs
4.5★ Rating (Chrome Web Store)
200+ GitHub Stars
```

---

## FAQ Section

### Title
```
"Frequently Asked Questions"
```

### Questions & Answers

**Q: Is my data private?**
```
A: Yes. 2Vault runs entirely in your browser. Your bookmarks and vault data
   never leave your machine except to OpenRouter for LLM processing (API only,
   no data stored). You own everything. Read our Privacy Policy for details.
```

**Q: Can I use ChatGPT or Gemini instead of Claude?**
```
A: Yes. OpenRouter supports 200+ models. Pick any model you want from the OpenRouter
   dashboard. We default to Google Gemini 2.0 Flash (fast, cheap, high quality).
   Or bring your own OpenAI/Claude API key directly.
```

**Q: What if I already have thousands of bookmarks?**
```
A: 2Vault processes on demand. Select a folder and click Process.
   It won't touch your vault until you explicitly run it.
   Start small (50 bookmarks) and go from there.
```

**Q: Does it work offline?**
```
A: No, you need internet for the LLM API calls and to reach Obsidian.
   But everything is open source—you can run it locally if you want.
```

**Q: Can I edit the summarization prompt?**
```
A: Not yet. For now, 2Vault uses a default prompt. Future: custom prompts in settings.
   GitHub issues welcome if you want to contribute.
```

**Q: Will there be a paid tier?**
```
A: Yes, eventually. Planned: managed tier ($12-15/mo) so you don't need API keys.
   For now: free + BYOK.
```

**Q: What if categorization is wrong?**
```
A: You can manually move or retag notes in Obsidian after creation.
   If you see patterns of bad categorization, file an issue on GitHub.
   Better: configure tag groups in settings so the LLM learns your tagging style.
```

**Q: Does this support other PKM tools (Logseq, Notion, etc.)?**
```
A: Not yet. 2Vault is built for Obsidian. Other tools may come after MVP.
   Follow GitHub for updates.
```

---

## Footer Copy

### Quick Links
- **GitHub** - View source code, star the repo, contribute
- **Twitter/X** - Follow @2vault_app for updates
- **Docs** - Full setup guide, troubleshooting, advanced config
- **Contact** - [contact@2vault.dev] or GitHub Issues

### Legal
- **Privacy Policy** - How we handle your data
- **Terms of Service** - License (AGPL-3.0)

### Copyright
```
2Vault © 2026. Open source under AGPL-3.0.
Built by [Your Name] with ❤️ for Obsidian lovers.
```

---

## Copy Tone & Guidelines

**Do:**
- Use active voice ("2Vault processes bookmarks" not "Bookmarks are processed")
- Be specific ("Vault-aware categorization using PARA" not "Smart categorization")
- Use relatable language ("Bookmark graveyard", "Your vault deserves better")
- Show benefits, not features ("Spend 5 minutes instead of reading 20 pages" not "AI summarization")
- Use contractions ("Can't", "Won't") for conversational tone

**Don't:**
- Use hype language ("Revolutionary!", "Game-changing!", "Next-gen")
- Over-explain technical terms (assume Obsidian user, not noob)
- Make promises you can't keep ("100% perfect categorization")
- Use multiple exclamation marks in a row
- Oversell ("The only bookmark tool you'll ever need")

---

## A/B Test Variants

**Headline variants to test:**
1. "Paste your bookmarks. Get organized knowledge." (Current)
2. "The bookmarks you actually read"
3. "From bookmark graveyard to Obsidian vault"
4. "Batch-process bookmarks with AI"

**Subheading variants:**
1. "2Vault turns your bookmark graveyard into an Obsidian vault. Automatically. With AI." (Current)
2. "Select a folder. 2Vault summarizes, categorizes, and files notes in seconds."
3. "Process 50+ bookmarks in batches. Vault-aware categorization. No subscription."

**CTA text:**
1. "Install on Chrome" (Current)
2. "Add to Chrome"
3. "Try Free for 10 Bookmarks"
4. "Get 2Vault Free"

**Test with:** Google Analytics → measure CTR to Chrome Web Store

---

## Messaging by Channel

### X/Twitter Launch
```
Shipped: 2Vault -- AI Chrome extension that turns your bookmark graveyard into
organized Obsidian knowledge.

- Select a bookmark folder -> processes all URLs
- Vault-aware categorization (uses YOUR folder structure)
- Captures X posts + LinkedIn posts via DOM (no expensive API)
- BYOK: bring your own Claude/OpenAI key
- Open source (AGPL-3.0)

[30-second demo GIF]

Chrome Web Store: [link]
GitHub: [link]
```

### Reddit (r/ObsidianMD)
```
Title: "[Extension] 2Vault - AI Chrome extension to batch-process bookmarks into Obsidian"

Body:
I've been building 2Vault for the past 3 weeks. It's a Chrome extension that takes your
bookmarks, summarizes them with AI, and files them into your Obsidian vault in the right folder.

Key features:
- Batch processing (select a folder, process all URLs)
- Vault-aware (understands YOUR folder structure and tags)
- Social media capture (X and LinkedIn posts)
- BYOK (bring your own API key, no subscription)
- Open source (AGPL)

It's been a lifesaver for my 500+ bookmark backlog. Happy to answer questions.

[Link to Chrome Web Store]
[Link to GitHub]
[Link to 2vault.dev]
```

### Product Hunt
```
Tagline: "Batch-process bookmarks with AI and file them into your Obsidian vault"

Description:
We solve a universal problem: you bookmark 50+ links a week, read 3.

2Vault is a Chrome extension that captures bookmarks, has AI summarize them, and files
them directly into your Obsidian vault—in the right folder, with the right tags.

Why it's different:
- Batch processing (50+ bookmarks in one click)
- Vault-aware (reads your PARA structure + existing tags)
- Captures social media (X/LinkedIn DOM extraction, no APIs)
- BYOK (bring your own API key, transparent costs)
- Open source (no lock-in)

It took 3 weeks to build, cost $0 to launch, and processes bookmarks for ~$0.005 each.
```

---

## Asset Checklist

**Images Needed:**
- [ ] Hero screenshot (extension + Obsidian side-by-side, 1200x600)
- [ ] Feature icons (6x react-icons or custom SVGs, 64x64)
- [ ] Extension popup screenshot (for "How It Works")
- [ ] Obsidian vault result screenshot (for "How It Works")
- [ ] Keyboard shortcut illustration (Ctrl+Shift+V visual)
- [ ] Processing modal screenshot (for testimonials section)
- [ ] og:image (1200x630 for social sharing)
- [ ] Favicon (16x16, 32x32)

**Copy Documents:**
- [ ] Privacy Policy (1-pager)
- [ ] Terms of Service / License (AGPL-3.0 summary)
- [ ] Setup guide (detailed 2vault.dev/docs/setup)

**Chrome Web Store Assets:**
- [ ] Short description (132 characters)
- [ ] Detailed description (500 words, formatted)
- [ ] 5x screenshots (1280x800 or 640x400)
- [ ] Extension icon (128x128)

**Tech Assets:**
- [ ] Next.js components (Hero, ProblemCard, FeatureGrid, FAQ, etc.)
- [ ] Tailwind CSS (colors, spacing, typography)
- [ ] Responsive breakpoints (mobile/tablet/desktop)

---

## Post-Launch Content Ideas

### Blog Posts
1. "Building 2Vault in 3 Weeks: Chrome Extension, AI, Obsidian"
   - How I built it
   - Tech stack decisions
   - Lessons learned

2. "How to Actually Read Your Bookmarks"
   - Problem statement (psychology of bookmarking)
   - Solution (batch + summarize)
   - Example workflow

3. "Best Obsidian AI Extensions 2026"
   - Market overview
   - Comparison table
   - My recommendation (2Vault, obviously)

4. "Organizing 500 Bookmarks with PARA and AI"
   - PARA system explained
   - Why it matters for knowledge workers
   - How 2Vault automates it

### Video Content
- 30-second demo (GIF on landing page)
- 5-minute YouTube tutorial
- TikTok/Shorts: "Before and after my bookmarks"

### Community
- Reddit AMAs (r/ObsidianMD, r/PKMS, r/productivity)
- Discord server for users + feedback
- Twitter threads on design decisions

---

## Success Metrics for Copy

- Landing page read time: <3 minutes (aim for skim-able)
- Chrome Web Store CTR: >20% (from 2vault.dev clicks)
- GitHub stars: >50 by month 1
- Email signups: >100 (if you add email capture)
- First bookmark processed: <1 hour after install
