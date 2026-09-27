---
name: lightrag-sync-lifecycle
description: "What pushes vault notes into LightRAG and when (PostToolUse on vault write + Stop hook after every turn, both via lightrag-sync-status.js with a visible systemMessage), what never reaches it (.remember/, auto-memory seed, anything not written as a vault note), and the remaining gaps"
type: project
tags: [memory, project, lightrag]
last_verified: 2026-09-27
---

**Sync is automatic. Capture isn't.** A note gets into LightRAG automatically once it's written to the vault, but nothing writes it for you.

## What triggers a sync (`.claude/settings.json`)

Both triggers run `.claude/hooks/lightrag-sync-status.js`. It wraps `scripts/sync-vault-to-lightrag.mjs` and prints a `systemMessage` the user sees, but only when something happened:
- `LightRAG sync: queued for indexing: x.md (new)` when a note is inserted or updated
- `failed: x.md (...)` when an insert fails
- `LightRAG not running: N vault note(s) changed since the last sync are not indexed` when the server is down and notes are waiting
- `LightRAG sync problem: ...` when the health check or the script fails, or the sync times out

A sync with no changes, or one where notes are still being indexed, prints nothing.

- **PostToolUse** `Write|Edit|MultiEdit` → `.claude/hooks/sync-memory.js`. It acts only on a `.md` under `memory-vault/20-memory/`, with a 25s sync budget inside the hook's 30s timeout.
- **Stop** → `lightrag-sync-status.js` directly, with a 110s budget inside 120s. Stop fires when Claude finishes each response, not at session end, and no SessionEnd hook exists. So the sync runs after every turn, and each run catches up anything an earlier run missed.
- **Stop** → `.claude/hooks/vault-capture-nudge.js`. Once per session, it blocks the stop and asks whether a note is needed. It only fires if `advisor()` was called or an agent file or CLAUDE.md was edited, and no vault write happened. Nothing else prompts writing a note.

Both hook commands use `node "$CLAUDE_PROJECT_DIR/..."`, set on 2026-09-27. The old relative `node scripts/sync-vault-to-lightrag.mjs 2>&1 || true` crashed with `Cannot find module` whenever the hook ran from a folder other than the project root. `|| true` hid the crash, and this was confirmed by running it from the scratchpad.

## What never reaches LightRAG

LightRAG's `input_directory` is `memory-vault/20-memory/` only. These are never indexed:
- the `.remember/` buffer (`now.md`, `today-*.md`, `recent.md`)
- the deprecated `~/.claude/projects/.../memory/` seed
- anything learned in conversation that was never written as a vault note

## Remaining gaps

- **The server-down warning depends on a per-machine record.** It compares note file times against `.claude/.state/lightrag-last-sync.json` (gitignored). That file stores the start time of the last error-free sync. Without it, for example on a fresh clone, a down server stays silent until one sync succeeds. Touching files without changing them, such as a `git checkout`, can also trigger a false count while the server is down.
- **"Queued" only means inserted.** Indexing runs in the background. A doc that later fails shows up as `failed:` on the next sync, because the script skips docs that are still indexing but not docs that failed. To confirm by hand, wait for `GET /documents/pipeline_status` to show `busy:false`, then check that `POST /documents/paginated` lists the note as `processed`.
- **Stuck docs are silent.** If the server dies mid-indexing, a doc can stay `pending` or `processing`. The script skips in-flight docs on every run, and the last-sync record keeps advancing, so neither message ever mentions it. It's unconfirmed whether LightRAG 1.5.7 resumes such docs on restart. If recall misses a note you know was written, check its status with `POST /documents/paginated`.
- **A `failed:` message repeats every turn** until the failed doc is deleted with `DELETE /documents/delete_document` and body `{"doc_ids":["<id>"]}`. Never call bare `DELETE /documents`, which wipes the store. The next sync then re-inserts the note.
- **The sync never deletes.** A removed or renamed note stays in LightRAG as an orphan. `mcp-away-profile-config.md` was one as of 2026-09-27.
- The Stop hook still calls `scripts/sync-memory-to-vault.mjs` with a relative path. It's a deprecated no-op, so a crash there doesn't matter.
- Claude Code may snapshot hooks at session start, so `settings.json` hook edits can need a `/hooks` review or a restart to take effect.

Related: [[memory-vault-authority]], [[lightrag-token-secret-rotation]]
