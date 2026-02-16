import { describe, it, expect } from "vitest";
import { formatNote, generateFilename } from "@/core/note-formatter";
import type { ExtractedContent, ProcessedNote } from "@/core/types";

const FIXED_DATE = new Date("2026-02-16");

function createExtracted(
  overrides?: Partial<ExtractedContent>
): ExtractedContent {
  return {
    url: "https://example.com/article",
    title: "Test Article",
    content: "Full article content here.",
    author: "Jane Doe",
    datePublished: "2026-01-15",
    wordCount: 500,
    type: "article",
    platform: "web",
    status: "success",
    ...overrides,
  };
}

function createProcessed(overrides?: Partial<ProcessedNote>): ProcessedNote {
  return {
    title: "Test Article Summary",
    summary: "This article covers testing practices.",
    keyTakeaways: [
      "Always write tests first",
      "Mock external dependencies",
      "Test edge cases",
    ],
    suggestedFolder: "Reading/Articles",
    suggestedTags: ["testing", "development"],
    type: "article",
    platform: "web",
    source: createExtracted(),
    ...overrides,
  };
}

// -- formatNote: Article template ---------------------------------------------

describe("formatNote - article template", () => {
  it("includes correct YAML frontmatter fields", () => {
    const result = formatNote(createProcessed(), FIXED_DATE);

    expect(result).toContain("---");
    expect(result).toContain('source: "https://example.com/article"');
    expect(result).toContain("author: Jane Doe");
    expect(result).toContain("date_published: 2026-01-15");
    expect(result).toContain("date_saved: 2026-02-16");
    expect(result).toContain("type: article");
    expect(result).toContain("status: unread");
  });

  it("renders summary section", () => {
    const result = formatNote(createProcessed(), FIXED_DATE);

    expect(result).toContain("## Summary");
    expect(result).toContain("This article covers testing practices.");
  });

  it("renders key takeaways as bullet list", () => {
    const result = formatNote(createProcessed(), FIXED_DATE);

    expect(result).toContain("## Key Takeaways");
    expect(result).toContain("- Always write tests first");
    expect(result).toContain("- Mock external dependencies");
    expect(result).toContain("- Test edge cases");
  });

  it("renders source link", () => {
    const result = formatNote(createProcessed(), FIXED_DATE);

    expect(result).toContain("## Source");
    expect(result).toContain(
      "[Test Article Summary](https://example.com/article)"
    );
  });

  it("does not include platform field for articles", () => {
    const result = formatNote(createProcessed(), FIXED_DATE);

    expect(result).not.toMatch(/^platform:/m);
  });

  it("does not include Key Points section for articles", () => {
    const result = formatNote(createProcessed(), FIXED_DATE);

    expect(result).not.toContain("## Key Points");
    expect(result).not.toContain("## Original Content");
  });
});

// -- formatNote: Social media template ----------------------------------------

describe("formatNote - social media template", () => {
  const socialProcessed = createProcessed({
    title: "Interesting Thread on AI",
    type: "social-media",
    platform: "x",
    keyTakeaways: ["AI is evolving fast", "Open source is key"],
    source: createExtracted({
      type: "social-media",
      platform: "x",
      content: "This is the original tweet content.\nSecond line.",
      author: "@techuser",
    }),
  });

  it("includes platform in frontmatter", () => {
    const result = formatNote(socialProcessed, FIXED_DATE);

    expect(result).toContain("platform: x");
  });

  it("uses Key Points instead of Key Takeaways", () => {
    const result = formatNote(socialProcessed, FIXED_DATE);

    expect(result).toContain("## Key Points");
    expect(result).not.toContain("## Key Takeaways");
  });

  it("blockquotes original content", () => {
    const result = formatNote(socialProcessed, FIXED_DATE);

    expect(result).toContain("## Original Content");
    expect(result).toContain("> This is the original tweet content.");
    expect(result).toContain("> Second line.");
  });

  it("renders source link", () => {
    const result = formatNote(socialProcessed, FIXED_DATE);

    expect(result).toContain(
      "[Interesting Thread on AI](https://example.com/article)"
    );
  });

  it("sets type to social-media in frontmatter", () => {
    const result = formatNote(socialProcessed, FIXED_DATE);

    expect(result).toContain("type: social-media");
  });
});

// -- formatNote: YAML escaping ------------------------------------------------

describe("formatNote - YAML escaping", () => {
  it("escapes title with colons in source link context", () => {
    const processed = createProcessed({
      source: createExtracted({
        url: "https://example.com/post:special",
      }),
    });
    const result = formatNote(processed, FIXED_DATE);

    expect(result).toContain(
      'source: "https://example.com/post:special"'
    );
  });

  it("escapes author with quotes", () => {
    const processed = createProcessed({
      source: createExtracted({ author: 'O"Brien' }),
    });
    const result = formatNote(processed, FIXED_DATE);

    expect(result).toContain('author: "O\\"Brien"');
  });

  it("escapes author with single quotes", () => {
    const processed = createProcessed({
      source: createExtracted({ author: "O'Connor" }),
    });
    const result = formatNote(processed, FIXED_DATE);

    expect(result).toContain("author: \"O'Connor\"");
  });

  it("escapes values with hash characters", () => {
    const processed = createProcessed({
      source: createExtracted({ author: "User #42" }),
    });
    const result = formatNote(processed, FIXED_DATE);

    expect(result).toContain('author: "User #42"');
  });
});

// -- formatNote: Date handling ------------------------------------------------

describe("formatNote - date handling", () => {
  it("includes date_saved as ISO date string", () => {
    const result = formatNote(createProcessed(), FIXED_DATE);

    expect(result).toContain("date_saved: 2026-02-16");
  });

  it("omits date_published when null", () => {
    const processed = createProcessed({
      source: createExtracted({ datePublished: null }),
    });
    const result = formatNote(processed, FIXED_DATE);

    expect(result).not.toContain("date_published");
  });

  it("defaults to current date when dateSaved not provided", () => {
    const result = formatNote(createProcessed());

    // Should have some date_saved value (we can't predict exact date)
    expect(result).toMatch(/date_saved: \d{4}-\d{2}-\d{2}/);
  });
});

// -- formatNote: Null author --------------------------------------------------

describe("formatNote - null author", () => {
  it("omits author field when null", () => {
    const processed = createProcessed({
      source: createExtracted({ author: null }),
    });
    const result = formatNote(processed, FIXED_DATE);

    expect(result).not.toContain("author:");
  });
});

// -- formatNote: Tags formatting ----------------------------------------------

describe("formatNote - tags formatting", () => {
  it("renders each tag on its own line", () => {
    const result = formatNote(createProcessed(), FIXED_DATE);

    expect(result).toContain("tags:");
    expect(result).toContain("  - testing");
    expect(result).toContain("  - development");
  });

  it("omits tags section when empty", () => {
    const processed = createProcessed({ suggestedTags: [] });
    const result = formatNote(processed, FIXED_DATE);

    expect(result).not.toContain("tags:");
  });
});

// -- generateFilename ---------------------------------------------------------

describe("generateFilename", () => {
  it("converts title to kebab-case with .md extension", () => {
    expect(generateFilename("Hello World")).toBe("hello-world.md");
  });

  it("removes special characters", () => {
    expect(generateFilename("What's New in JS?")).toBe(
      "what-s-new-in-js.md"
    );
  });

  it("collapses consecutive hyphens", () => {
    expect(generateFilename("Hello --- World")).toBe("hello-world.md");
  });

  it("trims leading and trailing hyphens", () => {
    expect(generateFilename("--Hello World--")).toBe("hello-world.md");
  });

  it("truncates long titles at word boundary", () => {
    const longTitle =
      "This Is A Very Long Title That Exceeds The Maximum Character Limit For Filenames";
    const filename = generateFilename(longTitle);

    expect(filename.endsWith(".md")).toBe(true);
    // Remove .md to check slug length
    const slug = filename.slice(0, -3);
    expect(slug.length).toBeLessThanOrEqual(60);
    // Should not end with a hyphen
    expect(slug.endsWith("-")).toBe(false);
  });

  it("returns untitled.md for empty title", () => {
    expect(generateFilename("")).toBe("untitled.md");
  });

  it("returns untitled.md for whitespace-only title", () => {
    expect(generateFilename("   ")).toBe("untitled.md");
  });

  it("passes through already-kebab-case title", () => {
    expect(generateFilename("already-kebab-case")).toBe(
      "already-kebab-case.md"
    );
  });

  it("handles titles with numbers", () => {
    expect(generateFilename("Top 10 Tips for 2026")).toBe(
      "top-10-tips-for-2026.md"
    );
  });
});
