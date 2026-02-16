# Validation Script

Sprint 1.4 validation: process real URLs through the full 2Vault pipeline and review results in Obsidian.

## Prerequisites

1. **Obsidian desktop app** installed and running
2. **Local REST API** community plugin installed and enabled:
   - Obsidian Settings > Community plugins > Browse > search "Local REST API"
   - Install, enable, and copy the API key from plugin settings
3. **OpenRouter API key** from [openrouter.ai/keys](https://openrouter.ai/keys)

## Setup

```bash
# Copy env template and fill in your keys
cp .env.example .env

# Edit .env:
#   OPENROUTER_API_KEY=sk-or-...
#   VAULT_API_KEY=<from Obsidian Local REST API plugin settings>
#   VAULT_URL=https://localhost:27124  (default, usually correct)
```

## Run

```bash
bun run validate
```

The script will:
1. Test the vault connection (exits early if unreachable)
2. Process each URL in `scripts/urls.txt`
3. Print a results table and metrics summary
4. Write detailed results to `scripts/results.json`

## Customize URLs

Edit `scripts/urls.txt` to add your own URLs. One per line, `#` for comments.

## Success Criteria

- Extraction success rate: >85%
- Categorization accuracy: >80% (manually review notes in Obsidian)
- Summary usefulness: "Would I read this instead of the original?"
