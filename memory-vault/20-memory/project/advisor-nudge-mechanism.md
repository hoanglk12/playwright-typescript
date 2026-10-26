---
name: advisor-nudge-mechanism
description: "PostToolUse hook that nudges Claude to call advisor() when stuck in a repetitive debugging loop — iteration-count primary, wall-clock secondary"
type: project
tags: [memory, project]
source_session: da3c13e7-e43f-48e9-8c8e-a045c7cfd24c
last_verified: 2026-10-25
---

A `PostToolUse` hook (`advisor-nudge.js`) detects stuck debugging loops and injects `additionalContext` telling Claude to call `advisor()`.

**Why:** In the DM NZ Add to Cart session (2026-06-14), multiple diagnostic scripts were written and multiple failed fix attempts made before `advisor()` was consulted. Earlier consultation would have short-circuited the work. This hook enforces the "consult early when stuck" behavior documented in [[feedback-preferences]].

**Trigger:** Same test command run ≥3× (regex `/npm (run )?test|npx playwright test/i`) OR same file basename edited ≥3×, AND ≥90s have elapsed since that **same signature's** first occurrence. The 90s floor suppresses fast intentional TDD re-runs.

**Debounce (reworked 2026-10-25):**
1. Per-signature `{ count, firstTs, countedTs, lastTs }`. A repeat within 30s (`BATCH_WINDOW_MS`) of the last **counted** occurrence is the same batched change and doesn't count. Measuring from the last *call* instead would let a fast loop with calls under 30s apart never count past 1. Measured batches in this repo: edits 0.5–1.1s apart, but a slow PostToolUse hook (LightRAG sync on vault writes) stretched one to 10.6s, so a 10s window would be too tight. A signature idle for more than 10 min (`STALE_GAP_MS`) starts again from zero.
2. One-shot `notified` flag: one stuck episode produces one nudge, not ten.
3. `notified` clears after 10 minutes (`EXPIRY_MS`).
4. **Every real user message resets the state (added 2026-10-26).** `resetAdvisorNudge()` in `user-prompt-submit.js` deletes `advisor-nudge-{session_id}.json`, but not for `<task-notification>` turns or "This session is being continued…" summaries, which are automated. Why: on 2026-10-26 it fired "edited user-prompt-submit.js 3× over 14 minutes", and those were three separate, successful user requests. A stuck loop is Claude retrying on its own within one turn; a user reply is itself the check. In a sandbox test, 3 edits across 3 user turns stay silent, while 3 edits within one turn over 4 minutes still nudge.

**advisor() does NOT reset it.** advisor runs server-side (`server_tool_use`, ids `srvtoolu_…`; 17/33 transcripts checked 2026-10-25, 0 as a client `tool_use`), so it never reaches PostToolUse. The `tool_name === 'advisor'` branch and the `advisor` in the matcher are kept only in case advisor ever becomes a client tool.

**False positive that drove the rework (2026-10-25):** before the rework, a single session-wide `firstSignalTs` was set by the first edit of the session and never cleared, because the advisor reset couldn't fire. So 4 planned edits to one file sent in one batch, 6 minutes after an unrelated 8-edit batch on `settings.json`, hit "edited 3× over 6 minutes", right after an advisor call. A fake-clock simulation (old vs new, run from the scratchpad) confirmed the old hook fires there and the new one doesn't, while genuine edit/test loops still fire at the same moment.

**Critical implementation fact:** Uses `hookSpecificOutput.additionalContext` — NOT `systemMessage`. `systemMessage` is shown to the USER ONLY; Claude never sees it. `additionalContext` is injected into Claude's context as a system reminder next to the tool result.

**State file:** `.claude/.state/advisor-nudge-{session_id}.json` (gitignored). Never parses the transcript JSONL — only tiny per-signature counts + timestamps.

**Files:**
- Hook: `.claude/hooks/advisor-nudge.js`
- Settings entry: `.claude/settings.json` PostToolUse matcher `Bash|Edit|MultiEdit|Write|advisor`, timeout 10s
- State dir: `.claude/.state/` (gitignored)

**Complement:** CLAUDE.md Section 5 ("When to Call advisor() Immediately") documents 7 immediate-trigger patterns that bypass the hook entirely — situations where calling advisor before any iteration is the right call.
