# 2Vault GTM Strategy Summary

**Executive overview** for landing page + onboarding design and launch strategy.

---

## The Challenge

You've built a great product (2Vault extension with vault-aware categorization, batch processing, social media capture). Now you need users to discover it, understand it, install it, and actually use it.

**The user journey has 3 critical moments:**

1. **Discovery → Understanding (30 seconds)**
   - User lands on 2vault.dev
   - Question: "What does this do?"
   - Risk: Bounce if messaging is unclear

2. **Understanding → Installation (5 minutes)**
   - User reads landing page
   - Question: "Should I install this?"
   - Risk: Chrome Web Store friction, unclear benefits

3. **Installation → Setup → First Process (15 minutes)**
   - User installs extension, opens popup
   - Question: "How do I set this up?"
   - Risk: API key confusion, Obsidian plugin discovery, failed tests

**Your goal:** >70% of installers complete setup and process at least one bookmark.

---

## Strategic Decisions

### 1. Landing Page (Not App)

**Decision:** Build a landing page on 2vault.dev explaining 2Vault, NOT a web app that processes bookmarks.

**Why:**
- Separates concerns (extension is the product, web is marketing)
- Easier to maintain (no server, no authentication)
- SEO benefits (inbound links, organic search)
- Faster development (static HTML + Next.js, not a full app)
- Clearer messaging (landing page = pure education)

**What you're NOT doing:**
- Building a web version of 2Vault (saved for managed tier, Phase 3)
- Creating a SaaS signup flow (extension is free BYOK)
- Running servers for API key management (yet)

---

### 2. In-Extension Onboarding (Not External)

**Decision:** Step-by-step wizard inside the extension popup, NOT forcing users to a web page for setup.

**Why:**
- Context-aware (can test connections in real-time)
- Frictionless (no tab switching needed, except to Obsidian)
- Progressive disclosure (show only what's needed)
- Error recovery (can show troubleshooting inline)

**What you're NOT doing:**
- Onboarding slides that slow adoption
- Requiring email signup (extension storage only)
- Forcing demo processing before real use
- Multi-page flow (all in popup)

---

### 3. BYOK Model (Not Managed)

**Decision:** Start with free BYOK (bring your own API key), defer managed tier to Phase 3.

**Why:**
- No server costs (Obsidian + OpenRouter APIs, user pays)
- Faster launch (no billing infrastructure)
- Appeals to privacy-conscious users
- Simple messaging (no pricing confusion)
- Sustainable (no ARR target for MVP)

**What you're NOT doing:**
- Building Stripe integration (Phase 3)
- Running serverless functions (Phase 3)
- Managing user billing (Phase 3)
- Offering managed tier on day 1

---

### 4. Single Landing Page (Not Multi-Page Site)

**Decision:** All content on one page (landing.dev), with linked sub-pages for docs only.

**Why:**
- Lower maintenance burden (one file to update)
- Better for A/B testing (all variations in one file)
- Faster load time (no navigation clicks before CTAs)
- Mobile-friendly (long scrolling is fine)
- Solo dev bandwidth (you can't maintain 5 pages)

**What you're NOT doing:**
- Separate pricing page (no pricing for free tier)
- Separate blog homepage (blog posts linked from one section)
- Separate feature pages (all features on hero)
- Separate testimonials page (all social proof on landing page)

---

## Messaging Framework

### Core Value Prop
```
"Paste your bookmarks. Get organized knowledge."
```

**Unpacked:**
- Problem: You bookmark a lot but never read them
- Solution: 2Vault summarizes and organizes automatically
- Unique: Understands your Obsidian vault (vault-aware)
- Belief: Knowledge work requires organization

### Secondary Value Props

| Audience | Value Prop |
|----------|-----------|
| Obsidian users | "Vault-aware categorization. Your folders, your tags." |
| Privacy-conscious | "Open source. BYOK. No surveillance." |
| Cost-conscious | "Free extension. ~$0.005 per bookmark (no $15/mo subscription)." |
| Social media savers | "Capture X/LinkedIn before they vanish." |
| Power users | "Batch processing. Duplicate detection. Tag groups." |

### Anti-Messages (Don't Say These)

- "Revolutionary" (overhyped, untrue)
- "AI-powered" (everyone claims this; be specific: "AI summarization + categorization")
- "The only tool you need" (overconfident)
- "Works offline" (it doesn't; be honest)
- "Better than [competitor]" (invites comparison, usually backfires)

---

## Success Metrics

### Launch Week
- [ ] Landing page: >1,000 visitors
- [ ] Chrome Web Store: >100 installs
- [ ] GitHub: >50 stars
- [ ] X/Twitter: >500 impressions per post
- [ ] Reddit: >20 upvotes on r/ObsidianMD post

### Month 1
- [ ] Landing page: >5,000 visitors
- [ ] Chrome Web Store: >500 installs, >4.5★ rating
- [ ] GitHub: >200 stars
- [ ] User feedback: >10 GitHub issues (most feature requests, not bugs)

### Leading Indicators (Daily Tracking)
- [ ] Onboarding completion rate: >70% of installers complete setup
- [ ] First process rate: >50% of completers process first bookmark within 1 hour
- [ ] Error rate: <10% of processes fail
- [ ] User retention: >30% reopen extension in week 2

### If Numbers Are Bad (Diagnostic)
- Low onboarding completion? → Setup is too complex. Simplify.
- Low first process rate? → Unclear next step after setup. Add CTA.
- High error rate? → API key validation, error messages need work.
- Low retention? → Value prop isn't resonating. Interview users.

---

## Timeline

### Week 1: Design + Planning
- [ ] Wireframe landing page + onboarding
- [ ] Gather copy + assets
- [ ] Estimate effort per component
- [ ] Get feedback from 1-2 people

### Week 2: Landing Page MVP
- [ ] Build Next.js site
- [ ] Implement hero, problem, how it works, features, setup guide
- [ ] Deploy to 2vault.dev
- [ ] Test mobile responsiveness

### Week 3: Extension Onboarding
- [ ] Build GetStartedTab + Step1Obsidian + Step2LLM
- [ ] Add Help tab + error handling
- [ ] Integrate into extension popup
- [ ] Manual testing on real Obsidian vault

### Week 4: Chrome Web Store
- [ ] Create store assets (screenshots, icons, descriptions)
- [ ] Submit extension for review
- [ ] Create privacy policy
- [ ] Prepare social media announcements

### Week 5: Launch
- [ ] Chrome Web Store approval → Launch
- [ ] Announce on X, Reddit, HN
- [ ] Monitor early feedback
- [ ] Fix critical bugs
- [ ] Iterate based on user feedback

**Total: 4-5 weeks (can compress to 2-3 if full-time)**

---

## Competitive Differentiation

### Why 2Vault vs. Alternatives

| Feature | Readwise | Obsidian Clipper | Fabric | 2Vault |
|---------|----------|-----------------|--------|--------|
| Batch processing | No | No | Manual CLI | Yes |
| Vault-aware | No | No | No | Yes |
| AI summaries | Yes (only) | No | DIY | Yes |
| Social media | Twitter sync | No | No | Yes (DOM) |
| Free/BYOK | Subscription | Free (no AI) | Free | Free + BYOK |
| Obsidian native | Highlights only | Yes (no AI) | No | Yes + AI |

**Your moat:**
- Only tool that combines: Obsidian + batch processing + vault-aware categorization + social media capture + BYOK
- Not trying to be everything (focused on bookmarks → Obsidian)
- Sustainable (no server costs, users pay for LLM)

---

## Key Design Decisions

### Landing Page Design
- **Visual hierarchy:** Image > copy (show the transformation)
- **Emotional appeal:** "Bookmark graveyard" (relatable pain)
- **Specificity:** "Vault-aware", "PARA-native", "DOM extraction" (technical credibility)
- **Social proof:** User testimonials + GitHub stars (trust signals)
- **CTA strategy:** Multiple CTAs (hero + nav + setup section), all point to Chrome Web Store

### Onboarding Design
- **Progressive disclosure:** Start with 2 required fields (API keys), vault settings optional
- **Real-time validation:** ✓/✗ feedback as user types
- **Error categorization:** Specific errors + recovery paths, not generic "Something went wrong"
- **Help context:** Links next to fields, not separate docs
- **Success celebration:** Green checkmarks, "You're all set!" message
- **Skip option:** Advanced users can bypass wizard

### Copy Tone
- **Conversational, not corporate** ("Bookmark graveyard", not "Bookmark management solution")
- **Specific, not hype** ("Vault-aware", not "AI-powered")
- **Action-focused** ("Paste your bookmarks", not "Browse your library")
- **Honest about trade-offs** ("Requires API keys", "Internet required for LLM")

---

## Risk Mitigations

| Risk | Mitigation |
|------|-----------|
| Users don't find Obsidian REST API plugin | Screenshots + links in onboarding. Direct to plugin page. |
| Users get invalid API key format | Real-time validation. Show example format. |
| Obsidian plugin disabled/not running | Clear error message + troubleshooting steps. |
| High drop-off at setup | Simplify to 2 required fields. Optional settings later. |
| Low first-process rate | "Go to Bookmark Browser" CTA at end of onboarding. |
| Users don't understand vault-aware categorization | Explain with examples. Show sample note in hero image. |
| Chrome Web Store review rejection | Follow manifest V3 best practices. Simple permissions. Clear privacy policy. |
| Low user retention | Collect feedback early. Interview drop-off users. |

---

## Launch Checklist

### Pre-Launch (Week 4)
- [ ] Landing page live and mobile-tested
- [ ] All links working (Chrome Web Store, GitHub, docs)
- [ ] Extension submitted to Chrome Web Store
- [ ] Privacy policy written and linked
- [ ] Social media posts drafted
- [ ] Demo GIF created
- [ ] User testing: 5 people test landing page + onboarding

### Launch Day
- [ ] Chrome Web Store approval (hopefully)
- [ ] Post X/Twitter thread
- [ ] Post to r/ObsidianMD
- [ ] Submit to Hacker News
- [ ] Post to Obsidian Discord
- [ ] Monitor Chrome Web Store reviews (respond to all)
- [ ] Track GitHub stars

### Week 1 Post-Launch
- [ ] Monitor onboarding drop-off (where do users bail?)
- [ ] Respond to all user feedback (issues, comments, reviews)
- [ ] Fix critical bugs immediately
- [ ] Document common questions → update FAQ
- [ ] Collect testimonials for landing page
- [ ] Plan iteration priorities

---

## Files You Now Have

- `/docs/GTM-LANDING-ONBOARDING.md` — Full strategy (this framework)
- `/docs/LANDING-PAGE-COPY.md` — All copy, examples, messaging
- `/docs/REFERENCE-EXAMPLES.md` — Landing pages + onboarding patterns to study
- `/tasks/ONBOARDING-LANDING-PAGE-TASKS.md` — Actionable task list with effort estimates

---

## Next Step: Decide & Plan

**Before you start building, decide on these questions:**

1. **Landing page tech:** Next.js + Vercel (recommended) or plain HTML + Netlify?
2. **Domain name:** 2vault.dev or 2vault.app? (Domain.com offers cheap domains, $10-15/year)
3. **Hero image:** Will you use real screenshots or create a mockup/illustration?
4. **Onboarding approach:** Guided Settings tab (recommended) or separate Wizard flow?
5. **Launch date:** Target date for Chrome Web Store submission?

**Once you decide:**
1. Create Figma wireframes for landing page + onboarding
2. Get feedback from 2-3 people ("What does this product do?")
3. Start Task 1.1-1.4 (planning phase, 8 hours)
4. Start Task 2.1-2.7 (landing page, 10 hours)
5. Start Task 3.1-3.11 (onboarding, 15 hours)

---

## Final Words

You're not building a complex product—you're building a **clear path from discovery to first use.**

Every section of the landing page should answer: "Why do I need this?"
Every step of onboarding should answer: "What do I do next?"

**The magic happens when users complete onboarding and process their first bookmark. They'll see a note appear in their Obsidian vault and think "Wait, this actually works?"**

That moment is worth every hour of design + copy work.

Ship it. Learn from early users. Iterate.

Good luck.
