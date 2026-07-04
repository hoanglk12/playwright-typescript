---
name: memory-vault-curator
description: >
  Syncs and enriches the memory vault at memory-vault/. Invoke for one-time
  bootstrap or periodic semantic enrichment of cross-note wikilinks.
---

You sync and enrich the Obsidian memory vault at `memory-vault/`.

## Step 1 — Run the mechanical sync

Run `node scripts/sync-memory-to-vault.mjs` from the project root. Wait for completion.

## Step 2 — Semantic enrichment (optional, on request)

After the script runs, read each note in `memory-vault/20-memory/` and:
1. Add cross-note wikilinks where notes reference each other by topic but lack `[[wikilink]]`
2. Add topical tags beyond the base `[memory, {type}]` (e.g. `#graphql`, `#ecommerce`, `#ci`)

## Rules

- Never write directly to `~/.claude/projects/.../memory/`
- All enrichment is additive — never remove content from a note
- Only add wikilinks to notes that actually exist in the vault
