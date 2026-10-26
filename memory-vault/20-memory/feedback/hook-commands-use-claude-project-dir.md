---
name: hook-commands-use-claude-project-dir
description: "Every script-based hook in .claude/settings.json must launch as node \"$CLAUDE_PROJECT_DIR/...\" — a relative node .claude/hooks/x.js crashes with node:internal/modules/cjs/loader:1503 Cannot find module as soon as the session cwd drifts off the repo root"
type: feedback
tags: [memory, feedback, hooks, claude-code]
last_verified: 2026-10-25
---

**Rule:** any hook command that runs a script file is written `node \"$CLAUDE_PROJECT_DIR/.claude/hooks/<name>.js\"` (or `/scripts/<name>.mjs`), never `node .claude/hooks/<name>.js`. Inline `node -e` hooks and `~/...` user-level hooks are unaffected.

**Why:** Claude Code moves its tracked cwd after every Bash call, so one `cd memory-vault` (or any subfolder) sends every later hook there too. A relative path then fails on every event at once (PreToolUse:Bash, PostToolUse:Bash, PostToolBatch...) with a truncated `node:internal/modules/cjs/loader:1503`, which is Node's `Cannot find module`. `$CLAUDE_PROJECT_DIR` is fixed at session start and doesn't follow `cd`. Both the Windows backslash form and the forward-slash form work inside bash double quotes.

**History:** the fix was done twice. 2026-09-27 converted only the two LightRAG hooks (see [[lightrag-sync-lifecycle]]). 2026-10-25 converted the remaining eight (session-start-git-check, pre-tool-use, user-prompt-submit, advisor-nudge, sync-memory-to-vault, vault-capture-nudge, post-tool-use-failure, post-tool-batch) after they broke in a session that had cd'd away from the root.

**How to apply:**
- When adding or reviewing a hook, check that the launch path is absolute through `$CLAUDE_PROJECT_DIR`.
- Inside the scripts, resolve files with `__dirname`, not `process.cwd()`. `npx tsc` is the exception: tsc searches parent folders for `tsconfig.json`, so it still works from any subfolder.
- Verify by running the command with `cwd: C:\` and `node --check` in place of `node`. That resolves each path with no side effects.
- Settings hook changes made mid-session need a restart (or a `/hooks` review) before they take effect.
