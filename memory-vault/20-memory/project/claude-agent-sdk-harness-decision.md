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

**Status 2026-10-23:**
- P0 and P1 are built on branch `feat/claude-agent-sdk-harness`, pushed 2026-10-23. V1.1 passed; the V1.6 golden eval has not been run yet. P2+ were not started; their gates are still unmet.
- Review found that `verbatimPrompts: true` is required. Without it, a string prompt gets `@path` file expansion and slash commands, a data route that bypasses `tools: []`.
- **Q9 decided 2026-10-23** (open question 9, golden-set thresholds; the Triage-labelling half is still open for P3):
  - Critical rules: `wrong-test-import`, `inline-locator`, `hierarchical-selector`. These are the CLAUDE.md hard rules, held in `CRITICAL_RULES` in `eval.ts`.
  - They are scored from the golden answers (tp/fp/fn), not from the severity the model emits.
  - The gate (`P1_GATE`, `evaluateGate()`) requires all of:
    - merged critical precision ≥ 0.8;
    - critical recall ≥ 0.7, on both the merged and the model-only rows (all 4 `wrong-test-import` cases are guaranteed pre-check hits, so merged recall alone would pass with the model at 50%);
    - at most 1 critical finding across all clean-diff runs;
    - at least 2 repeats;
    - no failed runs and no leak hits.
  - It gates on the measured value; the Wilson interval is shown but not gated on (with n≈12–20 a perfect score barely clears 0.8). `agent:review:eval` now exits non-zero on FAIL.
  - Added 4 golden diffs (2 inline-locator, 2 hierarchical-selector; 34 cases, so a 2-repeat eval is 68 runs) and a test requiring at least 3 golden cases per critical rule. Per-case `modelUsage` is now saved for V1.9. 185 offline tests pass.
- `npm run lint` now needs `npm run agent:install` first.
- First live attempt (V1.1, `--sha b567e71`) failed at CLI startup with 0 turns and $0. There were two causes:
  - zod 4's `toJSONSchema()` emits draft-2020-12, but the CLI's `--json-schema` validator only resolves draft-07. Fixed by passing `{ target: 'draft-07' }` in `run-agent.ts`, plus an offline test.
  - `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` makes the CLI force `permissionMode` to `default` no matter what `allowedTools` says (confirmed in the CLI binary). That defeats `dontAsk`. The flag is now `'0'` in `env.ts`. This deliberately drops a hardening flag from the reviewed plan: with `tools: []` and an in-process MCP server there is no subprocess for it to protect. Hooks injected through Away Digital managed settings stay covered by V1.4/V1.8. 168 offline tests pass.
  - Second attempt confirmed `unexpected tool in context: StructuredOutput`. It is now the only entry in `EXTRA_ALLOWED_TOOLS`. The same init message also reported 2 plugins, 17 skills and 5 agents, even with `settingSources: []` and a temp `CLAUDE_CONFIG_DIR`. The invariant messages now list their names (plugin names only, never paths) so the next run shows where they come from. Plugins are the concern because they can carry hooks. Agents and skills are only reachable through the `Agent`/`Skill` tools, which are not in `tools`.
  - Third attempt named them. They are all built into the CLI, not from Away Digital:
    - plugins: `cc-plugin-agents-md`, `cc-plugin-plugin-authoring`
    - 17 bundled skills
    - agents: `claude`, `Explore`, `general-purpose`, `Plan`, `statusline-setup`
  - Fixed by switching them off, not allowlisting them. `ISOLATION_SETTINGS` in `run-agent.ts` is passed as the SDK `settings` (flag settings) and sets `disableBundledSkills: true`, `skillOverrides: { doctor: 'off' }` and `enabledPlugins` `<name>@builtin: false`. `env.ts` adds `CLAUDE_CODE_DISABLE_EXPLORE_PLAN_AGENTS=1`. The `skills: []` option does nothing to init.
  - `claude`, `general-purpose` and `statusline-setup` cannot be removed, so the agents invariant was narrowed from "empty" to the exact names in `BUILTIN_AGENT_ALLOWLIST`. This deliberately deviates from the approved plan. It is safe only while the `Agent`/`Task` tool stays out of `EXTRA_ALLOWED_TOOLS`, and a test pins that. Plugin and skill checks stay strict (must be empty).
  - Denied tool names are now logged as `permission denied: <name>` (never `tool_input`).
  - A dummy-token run reproduces init locally. It cannot load account-managed settings and `schedule` was missing, but init passes and the run ends `auth-failed`. Managed policy settings outrank flag settings, so a plugin switched on by Away Digital would still trip the strict plugin check. That would be a D2 question.
- **V1.1 passed on 2026-10-23** (fourth attempt, real token):
  - `success`, 4 turns, 6.5 s, $0.0225 API-equivalent: about 22.5k input tokens, mostly cache reads, and 318 output tokens.
  - `apiKeySource: none`, CLI 2.1.309, model `claude-sonnet-5-5`, 0 permission denials, no managed-settings keys.
  - 0 findings on `b567e71`, which is correct: it was an already-reviewed clean fix. The summary said "6 changed files" when 5 were in scope. The summary text is not fact-checked; only findings are post-validated.
  - The rate-limit event was `allowed_warning`, `seven_day` utilization 0.55. That is the whole seat's weekly usage, so watch it before the 60-run golden eval (V1.6).
