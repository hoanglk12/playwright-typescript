---
description: Sync memory vault notes to LightRAG — pushes all files under memory-vault/20-memory/ into the local LightRAG instance (vault is authoritative; never runs sync-memory-to-vault.mjs)
---

Sync the memory vault to LightRAG.

**Important:** `memory-vault/20-memory/` is the authoritative source. Never run `sync-memory-to-vault.mjs` — it goes the wrong direction (seed → vault) and overwrites enriched vault content with stale seed data.

Run: `node scripts/sync-vault-to-lightrag.mjs`

After the script completes:
1. Report how many notes were inserted or updated in LightRAG
2. Note any files that were skipped or errored
3. Confirm LightRAG is reachable at http://localhost:9621
