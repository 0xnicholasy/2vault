# 2Vault Go-to-Market (GTM): Complete Strategy Index

This directory contains the complete strategy and implementation guide for launching 2Vault's public landing page and in-extension onboarding flow.

**Start here. Read in this order:**

---

## 📚 Documents Overview

### 1. **GTM-STRATEGY-SUMMARY.md** ⭐ START HERE
**What:** High-level overview of strategy, decisions, and success metrics
**Why:** Gives you the "why" before the "how"
**Read time:** 15 minutes
**Key takeaways:**
- Why landing page + not a web app
- Why guided onboarding in extension + not external flow
- Key messaging framework
- Success metrics by stage

### 2. **GTM-LANDING-ONBOARDING.md**
**What:** Comprehensive strategy with sections, content structure, tech stack, UX flows
**Why:** Blueprint for building the landing page and onboarding
**Read time:** 45 minutes
**Key sections:**
- Part 1: Landing Page (content sections, copy strategy, tech stack, SEO)
- Part 2: In-Extension Onboarding (wizard vs. settings, step-by-step flows, error handling)
- Part 3: Integrated User Journey (full path from discovery to first note)
- Part 4: Implementation Priority & Timeline

### 3. **LANDING-PAGE-COPY.md**
**What:** All landing page copy, examples, messaging frameworks, A/B test variants
**Why:** Reference doc—copy-paste ready headlines, subheadings, CTAs
**Read time:** 30 minutes (or use as reference while building)
**Key sections:**
- Hero section copy
- Problem cards + messaging
- Features section
- Setup guide copy
- FAQ examples
- Copy tone guidelines
- Channel-specific messaging (X, Reddit, Product Hunt)

### 4. **REFERENCE-EXAMPLES.md**
**What:** Real-world examples of landing pages and onboarding flows to study
**Why:** Learn from successful products (Raycast, Vercel, Linear, Slack, etc.)
**Read time:** 20 minutes
**Key sections:**
- Landing pages worth studying (with analysis of why they work)
- Onboarding patterns from Notion, Stripe, Slack
- Error handling examples
- Obsidian ecosystem context
- Competitive differentiation framework

### 5. **LANDING-ONBOARDING-FLOW-DIAGRAMS.md**
**What:** ASCII diagrams and flowcharts for visual reference during implementation
**Why:** Quick reference while coding—see the UI layout, state flows, user journey
**Read time:** 15 minutes (glance-able)
**Key diagrams:**
- Landing page sections (top-to-bottom layout)
- Onboarding flow (tabs, steps, states)
- User journey swimlane (timeline from discovery to retention)
- Conversion funnel (metrics at each stage)
- Component dependency graph
- State flow (how chrome.storage changes through onboarding)

---

## 🎯 Quick Start Path (Choose Your Timeline)

### I have 2-3 weeks (part-time)
1. **Read:** GTM-STRATEGY-SUMMARY.md (15 min)
2. **Skim:** GTM-LANDING-ONBOARDING.md sections 1-2 (20 min)
3. **Do:** Tasks from ONBOARDING-LANDING-PAGE-TASKS.md (Phase 1: 6-8 hours)
4. **Build:** Landing page (Phase 2: 8-10 hours)
5. **Build:** Onboarding (Phase 3: 10-15 hours)
6. **Launch:** Chrome Web Store (Phase 4-5: 6-8 hours)

**Total: ~50 hours over 2-3 weeks**

### I have 4-5 days (full-time)
1. **Read:** GTM-STRATEGY-SUMMARY.md + GTM-LANDING-ONBOARDING.md (1 hour)
2. **Skim:** Diagrams + Copy reference (30 min)
3. **Plan:** Wireframe + copy (2 hours)
4. **Build:** Landing page + onboarding in parallel (3 days)
5. **Launch:** Chrome Web Store + social (1 day)

**Total: 35-40 hours over 5-6 days**

### I want to understand before building (Research Phase)
1. **Read all documents in order:** 2-3 hours total
2. **Study references:** Spend 30 min on each of 5 landing pages mentioned
3. **Wireframe:** Spend 4 hours sketching your own landing page + onboarding
4. **User test:** Show wireframes to 3-5 people, measure comprehension
5. **Plan:** Break into tasks, estimate effort
6. **Build:** Once you're confident in direction

**Total: 20-30 hours of research + planning**

---

## 📋 Task List (Actionable Checklist)

See: **tasks/ONBOARDING-LANDING-PAGE-TASKS.md**

This file has:
- 6 phases (Planning, Landing Page Dev, Onboarding Dev, Chrome Store, Launch, Iteration)
- 40+ concrete tasks with effort estimates
- Success criteria for each phase
- Risk mitigations

**Print it out or use as Notion/GitHub Issues checklist.**

---

## 🏗️ Architecture Decisions You Need to Make

Before starting, decide:

1. **Landing Page Tech Stack**
   - Recommended: Next.js App Router + Vercel
   - Alternative: Plain HTML + Netlify
   - See GTM-LANDING-ONBOARDING.md Part 1.3 for decision matrix

2. **Onboarding Approach**
   - Recommended: Guided Settings Tab (simpler, leverage existing code)
   - Alternative: Separate Wizard Flow (more polished, more code)
   - See GTM-LANDING-ONBOARDING.md Part 2.3 for comparison

3. **Domain**
   - Preferred: 2vault.dev (if available)
   - Alternative: 2vault.app
   - Check availability at domain.com, namecheap.com

4. **Launch Date**
   - Recommend: Pick a date 4-5 weeks out
   - Buffer: Always add 1 week for Chrome Web Store review delays
   - Don't launch on Friday (support on weekends is hard)

5. **Social Media Strategy**
   - Recommend: X/Twitter + Reddit + Hacker News
   - Don't: Facebook/Instagram (wrong audience)
   - Coordinate: Launch all on same day for impact

---

## 📊 Success Metrics (What to Track)

### Landing Page Metrics
- Visitors: >1,000 in first week
- CTR (click "Install"): >60%
- Scroll depth: >60% read past hero
- Bounce rate: <40%

### Onboarding Metrics
- Completion rate: >70% of installers complete setup
- Drop-off by step:
  - Obsidian connection: <10% drop-off
  - LLM key: <15% drop-off
  - Vault settings: <5% drop-off (optional)
- Time to complete: <15 minutes (target)

### First Process
- Rate: >50% of completers process first bookmark
- Time to process: <1 hour after setup completion
- Success rate: >90% (failures tracked + fixed)

### Retention
- Week 2 return: >30% reopen extension
- Week 4 active: >20% still using
- GitHub stars: >50 in month 1

### If Metrics Are Bad
- Low landing page visitors? → Increase X/Reddit promotion
- High bounce? → Copy isn't resonating. Test headlines.
- High onboarding drop-off? → Setup is too complex. Simplify.
- Low first process? → Unclear next step. Add CTA.

---

## 🚀 Launch Checklist (Pre-Launch)

### Week Before Launch
- [ ] Landing page live and mobile-tested
- [ ] Extension builds without errors
- [ ] All API keys working (test with real Obsidian + OpenRouter)
- [ ] Privacy policy written
- [ ] Chrome Web Store description drafted
- [ ] Screenshots for store listing created
- [ ] Demo GIF recorded
- [ ] Social media posts drafted

### Launch Day (Coordination)
- [ ] Extension approved on Chrome Web Store (or submit if pending)
- [ ] Landing page linked from all documents
- [ ] Chrome Web Store link added to landing page
- [ ] GitHub repo updated with store link
- [ ] Post X/Twitter thread
- [ ] Post to r/ObsidianMD
- [ ] Submit to Hacker News
- [ ] Post to Obsidian Discord
- [ ] Post to Obsidian Forum

### Week 1 After Launch
- [ ] Monitor Chrome Web Store reviews (respond to all)
- [ ] Track GitHub stars
- [ ] Collect user feedback (issues, comments)
- [ ] Fix critical bugs immediately
- [ ] Document common questions
- [ ] Update FAQ based on feedback

---

## 📁 File Structure in This Repo

```
docs/
├─ README-GTM.md                           ← You are here
├─ GTM-STRATEGY-SUMMARY.md                 ← Start here
├─ GTM-LANDING-ONBOARDING.md               ← Detailed strategy
├─ LANDING-PAGE-COPY.md                    ← Copy templates
├─ REFERENCE-EXAMPLES.md                   ← Real-world examples
├─ LANDING-ONBOARDING-FLOW-DIAGRAMS.md     ← Visual reference
└─ (existing docs)
   ├─ PRODUCT.md                           ← Product vision
   ├─ ARCHITECTURE.md                      ← Tech architecture
   ├─ IMPLEMENTATION.md                    ← Sprint breakdown
   └─ BRANDING.md                          ← Build-in-public plan

tasks/
├─ ONBOARDING-LANDING-PAGE-TASKS.md        ← Actionable tasks
└─ (existing task files)

2vault-landing/                            ← NEW repo/folder (create)
├─ src/
│  ├─ app/
│  │  ├─ page.tsx                          ← Landing page
│  │  ├─ layout.tsx
│  │  └─ globals.css
│  ├─ components/
│  │  ├─ Hero.tsx
│  │  ├─ ProblemCard.tsx
│  │  ├─ FeatureGrid.tsx
│  │  ├─ FAQ.tsx
│  │  └─ (other sections)
│  └─ styles/
│     └─ tailwind.css
├─ public/
│  ├─ images/                              ← Screenshots, icons
│  ├─ privacy-policy.html
│  └─ og-image.png                         ← Social sharing image
├─ tailwind.config.ts
├─ tsconfig.json
├─ package.json
└─ next.config.js

src/popup/                                 ← Existing extension code
├─ components/
│  ├─ Settings.tsx                         ← MODIFY for onboarding
│  └─ onboarding/                          ← NEW folder
│     ├─ GetStartedTab.tsx
│     ├─ Step1Obsidian.tsx
│     ├─ Step2LLM.tsx
│     ├─ Step3VaultSettings.tsx
│     └─ HelpTab.tsx
└─ popup.tsx                               ← MODIFY to show onboarding
```

---

## 💡 Key Insights

**From product management perspective:**

1. **Clarity > Perfection**
   - Users don't need a beautiful landing page, they need to understand what your product does in 30 seconds
   - Onboarding doesn't need animations, it needs clear next steps and real-time validation

2. **Reduce Setup Friction**
   - Every API key required is a potential drop-off point
   - Make API key discovery as easy as possible (direct links, screenshots)
   - Real-time validation helps users know they're on the right track

3. **Progressive Disclosure**
   - Don't show vault settings until both APIs are configured
   - Don't show bookmark browser until setup is complete
   - Advanced options can wait (tag groups, PARA vs Custom, etc.)

4. **Community Matters**
   - Open source changes the conversation (people will try it for curiosity)
   - User testimonials/reviews are your best marketing (collect aggressively post-launch)
   - Reddit/Discord users are your core audience (engage early)

5. **The Magic Moment**
   - The moment a user sees their first processed note appear in Obsidian is when they become believers
   - Every onboarding step should point toward that moment ("Go to Bookmark Browser")
   - Success metrics should track: % of installers who experience that moment

---

## 🎬 Next Steps (Right Now)

1. **Pick a timeline.** 2-3 weeks? 4-5 days? Be realistic.

2. **Read GTM-STRATEGY-SUMMARY.md.** 15 minutes. Get aligned on strategy.

3. **Answer the 5 architecture decisions** (above). Write answers in a Notion doc or GitHub issue.

4. **Skim LANDING-ONBOARDING-FLOW-DIAGRAMS.md.** Look at visual layouts. Does it feel right?

5. **Create Figma wireframes** (2-3 hours). Use diagrams as a template. Share with 1-2 people.

6. **Start Phase 1 of tasks** (Planning & Design). 6-8 hours of focused work.

7. **Build landing page** (1 week). Use LANDING-PAGE-COPY.md as your copy reference.

8. **Build onboarding** (1 week). Use flow diagrams as your UI reference.

9. **Launch.** Chrome Web Store + social media on same day.

10. **Iterate.** First user feedback is worth months of speculation.

---

## 📞 Questions to Answer

**Before starting:**
1. What's your launch date target?
2. Do you want to build landing page first, or onboarding first, or parallel?
3. Will you use Next.js or plain HTML?
4. Do you want to collect email signups on landing page? (I'd say no for MVP)
5. Will you open-source the landing page code? (Probably yes, for credibility)

**During building:**
1. When you test onboarding with 1-2 real users, where do they get confused?
2. When you review landing page, does the headline make someone unfamiliar with 2Vault understand immediately?
3. Are there any validation errors in extension that aren't actionable?

**After launch:**
1. What's your actual onboarding completion rate?
2. Where are users dropping off?
3. What's the most common user question?
4. Who are your first 10 users? (Engage with them directly)

---

## 📚 Additional Resources

- **Obsidian ecosystem:**
  - Official Obsidian forums: https://forum.obsidian.md
  - r/ObsidianMD: https://reddit.com/r/ObsidianMD
  - Obsidian Discord: https://discord.gg/obsidian

- **Developer marketing:**
  - "Indie Hackers" community: https://indiehackers.com
  - Hacker News: https://news.ycombinator.com
  - Product Hunt: https://producthunt.com

- **Landing page inspiration:**
  - Good Landing Pages: https://www.goodlanding.pages
  - Unbounce: https://unbounce.com/landing-page-examples
  - Letterboxd (example of niche community marketing): https://letterboxd.com

- **Chrome extension distribution:**
  - Chrome Web Store Developer Dashboard: https://chrome.google.com/webstore/developer/dashboard
  - Manifest V3 Documentation: https://developer.chrome.com/docs/extensions/mv3

---

## 🎯 Final Thought

You've already solved the hard problem: building a product users actually want (vault-aware categorization for bookmarks). The landing page and onboarding are about **clearing the path** from "I heard about this" to "I'm now using this."

Every sentence, every form field, every error message is an opportunity to say: "This is worth your 15 minutes of setup."

Make it count.

Ship it.

Learn from users.

Iterate.

You've got this. 🚀

---

**Questions? File an issue on GitHub. Let's ship.**
