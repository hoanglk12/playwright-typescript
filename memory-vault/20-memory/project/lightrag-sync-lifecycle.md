---
name: lightrag-sync-lifecycle
description: "What pushes vault notes into LightRAG and when (PostToolUse on vault write + Stop hook after every turn, both via lightrag-sync-status.js with a visible systemMessage), what never reaches it (.remember/, auto-memory seed, anything not written as a vault note), and the remaining gaps"
type: project
tags: [memory, project, lightrag]
last_verified: 2026-10-26
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

## How the sync decides what changed (2026-10-26)

- **Doc ids are `doc-` + md5(file name)**, not a hash of the content. The id stays the same across edits, so comparing ids can't detect a change.
- **The API exposes only `content_length`.** For change detection the sync reads `content_hash` from `.lightrag/kv_store_doc_status.json` and compares it with `md5(note.trim())`. The helper lives in `scripts/lightrag-doc-status.mjs`, which the offline eval shares, so the two can't disagree. It falls back to the old ±2-character length check when that record is older than the live doc (`updated_at` differs) or when the note has HTML entities or control characters, whose stored hash can't be predicted. Before this, same-length edits (a date, a status word) were never re-synced. On 2026-10-26, 5 notes were stale that way.
- **Deletes must wait for an idle pipeline.** While it's busy, `delete_document` returns HTTP 200 with `{"status":"busy"}`, and the old code checked only `res.ok`. The sync now waits up to 20s for idle, requires `deletion_started`, and otherwise leaves the updates for the next sync. A delete runs in the background and rebuilds affected entities with the LLM: 6 docs took over 60s.
- **A 409 on insert is deferred, not an error,** unless it names an existing doc whose status is `failed`. The two other kinds of 409 are "already contains 'x.md' (Status: pending)", from an overlapping PostToolUse and Stop sync, and "Pipeline is clearing or deleting documents". Both clear up on their own, and the next sync inserts whatever is still missing.
- **An edited note can briefly vanish from the index.** The PostToolUse sync has 25s, and a delete can outlast that. The hook then kills the script after the delete but before the re-insert, so the note is missing until the Stop sync at the end of the turn inserts it as new. Seen twice on 2026-10-26. The pre-2026-10-26 code had the same gap.
- **Verify a sync change by convergence.** First, `npm run eval:lightrag:offline` must show 0 stale and 0 failed. Then a second sync must report `0 new, 0 updated, N unchanged`. A mismatched hash would show up as every note re-indexing after every turn.

## What never reaches LightRAG

LightRAG's `input_directory` is `memory-vault/20-memory/` only. These are never indexed:
- the `.remember/` buffer (`now.md`, `today-*.md`, `recent.md`)
- the deprecated `~/.claude/projects/.../memory/` seed
- anything learned in conversation that was never written as a vault note

## Remaining gaps

- **The server-down warning depends on a per-machine record.** It compares note file times against `.claude/.state/lightrag-last-sync.json` (gitignored). That file stores the start time of the last error-free sync. Without it, for example on a fresh clone, a down server stays silent until one sync succeeds. Touching files without changing them, such as a `git checkout`, can also trigger a false count while the server is down.
- **"Queued" only means inserted.** Indexing runs in the background. A doc that later fails shows up as `failed:` on the next sync, because the script skips docs that are still indexing but not docs that failed. To confirm by hand, wait for `GET /documents/pipeline_status` to show `busy:false`, then check that `POST /documents/paginated` lists the note as `processed`.
- **Stuck docs are silent.** If the server dies mid-indexing, a doc can stay `pending` or `processing`. The script skips in-flight docs on every run, and the last-sync record keeps advancing, so neither message ever mentions it. It's unconfirmed whether LightRAG 1.5.7 resumes such docs on restart. If recall misses a note you know was written, check its status with `POST /documents/paginated`.
- **Failed docs are retried automatically (since 2026-10-26).** The sync deletes and re-inserts a failed doc once its failure is an hour old, or straight away if the note changed. Before that, a failed doc was never retried, and its re-insert hit a 409 on every sync. `fixture-registry.md` failed on 2026-10-02 with a ShopAIKey 401 and stayed failed for 24 days. In that time the Stop hook printed `failed: fixture-registry.md (409 …)` after every turn. Because a sync with any error doesn't save `lastSuccessMs`, every "N notes not indexed" warning also counted from 2 October. Never call bare `DELETE /documents`, which wipes the store. The per-doc endpoint is `DELETE /documents/delete_document` with body `{"doc_ids":["<id>"]}`.
- **The sync never deletes.** A removed or renamed note stays in LightRAG as an orphan. `mcp-away-profile-config.md` was one as of 2026-09-27.
- Claude Code may snapshot hooks at session start, so `settings.json` hook edits can need a `/hooks` review or a restart to take effect.

Related: [[memory-vault-authority]], [[lightrag-token-secret-rotation]]
