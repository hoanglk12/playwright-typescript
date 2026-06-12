# CLAUDE.md — Memory Vault Retrieval Policy

This vault is the curated knowledge layer for the **Playwright TypeScript automation framework** at `C:\Users\Lincoln.Pham\Documents\AccentGroupDocs\AutomationTest\playwright-typescript`. It mirrors the Claude Code memory files and provides an Obsidian graph view, backlinks, and search across all remembered context.

## Read order

1. Open `00-index.md` first — it lists every memory note and what it covers.
2. For any question about framework patterns, open the relevant note in `20-memory/`, then follow `[[wikilinks]]` to related notes.
3. Memory types: `user` = who the user is; `feedback` = corrections and confirmed patterns; `project` = active work, decisions, quirks; `reference` = external system pointers.

## Grounding rules

- **Vault is a mirror, not the source.** Canonical memory lives in `.claude/memory-seed/` (git-tracked). This vault is a read-optimized view.
- **Do not edit notes here and expect them to flow back.** Sync is one-way: seed → vault.
- **Check `last_verified`** — notes are stamped with the seed sync date. Run `/sync-vault` to refresh.
- **`type: feedback` notes** encode patterns Claude should repeat or avoid. Read them before making framework suggestions.

## Syncing

Run `/sync-vault` in a Claude Code session, or wait for the automatic Stop-hook sync at session end.
Manual: `node scripts/sync-memory-to-vault.mjs` from the project root.

## Searching the vault

Use built-in `Glob` and `Grep` tools — no MCP or extra process needed.

| Goal | Tool | Pattern / Path |
|------|------|----------------|
| List all notes of a type | `Glob` | pattern `memory-vault/20-memory/project/*.md` (no `path` arg — run from project root; swap `project` for `user`, `feedback`, `reference`) |
| Find notes with a tag | `Grep` | pattern `tags:.*graphql`, path `memory-vault/20-memory/` |
| Full-text keyword search | `Grep` | keyword, path `memory-vault/20-memory/` |
| Read the index | `Read` | `memory-vault/00-index.md` |
| Read a specific note | `Read` | `memory-vault/20-memory/{type}/{filename}.md` |

**Search-first rule:** before answering any question about framework patterns, API quirks, or user preferences, run a Grep over `memory-vault/20-memory/` for the relevant keyword. Do not rely on memory of prior sessions alone.

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
