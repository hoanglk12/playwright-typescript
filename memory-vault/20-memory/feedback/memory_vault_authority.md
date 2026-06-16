---
name: memory-vault-authority
description: The vault (memory-vault/) is authoritative — Claude writes memory directly to vault; seed is deprecated
type: feedback
tags: [memory, feedback]
last_verified: 2026-06-16
---

**The vault at `memory-vault/20-memory/` is the single source of truth for all memory notes.**

**Why:** The old seed→vault sync (`sync-memory-to-vault.mjs`) overwrote enriched vault content with stale seed content on 2026-06-16, silently deleting 3 critical feedback entries. The flow has since been corrected.

## Current memory flow (as of 2026-06-16)

1. Claude writes memory notes **directly** to `memory-vault/20-memory/{type}/filename.md`
2. The `sync-memory.js` PostToolUse hook detects the vault write and runs `sync-vault-to-lightrag.mjs`
3. LightRAG is updated automatically — no manual step needed
4. At session end, the Stop hook also runs `sync-vault-to-lightrag.mjs` as a safety net

## Scripts

| Script | Status | Purpose |
|---|---|---|
| `scripts/sync-vault-to-lightrag.mjs` | Active | Diff-based vault → LightRAG sync |
| `scripts/sync-memory-to-vault.mjs` | No-op (deprecated) | Was seed → vault; now does nothing |
| `scripts/init-memory-from-vault.mjs` | Active | New machine bootstrap only |

## Rules

- **Write memory to `memory-vault/20-memory/{type}/`** — never to `~/.claude/projects/.../memory/` (seed)
- **Never run `sync-memory-to-vault.mjs`** — it is a no-op and the old behavior was destructive
- **To manually resync to LightRAG:** `node scripts/sync-vault-to-lightrag.mjs`
- **Seed files** at `~/.claude/.../memory/` are stale snapshots — ignore them
