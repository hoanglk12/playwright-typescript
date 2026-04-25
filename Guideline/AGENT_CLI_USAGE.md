# Agent CLI Usage Guide

This guide covers how to invoke the QA automation agents from the Claude Code CLI (`claude`) in this Playwright TypeScript framework.

---

## List All Configured Agents

```bash
claude agents
```

Expected output:
```
Project agents:
  automation-test-architect · sonnet
  devops-cicd-specialist    · sonnet
  playwright-test-generator · sonnet
  playwright-test-healer    · sonnet
  playwright-test-planner   · sonnet
  qa-code-reviewer          · sonnet
  qa-orchestrator           · sonnet
```

---

## Agent Overview

| Agent | Color | Role |
|---|---|---|
| `qa-orchestrator` | yellow | Main entry point — selects and dispatches sub-agents |
| `automation-test-architect` | purple | Converts requirements into production POM code |
| `playwright-test-planner` | green | Navigates live app, produces markdown test plan |
| `playwright-test-generator` | blue | Records real browser interactions, emits raw spec |
| `playwright-test-healer` | red | Debugs and fixes failing tests |
| `qa-code-reviewer` | orange | Audits code against 10-point framework checklist |
| `devops-cicd-specialist` | cyan | Parses CI reports, classifies failures, delivers briefings |

---

## The `--agent` Flag

Makes Claude become that agent for the entire session.

### qa-orchestrator — multi-step workflows

```bash
# Write tests from a requirement (architect → reviewer)
claude --agent qa-orchestrator -p "Write tests for the admin login feature"

# Full coverage from scratch (planner → architect → reviewer)
claude --agent qa-orchestrator -p "Generate full coverage for https://automationintesting.online — no tests yet"

# CI failure investigation (devops → healer → reviewer)
claude --agent qa-orchestrator -p "CI is red — investigate test-summary.txt and fix all failures"

# Full delivery — write, run, fix, verify
claude --agent qa-orchestrator -p "Write and run tests for the homepage. Fix any failures and confirm green."
```

### automation-test-architect — write POM code

```bash
claude --agent automation-test-architect -p "Create page object and spec for the homepage search bar"
claude --agent automation-test-architect -p "Convert this manual test case to automation: navigate to /rooms, verify 3 rooms are listed"
claude --agent automation-test-architect -p "Write a test for the admin booking management page — happy path and invalid data"
```

### playwright-test-planner — explore app, produce test plan

```bash
claude --agent playwright-test-planner -p "Navigate https://automationintesting.online and create a test plan for the booking form"
claude --agent playwright-test-planner -p "Plan tests for the admin dashboard — I have no existing tests"
```

### playwright-test-generator — record live browser flow

```bash
claude --agent playwright-test-generator -p "Record the login flow at https://automationintesting.online/admin and generate a spec"
claude --agent playwright-test-generator -p "Watch the checkout flow and capture a raw test file"
```

### playwright-test-healer — fix failing tests

```bash
claude --agent playwright-test-healer -p "Fix the failing test in tests/frontsite/home-page.spec.ts"
claude --agent playwright-test-healer -p "TC_02 in tests/admin/login.spec.ts is failing with a selector error — fix it"
```

### qa-code-reviewer — audit code quality

```bash
claude --agent qa-code-reviewer -p "Review tests/admin/login.spec.ts and src/pages/admin/login-page.ts"
claude --agent qa-code-reviewer -p "Check if tests/frontsite/ follows framework conventions before merge"
```

### devops-cicd-specialist — analyze CI failures

```bash
claude --agent devops-cicd-specialist -p "Analyze playwright-report/ and test-summary.txt — classify all failures"
claude --agent devops-cicd-specialist -p "Why did the last GitHub Actions run fail?"
claude --agent devops-cicd-specialist -p "Summarize the latest test report"
```

---

## Non-Interactive Mode (`-p`)

One-shot output — prints result and exits. Useful for scripts and CI.

```bash
# Basic non-interactive
claude --agent qa-code-reviewer -p "Review tests/admin/login.spec.ts" 

# Pipe output to a file
claude --agent qa-code-reviewer -p "Review tests/frontsite/" > review-report.txt

# JSON output for scripting
claude --agent devops-cicd-specialist \
  -p "Summarize test-summary.txt" \
  --output-format json

# Streaming JSON (token-by-token, for real-time consumption)
claude --agent qa-orchestrator \
  -p "Write tests for the homepage" \
  --output-format stream-json
```

---

## Permission Modes

Controls what the agent can do without prompting you.

```bash
# acceptEdits — auto-approve file edits, prompt for everything else (recommended for writing tests)
claude --agent automation-test-architect \
  --permission-mode acceptEdits \
  -p "Create page object for the services page"

# auto — approve all safe operations automatically
claude --agent playwright-test-healer \
  --permission-mode auto \
  -p "Fix tests/admin/login.spec.ts"

# bypassPermissions — fully autonomous, no prompts (use only in sandboxes or CI)
claude --agent qa-orchestrator \
  --permission-mode bypassPermissions \
  -p "Full delivery: write, run, fix and verify tests for checkout flow"
```

---

## Continue or Resume a Session

```bash
# Continue the most recent session in this directory
claude --continue

# Continue with a specific agent taking over
claude --continue --agent playwright-test-healer

# Open interactive session picker
claude --resume

# Resume a specific session by ID and fork it (new branch from that point)
claude --resume <session-id> --fork-session
```

---

## Worktree Mode — Isolated Branch per Agent

Agent works on a separate git worktree so main branch is never touched.

```bash
# Auto-named worktree
claude --agent automation-test-architect \
  --worktree \
  -p "Write tests for the new payment feature"

# Named worktree
claude --agent qa-orchestrator \
  --worktree feature/login-tests \
  -p "Generate full coverage for the login area from scratch"
```

---

## Interactive Mode

Start a session and describe what you want — Claude selects the right agent(s).

```bash
claude
```

Then type naturally:
```
> Write and run tests for the admin booking management page
> CI is red — investigate and fix all failures
> Fix TC_03 in tests/frontsite/search.spec.ts
> Review the files I just wrote before I merge
```

---

## Workflow Decision Guide

| What you want | Command |
|---|---|
| Write tests from a requirement | `claude --agent qa-orchestrator -p "Write tests for X"` |
| Full coverage, no existing tests | `claude --agent qa-orchestrator -p "Generate full coverage for X from scratch"` |
| Record a browser flow | `claude --agent qa-orchestrator -p "Record this flow and automate it"` |
| Fix CI failures (batch) | `claude --agent qa-orchestrator -p "CI is red — fix all failures"` |
| Fix one specific test | `claude --agent playwright-test-healer -p "Fix tests/area/spec.ts"` |
| Audit code before merge | `claude --agent qa-code-reviewer -p "Review path/to/files"` |
| Explore app, no code yet | `claude --agent playwright-test-planner -p "Plan tests for URL"` |
| Analyze a build report | `claude --agent devops-cicd-specialist -p "Analyze playwright-report/"` |
| Write POM code directly | `claude --agent automation-test-architect -p "Create page object for X"` |
| List all agents | `claude agents` |

---

## Workflow Pipelines (Orchestrator)

The orchestrator runs these pipelines automatically based on your prompt:

| Workflow | Trigger phrase | Pipeline |
|---|---|---|
| **WORKFLOW-1** New Feature Test | "Write tests for X" | architect → reviewer |
| **WORKFLOW-2** Plan-Then-Build | "Full coverage / no tests yet" | planner → architect → reviewer |
| **WORKFLOW-3** Record-Then-Refine | "Record this flow" | generator → architect → reviewer |
| **WORKFLOW-4** CI Fix | "CI is red / build failed" | devops → healer → reviewer |
| **WORKFLOW-5** Code Audit | "Review / audit my code" | reviewer only |
| **WORKFLOW-6** Targeted Heal | "Fix TC_05" (named test) | healer → reviewer |
| **WORKFLOW-7** Full Delivery | "Write and run / full delivery" | architect → healer → reviewer → devops |

---

## Common Options Reference

| Flag | Description |
|---|---|
| `--agent <name>` | Run session as a specific agent |
| `-p` / `--print` | Non-interactive: print response and exit |
| `--permission-mode <mode>` | `default`, `acceptEdits`, `auto`, `bypassPermissions` |
| `--output-format <fmt>` | `text` (default), `json`, `stream-json` |
| `-c` / `--continue` | Continue the most recent session |
| `-r` / `--resume` | Resume by session ID or open picker |
| `--worktree [name]` | Create isolated git worktree for this session |
| `--fork-session` | Fork session on resume (new ID, preserves history) |
| `--model <model>` | Override model (`sonnet`, `opus`, `haiku`) |
| `--verbose` | Show detailed output |
| `-n` / `--name` | Set a display name for the session |
