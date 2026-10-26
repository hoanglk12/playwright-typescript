---
name: inline-node-hooks-no-backticks
description: "Inline node -e hooks in .claude/settings.json run through bash inside double quotes, so JS template literals (backticks, ${...}) are rewritten by bash before Node sees them; the SubagentStop hook crashed with a SyntaxError on every subagent stop. Build strings with + instead"
type: feedback
tags: [memory, feedback, hooks, claude-code]
last_verified: 2026-10-26
---

**Rule:** in an inline `node -e "..."` hook command in `.claude/settings.json`, never use a template literal (backticks or `${...}`). Build strings with `+` (plain concatenation). If the script needs more than that, move it into a file under `.claude/hooks/` and launch it as `node "$CLAUDE_PROJECT_DIR/.claude/hooks/<name>.js"` ([[hook-commands-use-claude-project-dir]]).

**Why:** Claude Code runs hook commands through bash, Windows included, and an inline script sits inside bash double quotes. Inside double quotes bash still treats backticks as command substitution and expands `${...}`. The SubagentStop hook built its message as a template literal. Bash printed "bad substitution" and "finished.: command not found", then handed Node `systemMessage:}`, which is a SyntaxError. The template literal was there from the commit that added the hook (`5bd418a`, 2026-05-10), so it failed on every subagent stop until 2026-10-26. It also read `agent_name` and `usage`, which SubagentStop input doesn't have. The real fields are `agent_type`, `agent_id` and `last_assistant_message`.

**How to apply:**
- Test an inline hook the way Claude Code runs it. Read the command out of settings.json and pipe sample JSON into `bash -c "$cmd"`. Running the JS straight through node skips the bash step that breaks it.
- Treat any `$` in an inline script as suspect. `$CLAUDE_PROJECT_DIR` is meant to expand; anything else expands by accident.
- Single quotes and `||` inside the double quotes are safe.

Related: [[hooks-never-spawn-npx]], [[advisor-nudge-mechanism]]
