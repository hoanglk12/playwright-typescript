# CLAUDE.md — Memory Vault Retrieval Policy

This vault is the curated knowledge layer for the **Playwright TypeScript automation framework** at `C:\Users\Lincoln.Pham\Documents\AccentGroupDocs\AutomationTest\playwright-typescript`. It mirrors the Claude Code memory files and provides an Obsidian graph view, backlinks, and search across all remembered context.

## Read order

1. Open `00-index.md` first — it lists every memory note and what it covers.
2. For any question about framework patterns, open the relevant note in `20-memory/`, then follow `[[wikilinks]]` to related notes.
3. Memory types: `user` = who the user is; `feedback` = corrections and confirmed patterns; `project` = active work, decisions, quirks; `reference` = external system pointers.

## Grounding rules

- **Vault is the committed source.** Live memory (`~/.claude/projects/.../memory/`) syncs here on every write via the PostToolUse hook.
- **Do not edit vault notes directly** — they are overwritten on the next sync from live memory.
- **Check `last_verified`** — notes are stamped with the last sync date. Run `/sync-vault` to refresh.
- **`type: feedback` notes** encode patterns Claude should repeat or avoid. Read them before making framework suggestions.

## Syncing

Run `/sync-vault` in a Claude Code session, or wait for the automatic Stop-hook sync at session end.
Manual: `node scripts/sync-memory-to-vault.mjs` from the project root.

## Searching the vault

Use built-in `Glob` and `Grep` tools for exact lookups — no MCP or extra process needed.
Use `mcp__lightrag__query` for semantic or multi-note synthesis queries.

| Goal | Tool | Pattern / Path |
|------|------|----------------|
| List all notes of a type | `Glob` | pattern `memory-vault/20-memory/project/*.md` (no `path` arg — run from project root; swap `project` for `user`, `feedback`, `reference`) |
| Find notes with a tag | `Grep` | pattern `tags:.*graphql`, path `memory-vault/20-memory/` |
| Full-text keyword search | `Grep` | keyword, path `memory-vault/20-memory/` |
| Read the index | `Read` | `memory-vault/00-index.md` |
| Read a specific note | `Read` | `memory-vault/20-memory/{type}/{filename}.md` |
| Semantic / multi-note synthesis | `mcp__lightrag__query` | query string, mode `"hybrid"` |

**Search-first rule:** before answering any question about framework patterns, API quirks, or user preferences, run a Grep over `memory-vault/20-memory/` for the relevant keyword. Do not rely on memory of prior sessions alone.

**LightRAG query rule:** when the question spans multiple notes, requires relationship reasoning ("what are all constraints for X?", "list everything that affects Y"), or Grep returns no relevant results — call `mcp__lightrag__query` with the question as the query string and `mode: "hybrid"`. Check `mcp__lightrag__check_lightrag_health` first; if the server is not running, fall back to Grep.

**Mode reference:**

| Mode | Best for |
|------|----------|
| `"hybrid"` | General use — graph + vector combined (recommended default) |
| `"local"` | Specific entity neighborhood ("tell me about BasePage") |
| `"global"` | Theme-level summary ("list all ecommerce patterns") |

**Tag reference:**

| Tag | Notes it marks |
|-----|----------------|
| `memory, user` | Who the user is, working style, environment |
| `memory, feedback` | Corrections, confirmed patterns, things to avoid |
| `memory, project` | Active work, architecture decisions, API quirks, ecommerce patterns |
| `memory, reference` | External system pointers (none currently) |

## House style

- Notes use YAML frontmatter with top-level `type:`, `tags:`, `last_verified:`.
- Relationships expressed as `[[wikilinks]]`.
