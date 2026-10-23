---
name: claude-agent-sdk-harness-decision
description: "2026-10-23 user approved all phases (P0-P6) of a Claude Agent SDK harness + read-only CI agents plan, authenticated with a Claude Code subscription token; CI phases still gated on external decisions D1-D3"
type: project
tags: [memory, project, ai-agents, ci]
last_verified: 2026-10-23
---

On 2026-10-23 the user approved all phases (P0-P6) of the plan in `docs/technical-research/claude-agent-sdk-harness.research.html` (companion: `ai-agent-harness-options.research.html`, cited there as [P]). Both files were exported uncommitted; the repo is public and both catalogue redaction gaps, so review before pushing. No implementation had started at approval time.

Plan in one line: a small harness layer in a nested package `scripts/agents/` (SDK pinned exactly at `@anthropic-ai/claude-agent-sdk` 0.3.309) runs agents with `tools: []`, one in-process MCP server whose handlers are the only data path, `settingSources: []`, `strictMcpConfig: true`, `permissionMode: 'dontAsk'`, minimal `env`, temp `CLAUDE_CONFIG_DIR`. Phases: P0 harness, P1 Convention Reviewer local (pilot, public code only), P2 Reviewer in CI, P3 Failure Triage, P4 Mirror-Parity, P5 Flaky Analyst, P6 Playwright Upgrade Impact. Healer-to-draft-PR deferred; Lighthouse narrator skipped.

**Why:** chosen over `claude -p --bare` because bare mode does not read `CLAUDE_CODE_OAUTH_TOKEN`, so it cannot run on the user's Away Digital Team seat. Clears the bar that got the Pi Coding Agent rejected ([[pi-coding-agent-evaluation]]): a permission model, code-only data path, bounded egress.

**How to apply:**
- User approval does NOT satisfy D1 (Anthropic terms for subscription OAuth driving a self-written SDK program in CI — get a written answer), D2 (Away Digital policy on using the seat for a personal-account repo), D3 (Accent Group + Away Digital sign-off on redacted staging failure data). P2 waits on D1+D2; P3 and P5 wait on D3. If D1 = "API key only", switch the credential (no code change) or fall back to `anthropics/claude-code-action`.
- Approval covered the recommended defaults: second `setup-token` token for local runs (relocating `CLAUDE_CONFIG_DIR` hides the normal login), `lint:agents` chained into `npm run lint`, Sonnet default / Haiku Mirror-Parity / Opus Upgrade Impact, rule text read at runtime from `.claude/agents/*.md`.
- Gotchas verified: a Team-seat token fetches Away Digital server-managed settings and SDK runs apply them "for that run only" (`settingSources: []` does not stop it; `~/.claude/remote-settings.json` was `{}`). API test steps use `continue-on-error: true`, so Triage must trigger on a failure-bundle artifact, not `conclusion == 'failure'`. The SDK Linux binary is ~293 MB unpacked, hence the nested package. `setup-token` must be run in a separate terminal, never via `!` or an agent's Bash (the token lands in the transcript).
- Each phase is built via WORKFLOW-10 (`/implement`), then review and the `/code-simplifier` gate.
