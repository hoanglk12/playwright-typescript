---
description: Sync memory vault notes to LightRAG
---

Sync the memory vault to LightRAG.

**Important:** `memory-vault/20-memory/` is the authoritative source. Never run `sync-memory-to-vault.mjs` — it goes the wrong direction and overwrites enriched vault content.

Run: `node scripts/sync-vault-to-lightrag.mjs`

After the script completes:
1. Report how many notes were inserted or updated in LightRAG
2. Note any files that were skipped or errored
3. Confirm LightRAG is reachable at http://localhost:9621
