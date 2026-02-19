/**
 * Sprint 1.4 Validation Script
 *
 * Processes URLs from scripts/urls.txt through the full 2Vault pipeline:
 *   Extract -> Analyze Vault -> LLM Process -> Format -> Create Note
 *
 * Requires:
 *   - .env with OPENROUTER_API_KEY, VAULT_URL, VAULT_API_KEY
 *   - Obsidian running with Local REST API plugin enabled
 *
 * Usage: bun run scripts/validate.ts
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import type { Config, ProcessingResult } from "../src/core/types";
import { VaultClient } from "../src/core/vault-client";
import { processUrls, createDefaultProvider } from "../src/core/orchestrator";

// -- Load environment ---------------------------------------------------------

function loadEnv(): Record<string, string> {
  const envPath = resolve(__dirname, "../.env");
  let raw: string;
  try {
    raw = readFileSync(envPath, "utf-8");
  } catch {
    console.error("ERROR: .env file not found. Copy .env.example to .env and fill in your keys.");
    process.exit(1);
  }

  const vars: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (key) vars[key] = value;
  }
  return vars;
}

// -- Load URLs ----------------------------------------------------------------

function loadUrls(): string[] {
  const urlsPath = resolve(__dirname, "urls.txt");
  let raw: string;
  try {
    raw = readFileSync(urlsPath, "utf-8");
  } catch {
    console.error("ERROR: scripts/urls.txt not found.");
    process.exit(1);
  }

  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

// -- Test vault connection ----------------------------------------------------

async function testVaultConnection(config: Config): Promise<boolean> {
  const client = new VaultClient(config.vaultUrl, config.vaultApiKey);
  try {
    const result = await client.testConnection();
    return result.ok && result.authenticated;
  } catch {
    return false;
  }
}

// -- Main ---------------------------------------------------------------------

async function main() {
  console.log("=== 2Vault Validation Script ===\n");

  // 1. Load config
  const env = loadEnv();

  const vaultUrl = env["VAULT_URL"] || "https://localhost:27124";
  const vaultApiKey = env["VAULT_API_KEY"];
  const apiKey = env["OPENROUTER_API_KEY"];

  if (!apiKey) {
    console.error("ERROR: OPENROUTER_API_KEY not set in .env");
    process.exit(1);
  }

  if (!vaultApiKey) {
    console.error("ERROR: VAULT_API_KEY not set in .env");
    process.exit(1);
  }

  const config: Config = {
    apiKey,
    llmProvider: "openrouter",
    vaultUrl,
    vaultApiKey,
    vaultName: "2Vault-Test",
    vaultOrganization: "para",
    tagGroups: [],
    summaryDetailLevel: "standard",
  };

  console.log("LLM Provider: openrouter");
  console.log(`Vault URL: ${vaultUrl}`);

  // 2. Test vault connection
  console.log("Testing vault connection...");
  const connected = await testVaultConnection(config);
  if (!connected) {
    console.error(
      "\nERROR: Cannot connect to Obsidian vault.\n" +
      "Make sure:\n" +
      '  1. Obsidian is running\n' +
      '  2. "Local REST API" plugin is installed and enabled\n' +
      "  3. VAULT_URL and VAULT_API_KEY in .env are correct\n"
    );
    process.exit(1);
  }
  console.log("Vault connection OK\n");

  // 3. Load URLs
  const urls = loadUrls();
  console.log(`Processing ${urls.length} URLs...\n`);

  if (urls.length === 0) {
    console.log("No URLs to process. Add URLs to scripts/urls.txt");
    process.exit(0);
  }

  // 4. Process
  const startTime = Date.now();
  const provider = createDefaultProvider(config);

  const results = await processUrls(urls, config, provider, (url, status, index, total) => {
    const pct = Math.round(((index + 1) / total) * 100);
    const shortUrl = url.length > 60 ? url.slice(0, 57) + "..." : url;
    console.log(`  [${pct}%] ${status.padEnd(12)} ${shortUrl}`);
  });

  const elapsed = Date.now() - startTime;

  // 5. Print results table
  console.log("\n--- Results ---\n");
  console.log(
    "URL".padEnd(55) +
    "Status".padEnd(10) +
    "Folder".padEnd(25) +
    "Tags"
  );
  console.log("-".repeat(110));

  for (const r of results) {
    const shortUrl = r.url.length > 53 ? r.url.slice(0, 50) + "..." : r.url;
    const status = r.status === "success" ? "OK" : "FAIL";
    const folder = r.folder ?? r.error?.slice(0, 23) ?? "-";
    const tags = r.note?.suggestedTags.join(", ") ?? "-";
    console.log(
      shortUrl.padEnd(55) +
      status.padEnd(10) +
      folder.padEnd(25) +
      tags
    );
  }

  // 6. Print metrics
  const successes = results.filter((r) => r.status === "success");
  const failures = results.filter((r) => r.status === "failed");

  console.log("\n--- Metrics ---\n");
  console.log(`Total URLs:              ${results.length}`);
  console.log(`Successes:               ${successes.length}`);
  console.log(`Failures:                ${failures.length}`);
  console.log(
    `Extraction success rate: ${((successes.length / results.length) * 100).toFixed(1)}% (target: >85%)`
  );
  console.log(`Total time:              ${(elapsed / 1000).toFixed(1)}s`);
  console.log(
    `Avg time per URL:        ${(elapsed / results.length / 1000).toFixed(1)}s`
  );

  // 7. Write detailed results
  const resultsPath = resolve(__dirname, "results.json");
  writeFileSync(
    resultsPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        config: { llmProvider: "openrouter", vaultUrl, vaultOrganization: config.vaultOrganization },
        metrics: {
          total: results.length,
          successes: successes.length,
          failures: failures.length,
          extractionSuccessRate: successes.length / results.length,
          categorizationRate: nonDefaultFolder.length / Math.max(successes.length, 1),
          elapsedMs: elapsed,
          avgMsPerUrl: elapsed / results.length,
        },
        results: results.map((r) => ({
          url: r.url,
          status: r.status,
          folder: r.folder,
          tags: r.note?.suggestedTags,
          title: r.note?.title,
          error: r.error,
        })),
      },
      null,
      2
    ),
    "utf-8"
  );
  console.log(`\nDetailed results written to: ${resultsPath}`);

  // 8. Exit code
  if (failures.length > 0) {
    console.log(`\n${failures.length} URL(s) failed. Review errors above.`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
