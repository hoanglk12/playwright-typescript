---
description: Sync Claude memory seed to the Obsidian memory vault (memory-vault/) — runs the deterministic transform script to update all notes
---

Sync the memory vault from the latest seed files.

Run: `node scripts/sync-memory-to-vault.mjs`

After the script completes:
1. List the files written to `memory-vault/`
2. Report how many notes were synced and which type subfolders received updates
3. Note any notes where frontmatter was normalized
