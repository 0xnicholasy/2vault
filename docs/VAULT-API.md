# Obsidian Local REST API Reference

This document captures tested behavior of the Obsidian Local REST API plugin, including version-specific quirks and compatibility workarounds used in 2Vault.

**Plugin:** [obsidian-local-rest-api](https://github.com/coddingtonbear/obsidian-local-rest-api)
**Tested version:** v3.4.3 (with Obsidian v1.11.7, macOS)
**Last updated:** 2026-02-17

---

## Endpoints

### Default Ports

| Protocol | Port | Notes |
|----------|------|-------|
| HTTP | 27123 | Non-encrypted. Some endpoints broken in v3.4.3 (see below) |
| HTTPS | 27124 | Self-signed cert. Full API works. **Recommended.** |

### Authentication

All endpoints except `GET /` require Bearer token auth:
```
Authorization: Bearer <api-key>
```

API key is found in Obsidian Settings > Local REST API.

### Endpoint Reference

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| `GET` | `/` | Working | Health check. Returns `{ status, authenticated, versions, apiExtensions }` |
| `GET` | `/vault/` | **HTTPS only** | List root files. Returns `{ files: string[] }`. **Returns 404 on HTTP in v3.4.3.** |
| `GET` | `/vault/{dir}/` | **HTTPS only** | List directory files. Same 404 bug on HTTP. |
| `GET` | `/vault/{path}` | Working | Read file content. Returns raw markdown with `Accept: text/markdown` |
| `PUT` | `/vault/{path}` | Working | Create/overwrite file. Body = markdown content. Returns 204. |
| `DELETE` | `/vault/{path}` | Working | Delete file. Returns 204. |
| `PATCH` | `/vault/{path}` | **Changed in v3.4+** | Requires `Target-Type` header. See PATCH section below. |
| `POST` | `/search/simple/?query=X` | Working | **Query as URL param, NOT body text** (changed in v3.4+). |
| `GET` | `/commands/` | Working | List available Obsidian commands. |
| `POST` | `/commands/{commandId}` | Working | Execute an Obsidian command. |

---

## v3.4.3 Breaking Changes

### 1. Directory Listing 404 on HTTP Endpoint

**Symptom:** `GET /vault/` and `GET /vault/{dir}/` return `{ "message": "Not Found", "errorCode": 40400 }` on HTTP (port 27123).

**Root cause:** Unknown. The route IS registered in source code (`this.api.route("/vault/*").get(...)`). Appears to be a bug specific to the non-encrypted HTTP server in v3.4.3. Confirmed by GitHub issue [#212](https://github.com/coddingtonbear/obsidian-local-rest-api/issues/212).

**Workaround:** Use HTTPS endpoint (`https://localhost:27124`). In code, `listFolders()` catches 404 and returns empty array as graceful fallback.

**File operations on same path work on HTTP** - only directory listing is broken.

### 2. Search Endpoint: Body Text No Longer Accepted

**Old behavior (v3.2):**
```bash
# Worked in v3.2 - query as POST body with text/plain
curl -X POST /search/simple/ -H "Content-Type: text/plain" -d "search term"
```

**New behavior (v3.4+):**
```bash
# v3.4+ requires query as URL parameter
curl -X POST "/search/simple/?query=search%20term"
```

Body-based search returns: `{ "message": "The search query you provided is not valid.\nA single '?query=' parameter is required.", "errorCode": 40090 }`

**Code fix:** `VaultClient.searchNotes()` now uses `?query=` URL parameter.

### 3. PATCH Requires Target-Type Header

**Old behavior:** Simple PATCH to append content to a note:
```bash
curl -X PATCH /vault/path.md -H "Content-Type: text/markdown" -d "appended content"
```

**New behavior (v3.4+):** Requires `Target-Type` header (one of: `heading`, `block`, `frontmatter`) and `Operation` header. Simple append is no longer supported via PATCH.

Error without header: `{ "message": "No 'Target-Type' header was provided.", "errorCode": 40053 }`
Error with invalid value: `{ "message": "The 'Target-Type' header you provided was invalid.", "errorCode": 40054 }`

**Valid Target-Type values:** `heading`, `block`, `frontmatter`

**Code fix:** `VaultClient.appendToNote()` now uses read + PUT (read existing content, concatenate, overwrite).

---

## API Response Formats

### Health Check (`GET /`)
```json
{
  "status": "OK",
  "manifest": { "id": "obsidian-local-rest-api", "version": "3.4.3", ... },
  "versions": { "obsidian": "1.11.7", "self": "3.4.3" },
  "service": "Obsidian Local REST API",
  "authenticated": true,
  "certificateInfo": { "validityDays": 363.97, "regenerateRecommended": false },
  "apiExtensions": []
}
```

### File Listing (`GET /vault/` or `GET /vault/{dir}/`)
```json
{
  "files": [
    "Inbox/",
    "Resources/AI/note.md",
    "Projects/2Vault/readme.md"
  ]
}
```

Directories end with `/`. Files include full relative path from vault root.

### Search (`POST /search/simple/?query=X`)
```json
[
  {
    "filename": "Inbox/test-note.md",
    "score": -1.1422,
    "matches": [
      {
        "match": { "start": 0, "end": 4, "source": "filename" },
        "context": "test-note"
      },
      {
        "match": { "start": 2, "end": 6, "source": "content" },
        "context": "# Test Note"
      }
    ]
  }
]
```

---

## Code Mapping

These are the vault-client methods and their API mappings:

| Method | API Call | Notes |
|--------|----------|-------|
| `testConnection()` | `GET /` | Checks `authenticated === true` |
| `listFolders()` | `GET /vault/` + `GET /vault/{dir}/` | 404 fallback returns `[]` |
| `searchNotes(q)` | `POST /search/simple/?query=q` | URL param, not body |
| `readNote(path)` | `GET /vault/{path}` | Accept: text/markdown |
| `noteExists(path)` | `GET /vault/{path}` | Catches 404 -> false |
| `createNote(path, content)` | `PUT /vault/{path}` | Content-Type: text/markdown |
| `appendToNote(path, content)` | `GET` + `PUT /vault/{path}` | Read-modify-write (PATCH broken) |

---

## Troubleshooting

### All URLs fail with "HTTP 404: GET /vault/"
The user is on the HTTP endpoint. **Fix:** Switch vault URL to `https://localhost:27124` in extension settings. This is the default.

### Search returns empty but notes exist
Check that the search query isn't empty or too short. The search is text-based (not glob). Try longer, more specific terms.

### "Network error: Failed to fetch" from extension
The extension needs to reach `localhost:27124` (or configured port). Ensure:
1. Obsidian is running
2. Local REST API plugin is enabled
3. The correct port is configured in extension settings
4. For HTTPS: Chrome must accept the self-signed cert (visit `https://localhost:27124` in browser and accept)

### apiExtensions is empty
This is normal. `apiExtensions` lists endpoints registered by other Obsidian plugins. Empty means no plugins have registered additional API routes.
