---
name: lightrag-vault-parsed-dir-false-alarm
description: memory-vault/20-memory/__parsed__ is a frozen duplicate directory that both sync scripts already exclude — don't recount it as "missing" vault coverage
metadata:
  type: project
---

`memory-vault/20-memory/__parsed__/` holds 13 files that are byte-identical duplicates of real vault notes (e.g. `user_profile.md`, `project_context.md`, `pla-api-testing.md`, `technical_debt_phase1.md`, and 9 others). It was created in the very first vault-infra commit (`4507d03`, 2026-06-13) and hasn't been touched since (`073baf6`, same day) — a frozen snapshot from the original bootstrap, not a live pipeline output.

Both `scripts/sync-vault-to-lightrag.mjs` and `scripts/init-memory-from-vault.mjs` already special-case it (`if (entry === '__parsed__') continue`). The real vault count is **46 unique `.md` files**, not 59 — a naive `find memory-vault/20-memory -name "*.md"` double-counts these 13.

**Why:** During the LightRAG 1.5.4→1.5.7 upgrade (2026-09-10) I flagged a "59 vault files vs 47 tracked docs" gap as a possible upgrade regression. It wasn't — it was my own comparison counting `__parsed__` duplicates. Verified via `diff` (identical content) and confirmed `__parsed__` is git-tracked, not gitignored, and referenced nowhere except the two scripts' exclusion checks. The actual tracked-doc count (46-47) matches the pre-upgrade backup's `kv_store_doc_status.json` (46, all `processed`) almost exactly — the index survived the upgrade intact.

**How to apply:** When counting "real" vault files for any sync/coverage check, always exclude `__parsed__` (same as the scripts do). If a future audit wants to clean this up, it's safe to delete — it's an inert duplicate — but confirm with the user first since it's a git-tracked directory, not scratch output. See [[lightrag-mcp-adapter-dependency-risk]] and the second-machine runbook at `docs/technical-research/lightrag-1.5.7-second-machine-runbook.html` for the surrounding upgrade context.
