---
name: advisor-nudge-mechanism
description: "PostToolUse hook that nudges Claude to call advisor() when stuck in a repetitive debugging loop — iteration-count primary, wall-clock secondary"
type: project
tags: [memory, project]
source_session: da3c13e7-e43f-48e9-8c8e-a045c7cfd24c
last_verified: 2026-06-14
---

A `PostToolUse` hook (`advisor-nudge.js`) detects stuck debugging loops and injects `additionalContext` telling Claude to call `advisor()`.

**Why:** In the DM NZ Add to Cart session (2026-06-14), multiple diagnostic scripts were written and multiple failed fix attempts made before `advisor()` was consulted. Earlier consultation would have short-circuited the work. This hook enforces the "consult early when stuck" behavior documented in [[feedback-preferences]].

**Trigger:** Same test command run ≥3× (regex `/npm (run )?test|npx playwright test/i`) OR same `file_path` edited ≥3×, AND >90s have elapsed since the first signal. The 90s floor suppresses fast intentional TDD re-runs.

**Debounce:**
1. State resets when `tool_name === 'advisor'` fires in PostToolUse — one advisor call restores the counter.
2. One-shot `notified` flag: one stuck episode produces one nudge, not ten.
3. Auto-expiry: if `advisor` tool call doesn't fire the reset, `notified` clears after 10 minutes.

**Critical implementation fact:** Uses `hookSpecificOutput.additionalContext` — NOT `systemMessage`. `systemMessage` is shown to the USER ONLY; Claude never sees it. `additionalContext` is injected into Claude's context as a system reminder next to the tool result.

**State file:** `.claude/.state/advisor-nudge-{session_id}.json` (gitignored). Never parses the transcript JSONL — only tiny per-signature counts + timestamps.

**Files:**
- Hook: `.claude/hooks/advisor-nudge.js`
- Settings entry: `.claude/settings.json` PostToolUse matcher `Bash|Edit|MultiEdit|Write|advisor`, timeout 10s
- State dir: `.claude/.state/` (gitignored)

**Complement:** CLAUDE.md Section 5 ("When to Call advisor() Immediately") documents 7 immediate-trigger patterns that bypass the hook entirely — situations where calling advisor before any iteration is the right call.
