# 2Vault - AI Bookmark Digester for Obsidian

A browser extension that reads, digests, and categorizes web bookmarks into an Obsidian vault. Solves the universal problem: "I bookmark everything but never go back to read any of it."

**Stack:** TypeScript, Chrome Extension (Manifest V3), Anthropic SDK, Readability + Turndown, Obsidian Local REST API
**Distribution:** Chrome Web Store (free BYOK + managed paid tier)
**License:** AGPL-3.0
**Status:** Planning phase

---

## Document Index

| File | Description |
|------|-------------|
| [PRODUCT.md](./PRODUCT.md) | Problem statement, value proposition, user stories, MVP scope, pricing model |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System design, extension architecture, processing pipeline, vault integration, BYOK vs managed |
| [IMPLEMENTATION.md](./IMPLEMENTATION.md) | Sprint breakdown, coding-level TODOs, testing strategy |
| [BRANDING.md](./BRANDING.md) | Build-in-public plan, content calendar, launch strategy, community targets |

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
- **Time budget:** ~2.5-3 weeks total. Kill if not 50% done by end of week 2.

---

## Competitive Landscape

| Tool | AI Summary | Batch URLs | Obsidian Native | Vault-Aware | Social Media | Price |
|------|-----------|------------|-----------------|-------------|--------------|-------|
| Readwise Reader | Partial | No | Highlights only | No | Twitter sync | $10-13/mo |
| Recall | Yes | Partial | No | No | No | $7-10/mo |
| Fabric (29K stars) | DIY | Manual CLI | No | No | No | Free (BYOK) |
| Obsidian Web Clipper | No | No | Yes | No | No | Free |
| Karakeep (Hoarder) | Tags only | No | No | No | No | Free (self-host) |
| **2Vault** | **Yes** | **Yes** | **Yes** | **Yes** | **Yes (DOM)** | **Free + $12-15/mo** |

### Market Context

- Obsidian: ~1.5M monthly active users, ~100K-200K use AI plugins
- Target audience: 10K-60K potential users
- Realistic paying customers: 500-6,000
- Revenue potential: $50K-$500K ARR (micro-SaaS)
- Omnivore shutdown created a vacuum in open-source read-it-later space
