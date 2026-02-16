import type { ProcessedNote } from "@/core/types.ts";

/**
 * Characters that require YAML values to be quoted.
 * Covers colons, quotes, hash (comments), and newlines.
 */
const YAML_UNSAFE_PATTERN = /[:"'#\n]/;

function escapeYamlValue(value: string): string {
  if (YAML_UNSAFE_PATTERN.test(value)) {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return value;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatNote(
  processed: ProcessedNote,
  dateSaved?: Date
): string {
  const saved = formatDate(dateSaved ?? new Date());
  const lines: string[] = [];

  // YAML frontmatter
  lines.push("---");
  lines.push(`source: ${escapeYamlValue(processed.source.url)}`);

  if (processed.source.author) {
    lines.push(`author: ${escapeYamlValue(processed.source.author)}`);
  }

  if (processed.source.datePublished) {
    lines.push(
      `date_published: ${escapeYamlValue(processed.source.datePublished)}`
    );
  }

  lines.push(`date_saved: ${saved}`);

  if (processed.suggestedTags.length > 0) {
    lines.push("tags:");
    for (const tag of processed.suggestedTags) {
      lines.push(`  - ${escapeYamlValue(tag)}`);
    }
  }

  lines.push(`type: ${processed.type}`);

  if (processed.type === "social-media") {
    lines.push(`platform: ${processed.platform}`);
  }

  lines.push("status: unread");
  lines.push("---");
  lines.push("");

  // Body
  lines.push(`# ${processed.title}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(processed.summary);
  lines.push("");

  if (processed.type === "social-media") {
    // Social media template
    lines.push("## Key Points");
    lines.push("");
    for (const point of processed.keyTakeaways) {
      lines.push(`- ${point}`);
    }
    lines.push("");
    lines.push("## Original Content");
    lines.push("");
    const contentLines = processed.source.content.split("\n");
    for (const contentLine of contentLines) {
      lines.push(`> ${contentLine}`);
    }
    lines.push("");
  } else {
    // Article template
    lines.push("## Key Takeaways");
    lines.push("");
    for (const takeaway of processed.keyTakeaways) {
      lines.push(`- ${takeaway}`);
    }
    lines.push("");
  }

  lines.push("## Source");
  lines.push("");
  lines.push(`[${processed.title}](${processed.source.url})`);
  lines.push("");

  return lines.join("\n");
}

export function generateFilename(title: string): string {
  if (!title.trim()) {
    return "untitled.md";
  }

  let slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");

  if (slug.length > 60) {
    // Try to truncate at a word boundary (hyphen)
    const truncated = slug.slice(0, 60);
    const lastHyphen = truncated.lastIndexOf("-");
    if (lastHyphen > 40) {
      slug = truncated.slice(0, lastHyphen);
    } else {
      slug = truncated.replace(/-+$/, "");
    }
  }

  if (!slug) {
    return "untitled.md";
  }

  return `${slug}.md`;
}
