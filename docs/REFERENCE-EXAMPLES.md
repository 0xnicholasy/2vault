# Reference Examples: Landing Pages & Onboarding Flows

This document catalogs successful landing pages and onboarding patterns that work well for developer tools, Chrome extensions, and Obsidian-adjacent products. Use these as inspiration for your own 2Vault implementation.

---

## Landing Pages Worth Studying

### 1. Raycast (raycast.com)
**Why it works:**
- **Hero:** Single-line promise with big image (30% fold)
- **How it works:** 3-step animation showing product in action
- **Visual hierarchy:** Images > copy (leads with product beauty)
- **CTA:** Appears early and often (top nav + hero)
- **Copy:** Short, punchy, action-oriented
- **Social proof:** Early user testimonials (developer-focused)

**Tactics to steal:**
- Animated GIF in hero showing product in action (not static screenshot)
- "Why Raycast" section showing pain points (opposite of competitors)
- Feature grid with minimal text + big icons
- Testimonials from actual users (specific quotes)

---

### 2. Vercel (vercel.com)
**Why it works:**
- **Landing page hierarchy:** Solves different problems for different segments
  - Developers: "Deploy in seconds"
  - Teams: "Collaborate on production"
  - Enterprises: "Scale reliably"
- **Visual dominance:** 70% images/video, 30% copy
- **Setup framing:** Not a "pricing" conversation, a "getting started" one
- **Social proof:** Customer logos from known companies (trust signal)

**Tactics to steal:**
- Segment your messaging by user type (you have: Obsidian users, developers, researchers)
- Lead with visual demos, not feature lists
- Use customer logos/names (collect post-launch)
- Pricing is secondary (mention cost savings, not pricing tiers)

---

### 3. Obsidian.md
**Why it works:**
- **Audience clarity:** Opens with "For thought workers" (specific niche)
- **Vault metaphor:** Consistent visual language (folders, graphs, notes)
- **Feature progression:** Shows features in context (not abstract bullets)
- **Graph visualization:** Beautiful, immediately compelling (differentiator)
- **Pricing transparency:** BYOK vs. Sync (clear tiers)

**Tactics to steal:**
- Use consistent metaphor throughout (2Vault = "processing" pipeline)
- Show product in context (notes in vault, not isolated UI)
- Emphasize community/ecosystem (Obsidian plugins, themes)
- Be transparent about what's free vs. paid (no dark patterns)

---

### 4. Linear (linear.app)
**Why it works:**
- **Copy:** Extremely tight, specific language
- **CTA placement:** Multiple, non-aggressive ("Request demo" vs. hard sell)
- **Visual narrative:** Each section shows problem → solution visually
- **Comparison:** Not a table, a visual contrast of "before/after"
- **Testimonials:** Video clips of real users (more credible than text)

**Tactics to steal:**
- Tight copy (sentence fragments, active voice)
- Problem-focused sections (show the pain, then relief)
- Video testimonials (if you can get them post-launch)
- Avoid comparison tables (harder to skim than visual contrast)

---

### 5. Notion (notion.so)
**Why it works:**
- **Hero:** Very visual (animated template showcase)
- **Breadth:** Shows use cases (database, wiki, CRM)
- **Community:** Prominent "What's possible" section (user-generated content)
- **Copy tone:** Conversational, not corporate
- **CTA:** Soft ("Try Notion free" not "Buy Notion now")

**Tactics to steal:**
- Show use cases in context (e.g., "X posts in your vault", "Weekly bookmark digest")
- Emphasize community (GitHub stars, testimonials)
- Conversational tone (helps indie dev brand)
- Free tier is highlighted (removes friction)

---

## Chrome Extension Landing Pages (Reference)

### 1. Wunderbucket (Chrome extension listing)
**Why it works:**
- **Short description:** 2 sentences, very clear
- **Detailed description:** Features + benefits, FAQs embedded
- **Screenshots:** Show the extension in action, not just UI
- **Reviews:** Real user reviews are your best marketing

**Tactics to steal:**
- Collect 5-10 early user reviews (ask beta testers)
- Screenshots show before/after (bookmark -> processed note)
- Highlight unique selling point in store description

---

### 2. Obsidian Web Clipper (Web + Chrome listing)
**Why it works:**
- **Web landing page:** Minimal, focuses on "why Obsidian" first
- **Store listing:** Matches landing page messaging
- **Setup docs:** Detailed guide linked from both places

**Tactics to steal:**
- Keep messaging consistent between web + store
- Link to detailed setup guide from store description
- Show that you understand Obsidian (mention YAML, graph view, plugins)

---

## Onboarding Patterns Worth Studying

### 1. Notion's Onboarding
**Why it works:**
- **Templates first:** User picks a template before blank page (removes blank canvas problem)
- **Guided tour:** Optional, skip-able, contextual
- **Progressive disclosure:** Advanced features hidden until user needs them
- **Saving:** Auto-saves constantly (removes anxiety)

**Tactics to steal for 2Vault:**
- Offer preset vault structures (PARA, GTD, Zettelkasten)
- Make skip button prominent (doesn't force onboarding)
- Show what's working as they go (green checkmarks)
- Auto-save settings as they fill form

---

### 2. Stripe's Onboarding
**Why it works:**
- **Minimal initial setup:** Email + password, that's it
- **Progressive complexity:** Advanced settings appear as you need them
- **Validation:** Real-time feedback (✓ "This email is available")
- **Help links:** Context-specific (e.g., "What's a Stripe account?" right there)
- **Mobile-first:** Works perfectly on small screens

**Tactics to steal for 2Vault:**
- Start with 2 fields: Obsidian API key + LLM API key (rest is optional)
- Real-time validation (✓ green or ✗ red as they type)
- Help links next to each field (not separate page)
- Mobile-optimized inputs (large touch targets)

---

### 3. Figma's Onboarding
**Why it works:**
- **Context-specific:** Different flow if you have teams vs. solo
- **Empty state → filled state:** Shows what's possible step-by-step
- **Undo-friendly:** Can go back and change decisions
- **Social proof:** "10,000+ teams use this" (specific number)

**Tactics to steal for 2Vault:**
- Different flow: personal vault vs. shared vault (future)
- Show examples of what happens after setup (processed notes)
- Let users change API keys anytime (not locked in)
- Show user count (e.g., "500+ users, 10,000+ bookmarks processed")

---

### 4. Slack's Onboarding
**Why it works:**
- **Wizard approach:** Step-by-step (1 of 3, 2 of 3, etc.)
- **Progress visibility:** User knows where they are
- **Clear next action:** "Create your first channel" (not vague)
- **Success moment:** When you send first message, celebration

**Tactics to steal for 2Vault:**
- Show progress ("Step 2 of 3: Set up LLM")
- Each step has one clear action (not multiple options)
- Celebrate when first bookmark processes ("Congratulations! Your first note is in Obsidian")

---

## Error Handling & Recovery

### 1. Stripe's Error Handling
**Why it works:**
- **Specific errors:** Not "Something went wrong", but "Your card was declined because..."
- **Recovery path:** Clear next step (e.g., "Update your payment method")
- **Human tone:** Not blame (no "You entered it wrong")
- **Help link:** Relevant article (e.g., "Why might my card be declined?")

**Application to 2Vault:**
```
✗ Connection failed
Error: Can't reach Obsidian at https://localhost:27124

Next steps:
1. Check that Obsidian is running
2. Enable the "Local REST API" plugin in Obsidian
3. Try a different vault URL:
   [http://localhost:27123] (HTTP)
   [https://localhost:27124] (HTTPS - default)

[Retry] [View Setup Guide]
```

---

### 2. GitHub's Connection Errors
**Why it works:**
- **Categories:** Network, permission, not found, rate limit (each has different copy)
- **Actionable suggestions:** Specific next steps per error
- **Timeout handling:** Retries automatically

**Application to 2Vault:**
```
Error categories:

NETWORK_ERROR → "Check your internet connection"
VAULT_UNREACHABLE → "Is Obsidian running? Plugin enabled?"
INVALID_API_KEY → "API key format invalid. Check 2vault.dev/docs/setup"
API_RATE_LIMIT → "Processing too many bookmarks. Try again in 1 minute."
LLM_ERROR → "OpenRouter API error. Try switching models or check your key."
```

---

## Obsidian Plugin Examples

### 1. Dataview Plugin
**Why it works for onboarding:**
- **Quick start:** Minimal setup needed (works out of box)
- **Docs:** Link in plugin settings to full documentation
- **Examples:** Sample queries in plugin settings
- **Community:** Links to Discord/GitHub for help

**Tactics to steal:**
- Your extension works immediately after API key setup (no additional config needed)
- Link help docs from extension settings
- Show example bookmark in demo
- Join Obsidian Discord for community support

---

### 2. Templater Plugin
**Why it works:**
- **Profiles:** Users can choose templates for different types of content
- **Syntax highlighting:** Built-in template editor with help
- **Examples:** Gallery of templates from community

**Tactics to steal:**
- Future: Let users choose note templates (article vs. social media)
- Syntax validation in tag group editor (if you add custom prompt editing later)
- Community-submitted templates library (far future)

---

## Competitive Alternatives (Real Comparisons)

### Readwise Reader
**Strengths:**
- Beautiful iOS/web apps
- Highlights + annotations
- Email-to-Kindle style inbox

**Weaknesses:**
- Expensive ($10-13/mo)
- No Obsidian integration
- No batch processing
- No social media capture

**2Vault advantage:**
- Cheaper ($0 + BYOK)
- Native Obsidian integration
- Batch processing
- X/LinkedIn capture

---

### Obsidian Web Clipper
**Strengths:**
- Simple, lightweight
- Works with Obsidian directly
- Free

**Weaknesses:**
- No AI summarization
- One-at-a-time processing
- No social media capture
- No vault-aware categorization

**2Vault advantage:**
- AI summarization + categorization
- Batch processing
- X/LinkedIn capture
- BYOK cost model

---

### Fabric (GitHub project, 29K stars)
**Strengths:**
- Open source
- Powerful prompts
- Full cost control (BYOK)

**Weaknesses:**
- CLI-based (not user-friendly)
- Manual processing
- No Obsidian integration
- No social media capture

**2Vault advantage:**
- Obsidian native
- GUI (easier to use)
- Batch processing
- Social media capture

---

### Omnivore (Defunct - Opportunity)
**Why it shut down:**
- Business model didn't work ($5/mo wasn't enough)
- Too broad (trying to be Pocket + Readwise)
- No differentiation

**2Vault advantage:**
- Narrow focus (Obsidian + bookmarks)
- BYOK model (no server costs)
- Clear differentiation (vault-aware)
- Community-driven (open source)

---

## Key Takeaways for 2Vault

### Landing Page
1. **Lead with visual:** Hero image shows transformation (bookmarks -> Obsidian note)
2. **Be specific:** "Vault-aware" not "Smart". "PARA organization" not "Organized".
3. **Show problems:** Each section leads with pain point, then relief
4. **Keep copy tight:** Stripe level of conciseness
5. **Social proof:** Early user testimonials, GitHub stars, Chrome store reviews
6. **Multiple CTAs:** Hero + top nav + setup section

### Onboarding
1. **Minimal required setup:** 2 API keys, that's it
2. **Real-time validation:** ✓/✗ as user types
3. **Progress visibility:** "Step 1 of 3"
4. **Skip option:** Advanced users can skip to settings
5. **Help context:** Links next to each field
6. **Error categorization:** Specific error messages + recovery path
7. **Celebrate completion:** "You're all set!" + next step

### Extension Store Listing
1. **Match landing page messaging:** "Vault-aware", "Batch processing", "BYOK"
2. **5 high-quality screenshots:** Before/after transformation
3. **Detailed description:** Features + benefits + FAQ
4. **Reviews:** Collect 10+ early user reviews
5. **Icon:** Professional, matches landing page branding

### Post-Launch Growth
1. **Blog content:** "Building 2Vault", "How to Read Your Bookmarks"
2. **Community:** Reddit, Discord, GitHub
3. **Video:** 30s demo GIF, YouTube tutorial
4. **SEO:** Target "Obsidian AI plugin", "bookmark management", "knowledge organization"
5. **Partnerships:** Reach out to Obsidian YouTubers (Nicole van der Hoeven, etc.)

---

## Specific Landing Page Sites to Study

**Recommended reading (30 min each):**
1. raycast.com (tight hero, animated demo, clear value)
2. vercel.com (segmented messaging, visual hierarchy)
3. obsidian.md (consistent metaphor, specific niche)
4. linear.app (problem-solution visual contrast)
5. stripe.com (clear, scannable, trust-focused)

**Chrome extension stores to study:**
1. Obsidian Web Clipper store page (description, reviews)
2. Notion Web Clipper store page (similar use case)
3. Wunderbucket store page (well-reviewed extension)

**Onboarding flows to study:**
1. Stripe (real-time validation, progressive disclosure)
2. Notion (template picker, optional tour)
3. Slack (wizard, progress indicator, success moment)

---

## Obsidian Ecosystem Context

### Market Size
- Obsidian: ~1.5M monthly active users
- AI plugin users: ~100K-200K (estimate)
- Knowledge workers (target): ~10K-60K
- Realistic paying customers (future managed tier): 500-6,000

### User Characteristics
- High literacy (reads documentation)
- Values privacy (concerned about data)
- Willing to learn new tools (but wants low friction)
- Values deep customization (PARA, tag groups, etc.)
- Community-oriented (shares vaults, templates, tips)

### Messaging That Resonates
- "Your vault, your rules" (not vendor lock-in)
- "Open source, inspect the code" (privacy/trust)
- "Integrates with Obsidian ecosystem" (plugin compatibility)
- "PARA native" (established knowledge management system)
- "No subscription" (indie dev ethos)
- "Community-driven" (values transparency)

---

## Red Flags to Avoid

### Landing Page
- [ ] Wall of text (aim for <3 min read)
- [ ] Hype language ("Revolutionary!", "Game-changing!")
- [ ] Vague benefits ("Easy!", "Fast!", "Powerful!")
- [ ] Outdated screenshots (must show current UI)
- [ ] Missing setup guide (leave users stranded)
- [ ] No social proof (hard to trust new tool)

### Onboarding
- [ ] Required fields with no context ("What's this?")
- [ ] No validation feedback (user doesn't know if key is right)
- [ ] Complex setup before basic use (YAGNI principle)
- [ ] No help links (user has to leave extension)
- [ ] Generic error messages ("Something went wrong")
- [ ] No progress indicator (user doesn't know where they are)
- [ ] No skip option (power users feel trapped)

### Store Listing
- [ ] Vague description ("AI-powered bookmark tool")
- [ ] No screenshots (users don't know what they're installing)
- [ ] Missing privacy policy (Chrome will reject)
- [ ] Poor icon (low quality = low trust)
- [ ] No reviews (new apps always look suspicious)

---

## Success Stories to Reference

### Obsidian Dataview Plugin
- **Why it won:** Solved specific problem (querying notes)
- **Growth:** 200K+ installs (one of most popular plugins)
- **Community:** Active GitHub, Discord community
- **Lesson:** Deep integration with core product = high adoption

### PARA System (Tiago Forte)
- **Why it won:** Clear mental model, teachable, documented
- **Growth:** 100K+ users worldwide
- **Community:** YouTube, courses, templates
- **Lesson:** Educational content drives adoption

### Vaulted (small indie extension)
- **Why it won:** Solved narrow problem (folder organization)
- **Growth:** 5K+ installs, 4.8★ rating
- **Community:** Small but engaged
- **Lesson:** Do one thing well, not everything poorly

---

## Your Positioning

### Positioning Statement
```
For Obsidian power users who bookmark 10-50 URLs per week but never read them,
2Vault is a Chrome extension that batch-processes bookmarks with AI and files them
into your vault with vault-aware categorization.

Unlike Readwise Reader, Notion, or generic bookmark tools,
2Vault understands your PARA organization, integrates deeply with Obsidian,
and lets you bring your own API key (no subscription).
```

### One-Liner
```
"Batch-process bookmarks with AI. Vault-aware categorization. BYOK."
```

### Three-Liner
```
Tired of 500 bookmarks you never read?

2Vault batch-processes them with AI and files them in your Obsidian vault—
in the right folder, with the right tags, linked to your existing knowledge structure.

No subscription. Bring your own API key.
```

### Tag
```
"The bookmark tool for Obsidian power users."
```

---

## Next Steps

1. **Study examples:** Open 5 landing pages (Raycast, Vercel, Obsidian, Linear, Stripe) in browser. Spend 15 min on each. Note what works.

2. **Sketch wireframes:** On paper or Figma, sketch 3 landing page layouts. Test with 2-3 people: "What does this product do?"

3. **Plan onboarding:** Map out the exact steps users take (Obsidian install → copy key → return to 2Vault → paste → test). Where do they drop off?

4. **Create assets:** Screenshot your extension + Obsidian vault. Create hero image. Write copy headlines.

5. **Build landing page:** Next.js + Vercel (4-6 hours)

6. **Build onboarding:** Modify Settings.tsx (6-8 hours)

7. **Test:** Beta test with 5 users. Measure: time to first process, drop-off points, error frequency.

8. **Launch:** Chrome Web Store + landing page + Reddit/HN + Twitter

You've got this.
