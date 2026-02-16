/**
 * Generate extension icons for 2Vault.
 *
 * Creates simple "2V" text icons on Catppuccin Mocha background.
 * Uses SVG -> PNG conversion via resvg-js (install as dev dep if needed).
 *
 * Usage: bun run scripts/generate-icons.ts
 *
 * If resvg-js is not available, falls back to writing SVG files
 * that can be converted manually.
 */

import { writeFileSync } from "fs";
import { join } from "path";

const ICONS_DIR = join(import.meta.dirname, "..", "icons");

// Catppuccin Mocha colors
const BG_COLOR = "#1e1e2e"; // base
const ACCENT_COLOR = "#cba6f7"; // mauve

const sizes = [16, 32, 48, 128] as const;

function generateSvg(size: number): string {
  const fontSize = Math.round(size * 0.42);
  const borderRadius = Math.round(size * 0.15);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${borderRadius}" fill="${BG_COLOR}"/>
  <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle"
    font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    font-weight="800" font-size="${fontSize}px" fill="${ACCENT_COLOR}"
    letter-spacing="-0.5px">2V</text>
</svg>`;
}

async function main() {
  let hasResvg = false;
  let Resvg: typeof import("@aspect-run/resvg") | undefined;

  try {
    Resvg = await import("@aspect-run/resvg");
    hasResvg = true;
  } catch {
    // Try alternative package name
    try {
      Resvg = await import("@aspect-run/resvg");
      hasResvg = true;
    } catch {
      // No SVG-to-PNG converter available
    }
  }

  for (const size of sizes) {
    const svg = generateSvg(size);
    const svgPath = join(ICONS_DIR, `icon-${size}.svg`);

    if (hasResvg && Resvg) {
      // Convert SVG to PNG
      const resvg = new Resvg.Resvg(svg, { fitTo: { mode: "width", value: size } });
      const png = resvg.render().asPng();
      writeFileSync(join(ICONS_DIR, `icon-${size}.png`), png);
      console.log(`Generated icon-${size}.png`);
    } else {
      // Write SVG files as fallback
      writeFileSync(svgPath, svg);
      console.log(`Generated icon-${size}.svg (convert to PNG manually - no resvg available)`);
    }
  }

  console.log("Done! Icons saved to icons/");
}

main().catch(console.error);
