# Product Spec

<!-- Claude Code Tooling:
  - product-manager-toolkit (skill): Feature prioritization, user research synthesis, GTM strategy
  - cofounder (agent): Product strategy decisions, roadmap pivots
  - clarification (skill): When user stories or requirements are ambiguous
-->

## Problem Statement

Developers and knowledge workers bookmark 10-50 URLs per week. The vast majority are never revisited. The information decays -- links break, context is forgotten, and the knowledge never transfers from "saved" to "understood."

This is especially true for social media content (X threads, LinkedIn posts) which disappears from feeds and is nearly impossible to find again.

Existing solutions fail because they:
1. Require manual processing one page at a time (Obsidian Web Clipper)
2. Sync highlights but don't summarize or categorize (Readwise Reader)
3. Don't integrate with the user's existing knowledge structure (generic AI summarizers)
4. Can't capture social media content reliably from server-side (API costs, anti-scraping)
5. Are shut down (Omnivore)

## Value Proposition

**"Paste your bookmarks. Get organized knowledge."**

A browser extension that captures any webpage or social media post, has AI digest the content, and files it into your Obsidian vault -- in the right folder, with the right tags, linked to your existing knowledge structure.

The key differentiators:
1. **Vault-aware categorization** -- understands YOUR vault structure, not generic categories
2. **Social media capture** -- DOM-level extraction for X and LinkedIn (no flaky APIs)
3. **Batch processing** -- select an entire bookmark folder and process all URLs at once
4. **BYOK model** -- bring your own API key, keep costs transparent
5. **PARA-native organization** -- built-in second brain structure with Projects, Areas, Resources, Archive

## User Stories

### Phase 1 (Core Module)

1. As a developer, I want to pass URLs to an AI agent and have them summarized with key takeaways so I can quickly recall why I saved them.
2. As an Obsidian user, I want new notes filed into my existing folder structure (not a generic "Inbox") so my vault stays organized.
3. As a user, I want proper YAML frontmatter (source URL, author, date, tags) on each note so I can search and filter later.

### Phase 2 (Browser Extension MVP)

4. As a user, I want to click the extension button and see my browser bookmark folders so I can select which folder to process as a batch.
5. As a user, I want a keyboard shortcut to quickly capture the current page I'm viewing.
6. As a user, I want to capture X/Twitter posts and LinkedIn posts as readable notes in my vault.
7. As a user, I want to bring my own Claude/OpenAI API key so I control costs and data privacy.

### Phase 2.5 (Core Intelligence)

8. As a user, I want duplicate detection so I don't re-process URLs I've already saved.
9. As a user, I want my vault organized using PARA so my second brain has a clear structure.
10. As a user, I want to define tag groups so similar content gets consistent tags.
11. As a user, I want automatic linking to related existing notes via tag hub notes in my vault.

### Phase 2.6 (UX Polish)

12. As a user, I want to paste a URL directly and process it without bookmarking first.
13. As a user, I want validation errors on my API keys before saving so I don't waste time debugging.
14. As a user, I want clear error categories and actionable suggestions when processing fails.

### Phase 3 (Growth)

15. As a non-technical user, I want a managed tier where I don't need an API key -- just pay and it works.
16. As a user, I want to see a preview of categorization before notes are created so I can correct mistakes.

### Future

17. As a user, I want to process YouTube videos by extracting transcripts.
18. As a user, I want to capture Facebook and Instagram text posts.

## MVP Scope (Extension)

### In Scope

- Chrome browser extension (Manifest V3)
- Extension popup UI showing browser bookmark folders
- Select a bookmark folder -> batch process all URLs
- Keyboard shortcut to capture current page
- Content extraction:
  - Web articles/blogs via Readability + Turndown (in-extension)
  - X/Twitter posts via DOM content script
  - LinkedIn posts via DOM content script
- AI processing per URL:
  - Title extraction
  - 2-3 sentence summary
  - 3-5 key takeaway bullets
  - Tag extraction from content
- Vault-aware categorization:
  - Read vault folder structure via Obsidian Local REST API
  - Read existing tag taxonomy
  - Match each article to best-fit folder and tags
- Note creation via Obsidian Local REST API:
  - Clean markdown format
  - YAML frontmatter (source, author, date_saved, date_published, tags, status)
- BYOK: user enters their own API key in extension settings
- Graceful failure for URLs that can't be fetched (log error, skip, continue)
- Processing status/progress in popup
- PARA organization system as default (Projects, Areas, Resources, Archive)
- Duplicate URL detection (skip already-saved URLs)
- Direct URL input (paste URLs without bookmarking)
- User-defined tag groups for consistent categorization
- Tag hub notes for Obsidian graph view connectivity
- API key format validation with inline errors

### Out of Scope (MVP)

- Managed tier (serverless proxy) -- Phase 3
- YouTube transcript extraction
- Facebook / Instagram
- PDF processing
- Full bidirectional linking to existing notes (tag hub notes partially address this)
- MOC (Map of Content) updates
- Obsidian community plugin (companion for vault-side management)
- Firefox / Safari / Edge extensions
- Mobile support

## Note Template

```markdown
---
source: https://example.com/article
author: Jane Doe
date_published: 2026-02-10
date_saved: 2026-02-15
tags:
  - typescript
  - design-patterns
  - architecture
type: article
status: unread
---

# Article Title Here

## Summary

2-3 sentence summary of the article's core argument or insight.

## Key Takeaways

- First key point with enough context to be useful standalone
- Second key point
- Third key point

## Related Tags

[[typescript]] | [[design-patterns]] | [[architecture]]

## Source

[Original Article](https://example.com/article)
```

**Note path example (PARA mode):** `Resources/TypeScript/article-title-here.md`

### Social Media Note Template

```markdown
---
source: https://x.com/user/status/123456
author: "@username"
date_published: 2026-02-10
date_saved: 2026-02-15
tags:
  - ai
  - llm
type: social-media
platform: x
status: unread
---

# @username on AI Development Trends

## Summary

2-3 sentence summary of the post/thread.

## Key Points

- First key point
- Second key point

## Original Content

> The full text of the post/thread quoted here for archival.

## Source

[Original Post](https://x.com/user/status/123456)
```

## Pricing Model

| Tier | Price | What You Get |
|------|-------|-------------|
| Free (BYOK) | $0 | Unlimited processing with your own API key. Full vault-aware categorization. All content types. |
| Managed | $12-15/mo | No API key needed. We handle LLM costs. Premium model access. Priority support. |
| Lifetime | $199-299 | One-time payment for managed tier. Early adopter lock-in. |

**BYOK cost transparency:** Each article costs ~$0.002-0.01 in API fees (Haiku for summarization, Sonnet for categorization). A batch of 50 articles = ~$0.10-0.50.

## Success Metrics

### Phase 1 (Core Module Validation)

- Can process 20+ bookmarks correctly via Claude Code skill
- >80% of notes filed in the correct folder on first try
- Summarization quality is genuinely useful (not generic fluff)

### Phase 2 (Extension Launch)

- Extension works reliably on Chrome
- X and LinkedIn DOM capture works for public posts
- Bookmark folder batch processing handles 50+ URLs
- 50+ GitHub stars in first month
- 30+ upvotes on Obsidian subreddit

### Phase 3 (Growth)

- 500+ Chrome Web Store installs
- 5+ managed tier subscribers
- Featured in 1+ Obsidian community roundup

---

## Key Strategic Decisions

- **Product form:** Chrome browser extension (captures the natural "bookmark moment" + enables social media DOM extraction)
- **Phased build:** Phase 1 = core processing module + Claude Code skill validation (1 week). Phase 2 = browser extension wrapper (2 weeks).
- **Content extraction:** Readability + Turndown for articles. Browser DOM capture for social media (X, LinkedIn text-based first).
- **Vault integration:** Obsidian Local REST API companion plugin (HTTP endpoints, mature, ~200K+ downloads)
- **Categorization:** Vault-aware -- reads existing folder structure + tag taxonomy before filing
- **LLM strategy:** Abstracted provider layer. Claude for development. BYOK (client-side direct calls) + managed tier (serverless proxy).
- **Revenue model:** Free BYOK tier + managed paid tier ($12-15/mo). Open source core (AGPL-3.0).
- **Extension UX:** Extension button popup (browse bookmark folders, select batch) + keyboard shortcut (capture current page)
- **Batch processing:** `chrome.bookmarks` API -- user selects bookmark folder, processes all URLs in it
- **Target PKM:** Obsidian only (MVP). Graph view advantage for knowledge connections.
- **Build-in-public:** 5-7 X/Twitter posts documenting the build process
- **Organization system:** PARA as default with Custom fallback. Two-level depth: PARA bucket + topic subfolder (e.g., Resources/AI/).
- **Time budget:** ~2.5-3 weeks total. Kill if not 50% done by end of week 2.

---

## Competitive Landscape

| Tool | AI Summary | Batch URLs | Obsidian Native | Vault-Aware | Social Media | PARA | Price |
|------|-----------|------------|-----------------|-------------|--------------|------|-------|
| Readwise Reader | Partial | No | Highlights only | No | Twitter sync | No | $10-13/mo |
| Recall | Yes | Partial | No | No | No | No | $7-10/mo |
| Fabric (29K stars) | DIY | Manual CLI | No | No | No | No | Free (BYOK) |
| Obsidian Web Clipper | No | No | Yes | No | No | No | Free |
| Karakeep (Hoarder) | Tags only | No | No | No | No | No | Free (self-host) |
| **2Vault** | **Yes** | **Yes** | **Yes** | **Yes** | **Yes (DOM)** | **Yes** | **Free + $12-15/mo** |

### Market Context

- Obsidian: ~1.5M monthly active users, ~100K-200K use AI plugins
- Target audience: 10K-60K potential users
- Realistic paying customers: 500-6,000
- Revenue potential: $50K-$500K ARR (micro-SaaS)
- Omnivore shutdown created a vacuum in open-source read-it-later space
