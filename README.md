# 2Vault

AI-powered Chrome extension that reads, digests, and categorizes web bookmarks into your Obsidian vault.

## Development

```bash
bun install          # Install dependencies
bun dev              # Start Vite dev server (extension hot reload via CRXJS)
bun run typecheck    # TypeScript type-check
bun run build        # Production build -> dist/
bun test             # Run tests
```

## Manual Testing

1. Run `bun run build`
2. Open `chrome://extensions` and enable Developer Mode
3. Click "Load unpacked" and select the `dist/` folder
4. Open Obsidian with Local REST API plugin enabled
5. Configure API keys in the extension popup settings

## License

AGPL-3.0
