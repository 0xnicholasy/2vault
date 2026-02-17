# Technical Reference: Thread Support Implementation Details

---

## X/Twitter Thread Extraction: How It Works Today

### DOM Structure Assumed
```html
<article data-testid="tweet">
  <div>
    <span data-testid="User-Name">
      <span>Author Name</span>
      <span>@handle</span>
    </span>
  </div>
  <div data-testid="tweetText">Tweet text content here...</div>
  <time datetime="2024-01-15T10:30:00Z"></time>
</article>

<!-- If thread: multiple articles appear in DOM -->
<article data-testid="tweet">
  <!-- Second tweet in thread -->
</article>
```

### Detection Logic
```typescript
// In twitter-extractor.ts, line 75-78
function isThreadPage(): boolean {
  const tweets = document.querySelectorAll(SELECTORS.tweet);
  return tweets.length > 1;  // True if DOM has >1 tweet
}
```

**What triggers this:**
- User visits a post URL like: `https://x.com/someone/status/123`
- If that post has replies visible on initial page load → `isThreadPage()` returns true
- If it's a single post → returns false

### Extraction Logic
```typescript
// In twitter-extractor.ts, line 80-100
function extractThread(): { content: string; tweetCount: number } {
  const tweets = document.querySelectorAll(SELECTORS.tweet);
  const parts: string[] = [];

  for (let i = 0; i < tweets.length; i++) {
    const article = tweets[i]!;
    const text = extractTweetText(article);
    if (!text) continue;

    const quoteTweet = extractQuoteTweet(article);
    const images = extractImageDescriptions(article);

    // Numbered format: [1/N] content
    let part = `**[${i + 1}/${tweets.length}]** ${text}`;
    if (quoteTweet) part += `\n\n${quoteTweet}`;
    if (images.length > 0) part += `\n\n[Images: ${images.join(", ")}]`;

    parts.push(part);
  }

  return { content: parts.join("\n\n---\n\n"), tweetCount: tweets.length };
}
```

### Output Format Example
```markdown
**[1/3]** Here's a thread about async JavaScript.

---

**[2/3]** First, understand what callbacks are. A callback is a function passed to another function...

---

**[3/3]** Modern JS uses Promises and async/await, which are syntactic sugar over callbacks...
```

### Real-World Scenario

**User URL:** `https://x.com/someone/status/1234567890`

**What's on the page:**
- Main post: "Here's a thread about async JavaScript"
- Reply 1 (author): "First, understand what callbacks are..."
- Reply 2 (author): "Modern JS uses Promises..."
- Reply 1 (from @other_user): "Great explanation!"
- Reply 2 (from @another_user): "What about generators?"
- 42 more replies from random users

**What 2Vault captures:**
- ✅ Main post
- ✅ Author's first reply (if visible on initial DOM)
- ✅ Author's second reply (if visible on initial DOM)
- ❓ Maybe some top replies (depends on what rendered before JS finished)
- ❌ Does NOT scroll to load more
- ❌ User replies below the fold are missed

**Note created:**
```markdown
Thread by Someone (@someone) (3 tweets)

**[1/3]** Here's a thread about async JavaScript.

---

**[2/3]** First, understand what callbacks are. A callback is...

---

**[3/3]** Modern JS uses Promises...
```

**User's reaction:**
- "Good, got the core thread"
- BUT: "Hmm, I missed that great point from @another_user"

---

## Why Full Scroll Doesn't Work

### The Technical Problem

X uses React and dynamic content loading. When you click "Show X more replies", X:
1. Loads new tweets from API
2. Re-renders DOM with new `article` elements
3. Inserts them at the end of the thread

**Our content script doesn't know about these dynamically loaded tweets.**

To capture them, we'd need to:
```typescript
// Pseudocode - NOT implemented
async function extractFullThread() {
  const startingCount = document.querySelectorAll(SELECTORS.tweet).length;

  while (true) {
    const showMoreBtn = document.querySelector('[aria-label="Show more replies"]');
    if (!showMoreBtn) break; // No more to load

    showMoreBtn.click();
    await sleep(500); // Wait for DOM update

    const newCount = document.querySelectorAll(SELECTORS.tweet).length;
    if (newCount === startingCount) break; // Nothing new loaded, stop

    startingCount = newCount;
  }

  return extractThread(); // Now capture all loaded tweets
}
```

### Why We Don't Do This

1. **Unreliable selectors:** "Show more replies" button selector changes monthly with X's redesigns
2. **Slow extraction:** Clicking + waiting + re-rendering = 30-60 seconds per URL
3. **Token bloat:** 50-tweet thread = 10,000+ tokens, exceeds cost budgets
4. **LLM confusion:** Too much noise for summarization
5. **Maintenance burden:** Selector versioning for every X update (version the button selector like we do tweets)

### Fragility Example
If X changes this:
```html
<!-- Current (v1) -->
<article data-testid="tweet">...</article>

<!-- X might change to (v2) -->
<div role="article" data-tweet-id="123">...</div>

<!-- Requires updating SELECTORS and VERSION -->
const SELECTOR_VERSION = 2; // Bump this
const SELECTORS = {
  tweet: 'div[role="article"]', // Update this
  // ... rest
};
```

Every few months = maintenance debt.

---

## Reddit Extraction: Why It's Missing

### The Problem
Reddit URLs fall through to generic `extractArticle()` in `extractor.ts`:

```typescript
// In extractor.ts, line 111-164
export async function fetchAndExtract(url: string): Promise<ExtractedContent> {
  const html = await fetch(url);
  const article = Readability.parse(html);
  const markdown = turndown.turndown(article);
  // Returns just the main post, loses comments
}
```

### What Gets Lost
Reddit's HTML structure:
```html
<article>Post title and content here</article>

<!-- Comments rendered separately by JavaScript -->
<div class="comment">
  <span>user123</span>
  <div>Comment text</div>
</div>
```

Readability focuses on the `<article>` tag and ignores comment divs → missing structure.

### Hypothetical Reddit Extractor (Not Implemented)
```typescript
// This would be src/content-scripts/reddit-extractor.ts (doesn't exist)
export function extractRedditThread(): ExtractedContent {
  const postTitle = document.querySelector('h1').textContent;
  const postAuthor = document.querySelector('[href*="/user/"]').textContent;
  const postScore = document.querySelector('[role="button"]').textContent;

  // Top 3 comments by upvotes
  const comments = Array.from(document.querySelectorAll('[class*="Comment"]'))
    .map(c => ({
      author: c.querySelector('[href*="/user/"]')?.textContent,
      text: c.querySelector('[class*="commentContent"]')?.textContent,
      score: c.querySelector('[class*="score"]')?.textContent,
    }))
    .sort((a, b) => parseInt(b.score) - parseInt(a.score))
    .slice(0, 3); // Only top 3

  return {
    title: postTitle,
    author: postAuthor,
    content: formatThreadMarkdown(postTitle, postAuthor, postScore, comments),
    type: 'social-media',
    platform: 'reddit',
    status: 'success',
  };
}
```

**Effort:** 2-3 days
- Learn Reddit's DOM structure
- Build selectors
- Test on 20+ Reddit URLs
- Version selectors (inevitable changes)

---

## LinkedIn Thread Support: Why It's Not Worth It

LinkedIn posts aren't thread-based like X. They're single posts with:
- Comments below (not part of the "thread")
- Shares (different post)
- Reactions (not text)

Value of capturing comments = Low (discussions are less coherent than X threads)

**Decision:** Keep LinkedIn as single-post only.

---

## Implementation Effort Comparison

| Feature | Effort | Maintenance Burden | Value |
|---------|--------|-------------------|-------|
| **X: Current (author thread only)** | Done | Low | Medium |
| **X: Full scroll extraction** | 3-5 days | High | Low |
| **X: Better metadata (show thread size)** | 1 day | Low | Medium |
| **Reddit: Post + top 3 comments** | 2-3 days | Medium | High |
| **Reddit: Full thread structure** | 5+ days | High | Low |
| **LinkedIn: Comments support** | 2 days | Medium | Low |

---

## What Should Be Done When

### Phase 3 (Current - GTM + Launch)
- ✅ Keep X extraction as-is
- ✅ Keep LinkedIn as-is
- ✅ Keep generic Reddit fallback
- ❌ Do NOT add Reddit extractor
- ❌ Do NOT add full X scroll

### Phase 3.5 (Month 2, Post-Launch)
- Gather feedback from real users
- IF users request Reddit support:
  - [ ] Create reddit-extractor.ts (2-3 days)
  - [ ] Extract post + top 3 comments
  - [ ] Add to manifest + content scripts
  - [ ] Version selectors: `const SELECTOR_VERSION = 1`
- IF users request full X threads:
  - [ ] Maybe add small improvement (show thread size)
  - [ ] Do NOT implement full scroll (too fragile)

### Phase 4+ (If it matters)
- YouTube transcript extraction (separate challenge)
- Facebook/Instagram (if demand)

---

## Selector Versioning Pattern (If We Add Extractors)

Used in both `twitter-extractor.ts` and hypothetical `reddit-extractor.ts`:

```typescript
/** Bump version when platform changes its DOM structure */
const SELECTOR_VERSION = 1;

const SELECTORS = {
  post: '.selector-for-post',
  author: '.selector-for-author',
  // ... more
} as const;

function fallbackExtraction(url: string, reason: string): ExtractedContent {
  console.warn(
    `[2Vault] Reddit extraction fallback (v${SELECTOR_VERSION}): ${reason}`
  );
  // Fall back to generic extraction
}
```

This allows us to:
1. Track which version of selectors we're using
2. Know when to update CLAUDE.md with breaking changes
3. Gracefully degrade if selectors break

---

## Testing Thread Extraction (Manual)

### X Test Cases
```
1. Single post (no thread):
   https://x.com/someone/status/123
   Expected: Single tweet extracted, title: "Post by @someone"

2. Author's 3-tweet thread:
   https://x.com/someone/status/123 (where tweet 123 has 2 follow-ups)
   Expected: Title includes "(3 tweets)", all 3 numbered [1/3], [2/3], [3/3]

3. Post with quote tweet:
   https://x.com/someone/status/123 (where tweet quotes another tweet)
   Expected: Main tweet + quoted tweet shown as "Quoted: @author: text"

4. Long thread with 10+ visible tweets:
   Expected: Captures all visible, doesn't scroll for more
```

### Reddit Test Cases (If Added)
```
1. Single post with few comments:
   https://reddit.com/r/ObsidianMD/comments/abc123/...
   Expected: Post + top 3 comments extracted

2. Highly voted post:
   https://reddit.com/r/programming/comments/def456/...
   Expected: Top comments by upvote, not by timestamp

3. Comment with nested replies:
   Expected: Flattened view (not deep nesting)
```

---

## Summary: Decision Tree

```
User asks: "Should we support full threads?"

├─ X/Twitter
│  ├─ Current: Captures author's thread + visible replies ✅
│  ├─ Full scroll: No, too fragile
│  ├─ Better metadata: Maybe (show thread size)
│  └─ Decision: Keep as-is, ship on schedule
│
├─ Reddit
│  ├─ Current: Generic Readability (missing comments) ⚠️
│  ├─ Add support: Maybe, validate demand first
│  ├─ Effort if yes: 2-3 days
│  └─ Decision: Defer to Month 2, decide based on user feedback
│
└─ LinkedIn
   ├─ Current: Single post ✅
   ├─ Thread support: Not applicable (not thread-based)
   └─ Decision: Keep as-is
```

**Bottom line:** Ship Phase 3 on schedule. Let real users tell us if deeper thread support matters.
