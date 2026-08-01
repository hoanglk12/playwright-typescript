# Technical Research Report: Multi-Model "AI Council" Dispatch for Second Opinions

**Status:** Research only. No code written, no files modified other than this report.
**Date:** 2026-08-02 (web sources retrieved 2026-08-01)
**Brief:** `docs/technical-research/ai-council-research-brief.md`
**Agent:** technical-research-agent

**Addendum, 2026-08-02: Phase 0 decisions resolved.** The user has decided the three blocking questions this report originally left open (§10 Phase 0, §12 items 1/2/4): endpoint is `https://direct.shopaikey.com/v1`, not OpenRouter; China-hosted models are acceptable; v1 scope is `/council-review` only. The user initially named a three-model default panel: **Kimi-K3**, **GPT Sol 5.6**, **GLM 5.2**, all unverified against a live catalog call. This means the OpenRouter-specific numbers throughout §1 and §8 (models, pricing, context windows) describe an option that was researched and costed but is **not what gets built** — read them as the analysis behind the recommendation, not as the shipped configuration. §10 carries the resolved, authoritative build plan.

**Addendum, 2026-08-02 (second): `glm-5.2` dropped from the panel after a live smoke test.** A real `/council-review` run against all three slugs surfaced three model-specific defects, each confirmed by hand via curl against the live endpoint: `kimi-k3` rejects any `temperature` field with HTTP 400 regardless of value (fixed — `client.mjs` now omits the field for this slug via a `MODELS_WITHOUT_TEMPERATURE` set in `tiers.mjs`); `gpt-5.6-sol` streams SSE chunks even for non-streaming requests (fixed — `client.mjs` now detects and reassembles SSE bodies); `glm-5.2` is a reasoning-heavy model that spent its entire `max_tokens` budget on internal `reasoning_content` and never reached the actual answer, confirmed still failing (`finish_reason: "length"`, empty `content`) even at `max_tokens: 4000`, more than 3x the tool's default. The user decided to drop `glm-5.2` from `DEFAULT_PANEL` rather than chase a further token-budget increase with no verified working value. **The shipped v1 panel is Kimi-K3 + GPT Sol 5.6 only, two models, not three** — every "3 external models" / "three models" reference below and in `.claude/commands/council-review.md` / `CLAUDE.md` reflects the original three-model plan and is superseded by this addendum for the actual running tool.

---

## 1. Summary

The brief asks for a design that lets Claude Code consult 2-3 other LLMs through an OpenAI-compatible endpoint as a *second opinion* on three grounded tasks (diff review, failing-test debugging, and open technical research), using task-specific context assembly rather than a single "pack the whole repo" approach.

**Recommendation in one paragraph.** Build a single, dumb, generic dispatcher as a plain ESM Node script at `scripts/council/dispatch.mjs` (not `.ts`, see §4.2 for the verified tsconfig reason), and expose it through **three thin slash commands** (`/council-review`, `/council-fix`, `/council-research`) rather than a skill, a git hook, or a bare CLI. Context assembly stays exactly where the brief puts it: in Claude Code, at invocation time, because Claude Code is already the only component in the system that can resolve this repo's mixed alias/relative import style. Confirmed by research: **repomix cannot follow imports and cannot resolve tsconfig path aliases**; it is a glob/`--stdin` packer only, so it degrades to a *formatter* fed an explicit file list that Claude Code produced. Default to a cheap, vendor-diverse trio (`openai/gpt-5-nano`, `google/gemini-2.5-flash-lite`, `deepseek/deepseek-v4-flash`) at ~$0.006 per grounded review, and reserve a premium trio (`openai/gpt-5.1`, `google/gemini-3.1-pro-preview`, `x-ai/grok-4.5`) at ~$0.12 per run for pre-merge or hard-bug cases. Anthropic models are deliberately excluded from the panel. Claude Code *is* the first opinion, so an Anthropic panelist would just buy correlated signal at premium prices.

**Three things the brief gets wrong or leaves open, resolved here:**

1. The prior implementation the brief describes as "OpenRouter-based" **did not point at OpenRouter**. Git history shows it hardcoded `https://direct.shopaikey.com/v1` with its own model slugs marked as unvalidated placeholders. Pricing/tiering below is authoritative **only** for `https://openrouter.ai/api/v1`. This must be decided explicitly, not assumed. See §3.3.1 and §8.6.
2. `repomix` with a scoped `--include` **will not work** for this codebase's import style unaided. 85 of 482 import statements use `@config/*`-style aliases that no glob can follow. §4.3.
3. The three skill names the brief cites as precedent (`refine-ticket`, `ai-test-data`, `pert-est`) **do not exist** in this repo. The real precedent is 22 skills + 16 slash commands, and the closest structural match is the `/sync-vault` → `scripts/sync-vault-to-lightrag.mjs` pair. §3.1.

---

## 2. Scope

**In scope:** design of a dev-time, local-only, human-in-the-loop tool for consulting external LLMs. Integration point selection, dispatcher location, context-assembly strategy per task type, prompt templates, model tiering with current pricing, risk analysis, implementation checklist, validation plan.

**Out of scope (explicitly):**
- CI. The brief and the reverted prior art both treat this as a local authoring tool. None of the 8 workflows in `.github/workflows/` should reference it.
- The Playwright test suite. This tool must not be reachable from `playwright.config.ts`, `api.config.ts`, `src/config/base-test.ts`, `src/config/environment.ts`, or any fixture. Zero impact on the 11 `BasePage` helpers, the 14 UI fixtures, or the API fixtures.
- Implementation. Per `.claude/commands/research.md` and CLAUDE.md's WORKFLOW-10, this report stops at the plan; user approval is a hard gate before `technical-implementation-agent` runs.

**Files a future implementation would touch** (all additive):

| Path | Change |
|---|---|
| `scripts/council/dispatch.mjs` | new: generic dispatcher |
| `scripts/council/client.mjs` | new: HTTP layer, salvaged from reverted commit |
| `scripts/council/scrub.mjs` | new: salvaged verbatim from reverted commit |
| `scripts/council/tiers.mjs` | new: model lists + families |
| `scripts/council/output.mjs` | new: Markdown transcript + run JSON |
| `.claude/commands/council-review.md` | new |
| `.claude/commands/council-fix.md` | new |
| `.claude/commands/council-research.md` | new |
| `package.json` | `scripts` block only: 3 aliases, **no new dependency** |
| `.env.example` | commented-out key documentation |
| `.gitignore` | `council-output/` (plus scratch paths if they are not routed outside the repo) |
| `CLAUDE.md` | one new section |

Nothing under `src/`, `tests/`, `.github/`, or the two Playwright configs changes.

---

## 3. What Already Exists

### 3.1 Repo survey: the real skill/command precedent

**Verified against the working tree.**

`.claude/skills/` holds 22 skills, all pure-instruction Markdown (`SKILL.md` with YAML frontmatter carrying `name` + a trigger-heavy `description`): `accessibility`, `api-mocking`, `cicd-pipeline`, `code-humanizer`, `discover-e2e-flows`, `documentation-writer`, `error-debugger`, `frontend-design`, `graphql-testing`, `llm-council`, `nodejs-backend-patterns`, `nodejs-best-practices`, `playwright-best-practices`, `playwright-cli`, `playwright-expert`, `pull-latest`, `qa-code-reviewer`, `seo`, `test-case-generator`, `ts-strict-mode`, `typescript-advanced-types`, `vault-update`.

`.claude/commands/` holds 16 commands: YAML frontmatter with a single `description`, body is instructions to Claude with `$ARGUMENTS` substitution: `check-ci`, `code-simplifier`, `fix-debt`, `fix-test`, `implement`, `new-api-test`, `new-page-object`, `new-ui-test`, `research`, `review`, `run-api`, `run-ui`, `security-audit`, `sync-vault`, `write-tests`.

**The three names in the brief (`refine-ticket`, `ai-test-data`, `pert-est`) are not present in either directory.** Treat them as stale or from another repo. Do not model anything on them.

**The actual precedent for "agent-invoked capability backed by a Node script"** is the `/sync-vault` pair:

- `scripts/sync-vault-to-lightrag.mjs`, plain ESM, `.mjs`, raw `fetch`, no dependencies, `AbortSignal.timeout()` for health checks, fails soft when the server is down.
- `package.json` alias, `"sync:vault": "node scripts/sync-vault-to-lightrag.mjs"`.
- `.claude/commands/sync-vault.md`, a 12-line command whose entire job is: state the safety constraint (never run the reverse-direction script), give the exact command line, and tell Claude what to report afterwards.

Four other scripts follow the same shape: `bulk-ingest-jira.mjs` (with `--dry-run`/`--limit`/`--force` flags and `ingest:jira*` npm aliases), `init-memory-from-vault.mjs`, `sync-memory-to-vault.mjs`, `generate-lhci-index.js`. **Every existing script is `.mjs` or `.js`. There is no `.ts` script under `scripts/`.**

Contrast with a pure-instruction skill: `.claude/skills/llm-council/SKILL.md` has no backing script at all. It orchestrates Claude sub-agents through prose, and its frontmatter carries `MANDATORY TRIGGERS: 'council this', 'run the council', 'war room this'`, i.e. it auto-fires on natural language. That auto-firing property is exactly what makes a *skill* the wrong wrapper for a tool that spends money (§4.1).

### 3.2 Memory vault + MCP (correcting the brief's "GRA-vault")

The brief's "GRA-vault (Obsidian)" is `memory-vault/20-memory/`. Confirmed against CLAUDE.md's `## Memory` section and the working tree:

- Subfolders: `user/` (1 note), `feedback/` (12 notes), `project/` (27 notes + a `jira/` subfolder), `reference/` (currently empty), plus `__parsed__/` which the sync script explicitly skips.
- Format: Markdown with YAML frontmatter (`name`, `description`, `type`, `tags`, `source_session`, `last_verified`), body is dense prose with `[[wikilinks]]`, bolded labels, and concrete file paths. Example read: `memory-vault/20-memory/project/advisor-nudge-mechanism.md`, ~30 lines stating the mechanism, the *why*, the trigger conditions, a "Critical implementation fact" callout, and the exact files involved.
- These notes are **high signal-to-noise, already distilled, and cheap in tokens**, which is precisely why the brief prefers them over raw source for research-mode context, and that preference holds up.
- `.mcp.json` configures exactly one MCP server: `lightrag` via `uvx --from lightrag-mcp lightrag-mcp --host localhost --port 9621`. Nothing else. There is no OpenRouter MCP, no Nanobot MCP, no repomix MCP configured.
- CLAUDE.md's routing rule: Grep for exact lookups, `Read` for a specific note, `mcp__lightrag__query_document` (mode `hybrid`) only for multi-note synthesis, health-check first. **LightRAG does not index source code**, only vault notes.

### 3.3 Prior art: the reverted `scripts/council/` (commit `c8361ce`, reverted by `257dee5`)

Built 2026-07-31, reverted 2026-08-01. 2,050 insertions across 11 files. `git show c8361ce --stat`:

```
.claude/commands/council-providers.md |  31 +
.claude/skills/llm-council/SKILL.md   |   4 +
.env.example                          |   6 +
.gitignore                            |   3 +
CLAUDE.md                             |  28 +
package.json                          |   5 +-
scripts/council/index.mjs             | 573 +
scripts/council/openrouter.mjs        | 422 +
scripts/council/panels.mjs            | 249 +
scripts/council/report.mjs            | 483 +
scripts/council/scrub.mjs             | 247 +
```

The working tree today is clean of all of it, grep for `OPENROUTER` / `council` in `.env.example`, `.gitignore`, and `CLAUDE.md` returns nothing.

#### 3.3.1 The endpoint finding: the most important thing in the diff

The brief, this task's framing, and the reverted commit message all say "OpenRouter." **The code does not.**

`scripts/council/openrouter.mjs`:

```js
/** OpenAI-compatible base URL. Changed from OpenRouter to ShopAIKey per user request. */
export const API_BASE_URL = 'https://direct.shopaikey.com/v1';
```

and the `scripts/council/panels.mjs` header:

```
* NOTE: slugs below are OpenRouter-format placeholders. The HTTP layer
* (openrouter.mjs) now points at https://direct.shopaikey.com/v1 — update
* these to ShopAIKey's actual model IDs before running for real.
```

Three consequences a future implementation must not gloss over:

1. **ShopAIKey is not unverifiable hearsay.** It is a concrete base URL in this repo's git history. What remains unverifiable *from this repo* is the Nanobot agent's configuration, its OpenRouter fallback behaviour, and which model IDs ShopAIKey actually serves, nothing in the working tree or history documents any of that. Those are user-supplied external context.
2. **The reverted tool was never validated against a live catalog.** Its own code admits this: `fetchModelCatalog()` warns "this provider likely has no /models endpoint" and falls back to a `buildUnknownPricingCatalog()` that deliberately sets `pricing: null` so the estimator prints "UNKNOWN" rather than a fabricated dollar figure. `fetchKeyStatus()` carries the same caveat for `GET /key`.
3. **Model IDs and pricing are endpoint-specific.** Every number in §8 came from `https://openrouter.ai/api/v1/models`. Point the client at a proxy and both the slugs and the cost estimator silently become fiction. §9 treats this as a top risk.

#### 3.3.2 Salvage: reuse these largely as-is

| Asset | Why it survives the pivot |
|---|---|
| **`scrub.mjs` (247 lines)** | 24 ordered denylist rules: PEM keys, JWT, URL-embedded creds, `Authorization:`/`X-Api-Key:`/`Cookie:` headers, env-style `*_KEY=`/`*_TOKEN=` assignments, `sk-or-v1-*`, generic `sk-*`, AWS `AKIA*`, Google `AIza*`, npm `npm_*`, GitHub `gh[oshu]_*`/`github_pat_*`, Stripe, SendGrid, Slack webhooks/tokens, Percy `auth_*`, secret-bearing query params, email addresses, `C:\Users\<name>` paths, internal hostnames. Rule ordering is deliberate and commented (PEM/JWT/URL-cred/auth-header rules run **before** the looser email rule so `user:pass@host` isn't half-eaten). The env-assignment rule is intentionally case-sensitive so it doesn't mangle ordinary camelCase source. `scrub()` returns `{text, hits}` where hits are rule-name + count only, **never the matched value**, so hit metadata is safe to log. Task-agnostic. Keep verbatim. |
| **`assertNoApiKeyInPayload(payloadString, apiKey)`** | Hard stop: throws if the literal API key appears anywhere in the outbound body. Cheap, correct, keep. |
| **`buildManifest()`** | Produces both a human-readable consent manifest (per-source byte counts, per-source scrub-hit counts, truncated framed-prompt preview, model list with provider families, provider policy, cost estimate) and a structured JSON twin. The *shape* is exactly right; only the panel/chairman fields need replacing with a flat model list. |
| **`chat()` in `openrouter.mjs`** | Raw `fetch`, no SDK. Handles the documented quirk where **errors arrive as HTTP 200 with a populated `error` field**; treats empty completion content as a distinct error class (cost was still incurred); parses `Retry-After` as both seconds and HTTP-date. |
| **`withRetry()` + error taxonomy** | `OpenRouterError` (retryable set: `NETWORK`, `EMPTY_CONTENT`, 408, 429, 500, 502, 503) vs `FatalAuthError` (401/402: abort the whole run, never retry per-model, never swallow). Exponential backoff with jitter, honours `Retry-After`. Matches OpenRouter's documented guidance. |
| **Mock mode (`COUNCIL_MOCK=1`)** | Every network function returns deterministic canned data, zero calls. `COUNCIL_MOCK_FAIL=slug,slug` simulates per-model failure using a *non-retryable* status so validation runs don't burn real backoff sleeps. This is how the whole pipeline gets tested without spending money: reuse wholesale. |
| **Dry-run mode + `--max-cost`** | Manifest and estimate with no chat calls. Keep. |
| **The two-step consent flow in `council-providers.md`** | See §3.3.4: the single most reusable artifact. |
| **Credential convention** | `OPENROUTER_API_KEY` from shell env, falling back to a gitignored `.env.local`; **never** `.env.testing` / `.env.staging` / `.env.production`, and never read by `src/config/environment.ts`. `maskKey()` prints `...last4` only. Keep verbatim. |
| **`--question-file=<path>` and "no automatic context scanning"** | Question text never interpolated into a shell string; context only enters via explicit repeatable `--context=<path>`. Both properties are load-bearing. Keep. |
| **Slug guard: reject slugs starting with `~`** | Floating "latest" aliases break pinned cost estimates and pinned behaviour. Small, correct, keep. |
| **Arg-parsing helpers** | `parseArgs` / `asBool` / `parseNumericFlag` correctly distinguish bare `--flag` from `--flag=value` and reject `--yes=false` rather than coercing it to `true`. Keep. |
| **`.gitignore council-output/`** | Output may contain scrubbed workspace context. Keep. |

#### 3.3.3 Discard: wrong shape for grounded second opinions

| Asset | Why it goes |
|---|---|
| **The 5-persona panel** (Contrarian / First-Principles / Expansionist / Outsider / Executor) | Copied verbatim from the free `llm-council` skill. These are *deliberation* lenses for open decisions. "Review this diff for a `private readonly` locator violation" has a correct answer; asking an Expansionist to find upside in it produces noise. The brief's grounded tasks want **independent expert opinions on the same concrete artifact**, not orthogonal thinking styles. This is the concrete form of the brief's "Why not a single pack-everything-ask-everything approach" section: the debate structure is optimised for questions with no ground truth, and all three target tasks have ground truth. |
| **Anonymous cross-ranking (`review` stage)** | Karpathy's ranking stage exists to surface which open-ended argument is most persuasive. For a diff review the useful output is the *union* of findings, not a ranking. It also costs a second full round-trip per model with a prompt containing every other model's output: roughly doubling cost and latency for no gain. |
| **Chairman synthesis** | The brief states this explicitly: "a human (me) compares the independent responses and decides." Synthesis is also actively harmful for review: a chairman that drops one model's true finding as an outlier has destroyed the exact signal the panel was bought for. |
| **`report.mjs` (483 lines) HTML report generator** | Built to render a three-stage debate with rankings. For 3 independent responses to a grounded question, a Markdown transcript Claude Code reads back into the conversation beats an HTML file the user must open. Retain only the run-JSON writer. |
| **`SELF_ID_PATTERNS` / `stripSelfId()`** | Only needed to keep cross-ranking anonymous. No cross-ranking, no need. |
| **`levenshtein()` / `nearestMatch()` slug suggester** | ~30 lines serving a "did you mean" hint. Cut per CLAUDE.md §2 (Simplicity First). |
| **Panel/chairman vendor-collision disclosure machinery** | An artifact of having a chairman. A flat model list makes vendor diversity a straightforward property of the list. |
| **Cross-jurisdiction default panel** (US + China fixed as the default) | Not wrong per se, but it was tied to maximising debate diversity for a tool that sent **no repo source**. For grounded tasks the panel should be chosen per task and per sensitivity. Keep the *disclosure* mechanism, drop the fixed default. |

#### 3.3.4 The consent flow: the highest-value artifact, keep it exactly

`.claude/commands/council-providers.md` encodes a constraint that is easy to rediscover painfully:

> **Claude Code's Bash tool is non-interactive.** The script's own interactive `Type SEND` prompt would hang forever waiting for input that never arrives.

So the command mandates:

1. **Dry run**, extract any flags from `$ARGUMENTS`, write the remaining question text to a temp file via the `Write` tool, invoke with `--question-file=<path> --dry-run`. Never `--yes`. Never interpolate question text into a shell string.
2. **Surface**, paste the full manifest verbatim into chat (sources + byte counts + scrub hits, model list with families, provider policy, cost estimate).
3. **Stop and wait.** Explicitly: *"Do not treat your own assessment that the plan 'looks fine' as approval. If the user's next message asks a clarifying question, edits the question, or otherwise doesn't clearly approve, answer it and stay at Step 3."*
4. **Only after an explicit user approval message**, re-run the identical command with `--yes` appended.
5. **Report** output paths, real cost, failed models.

Any wrapper the new design ships **must inherit both properties** (non-interactive-safe consent, `--question-file`) or it will hang on first use and/or leak question text through shell quoting.

This flow is also the *only* gate that actually exists. See §9.1 on `defaultMode: bypassPermissions`.

### 3.4 Three different things called "council": do not conflate

| Name | Status | What it is | Cost |
|---|---|---|---|
| `.claude/skills/llm-council/SKILL.md` | **Active today** | 5 Claude sub-agents with different thinking lenses, anonymous peer review, chairman synthesis. No external API. Auto-triggers on phrases like "council this". | Free (Claude tokens only) |
| `scripts/council/` (commit `c8361ce`) | **Deleted** (reverted by `257dee5`) | Same debate pattern, dispatched to 5 external models through an OpenAI-compatible endpoint (`direct.shopaikey.com`, not OpenRouter). | Real money |
| `dispatch.mjs` (this report) | **Proposed, not built** | Flat parallel fan-out of *one* grounded prompt to 2-3 external models. No ranking, no chairman. Human compares. | Real money |

The reverted commit also appended a 4-line "multi-provider companion tool" section to the live `llm-council/SKILL.md`; the revert removed it. The active skill has no reference to any external tool today, and a new design should **not** re-add cross-references between the free skill and the paid tool, that coupling is what made the three easy to confuse.

### 3.5 Repo shape relevant to context sizing

Measured against the working tree:

- **141 `.ts` files** across `src/` + `tests/`, **1,094,010 bytes** of source.
- At ~4 chars/token that is **≈273,000 tokens** for a full-repo pack, *before* repomix's directory tree and per-file headers.
- **482 import statements total**: 316 relative (`../`, `./`), 85 tsconfig-alias (`@config/` 21, `@data/` 27, `@pages/` 22, `@utils/` 15), the remainder bare package specifiers (`@playwright/test` appears in 141 files). Aliases cluster in `tests/` (`@config/base-test`, `@data/*`); page objects use relative paths (`../base-page`, `../../constants/timeouts`).
- `tsconfig.json`: `strict: true`, `module`/`moduleResolution` `NodeNext`, `declaration: true`, `outDir: ./dist`, `rootDir: .`, `include: ["src/**/*", "tests/**/*"]`, 5 path aliases (`@pages/*`, `@tests/*`, `@utils/*`, `@config/*`, `@data/*`, **no `@constants`**, matching CLAUDE.md).
- `package.json`: 14 devDependencies, 2 dependencies. `dotenv ^17.4.1`, `cross-env ^10.1.0`, `zod ^4.4.3` already present. **No `repomix`.** No `engines` field. CI pins Node `'22'` across all workflows; local dev is Node v24.17.0, npm 11.13.0.
- `src/utils/redact.ts` exports `REDACTION_MARKER`, `redactSensitiveData<T>()`, `redactSensitiveText()`, `redactConsoleText()`, TypeScript, scoped to test-runtime payload redaction, imported only from test/config code.
- `.github/workflows/`: 8 workflows (`playwright.yml`, `playwright-with-slack.yml`, `api-restful-tests.yml`, `api-restful-tests-with-slack.yml`, `lighthouse-ci.yml`, `percy-visual-tests.yml`, `security.yml`, `bitbucket-mirror.yml`). None should reference this tool.
- `.claude/hooks/`: 6 hooks (`advisor-nudge.js`, `post-tool-batch.js`, `post-tool-use-failure.js`, `pre-tool-use.js`, `sync-memory.js`, `user-prompt-submit.js`), hook-based automation is an existing working pattern here, which matters for §4.1.

---

## 4. Options

### 4.1 Integration point: skill vs. hook vs. CLI (RQ2)

Four candidates, evaluated for a **solo QA engineer** running this locally.

| Option | Pros | Cons |
|---|---|---|
| **A. Skill** (`.claude/skills/ask-council/SKILL.md`) | Natural-language invocation; can carry rich context-assembly instructions in the body; matches the largest existing category (22 skills). | **Auto-triggers.** The active `llm-council` skill's frontmatter carries `MANDATORY TRIGGERS` and fires on ordinary phrasing. A skill that spends money on ambiguous phrasing ("get another opinion on this") is a footgun. Skills also have no natural place to encode a two-step Bash consent handshake: they describe intent, not a command sequence. |
| **B. Git hook** (`pre-commit` / `pre-push`) | Automatic pre-merge review; nothing to remember. | Wrong ergonomics for a solo engineer: fires on *every* commit including WIP and docs-only, at real cost and 10-60s latency. Git hooks are non-interactive too, so there is no consent gate: it either spends silently or blocks the commit. Output goes to stderr, outside the Claude conversation, so Claude cannot act on it. And it inverts the design: the whole point is that *Claude assembles the context*, which a git hook cannot do. **Reject.** |
| **C. Bare CLI only** (`npm run council -- ...`) | Simplest; matches `sync:vault` / `ingest:jira` precedent exactly; usable outside Claude Code. | Loses the load-bearing property: without a command file telling Claude how to assemble context per task type and how to run the non-interactive consent handshake, Claude will either paste too little context or hang on the interactive prompt. This is what the reverted `/council-providers` command existed to fix. |
| **D. Three slash commands over one shared script** (chosen) | Explicit invocation: money is only spent when the user types `/council-review`. Each command file is the natural home for that task's context-assembly rule, prompt template, and default tier. Matches the `/sync-vault` to script precedent precisely. The consent handshake lives in the command body where it belongs. Discoverable via `/`. | Three files instead of one; some duplicated consent boilerplate. |

**Chosen: D**, with C as the transport underneath (the npm aliases exist and work standalone). Three commands, not one `--mode` flag, because the differences between the tasks are *instructions to Claude* (what to gather, what to ask), not *arguments to a script*, and instructions to Claude belong in command files.

Rejected variant: one command `/council <mode> <question>`. It collapses three genuinely different context-assembly procedures into one file, and Claude would have to branch on mode inside the prose. Three ~40-line files are clearer than one ~120-line file with three branches.

### 4.2 Where `dispatch.ts` lives (RQ4)

**Two independent sub-questions.** The brief conflates them.

#### Sub-question A: in-repo vs. Nanobot

| Option | Pros | Cons |
|---|---|---|
| **In-repo** (chosen) | Claude Code can read, modify, and version the dispatcher alongside the prompts it feeds. Context assembly and dispatch stay in one reviewable place. Prompt templates and model lists live under version control next to `CLAUDE.md`, so drift is visible in `git diff` and reachable by `qa-code-reviewer`. Works whether or not Nanobot is up. Precedent: 5 existing local scripts, one existing local MCP integration. | Duplicates a transport that reportedly already works elsewhere. Key management is local (`.env.local`), so the key sits on the dev machine. ~200 lines to maintain. |
| **Nanobot-hosted capability** | Transport already debugged (per user report). Central key management. Reusable across repos. | **Unverifiable from this repo**: nothing in the working tree or git history documents Nanobot's config, its OpenRouter fallback, or its DeepSeek proxy. Would require a new MCP server entry in `.mcp.json` (currently *only* `lightrag`) or an HTTP call to a local agent, adding a runtime dependency on a second process being up. Prompt templates and model tiers would live outside this repo, invisible to `git diff`. Context assembly would still have to happen here and be shipped over, so the boundary buys little. Cross-repo coupling for a single-repo tool. |

**Chosen: in-repo, but the either/or is a false dichotomy, and the design should dissolve it.**

The only thing Nanobot genuinely provides is *a working OpenAI-compatible base URL and key*. Make that a one-line config:

```
COUNCIL_BASE_URL   default https://openrouter.ai/api/v1
OPENROUTER_API_KEY (name retained for continuity with the reverted convention)
```

Then "route through Nanobot/ShopAIKey" becomes a `.env.local` edit, not an architecture. This is also exactly what the reverted code did in practice, it swapped one constant. Two guardrails must ship with it (§8.6):

- The model tier table in §8 is **only valid for `openrouter.ai`**. Changing the base URL invalidates the slugs *and* the cost estimator.
- `GET /models` and `GET /key` are OpenRouter conveniences, not OpenAI-spec core. The reverted code's fail-soft handling (warn, fall back to `pricing: null`, print "UNKNOWN" not "$0.00") is correct and must be carried over.

#### Sub-question B: `.ts` or `.mjs`?: a verified constraint the brief misses

The brief names the file `dispatch.ts`. In this repo that name forces a choice:

- **`scripts/council/dispatch.ts`**, `tsconfig.json` has `"include": ["src/**/*", "tests/**/*"]`, so `scripts/` is **outside** the typecheck. `npm run lint` (`tsc --noEmit`) would silently not check it, a `.ts` file with zero type safety, which is worse than honest JS. Fixing that means adding `scripts/**/*` to `include`, which drags a dev tool into the test-suite typecheck and into `dist/` (`declaration: true`, `outDir: ./dist`), or maintaining a second `tsconfig.scripts.json`.
- **`src/utils/dispatch.ts`**, gets typechecked, but is then inside the test suite's own source tree, emitted to `dist/`, and reachable from test code. It is not test code. Wrong home.
- **`scripts/council/dispatch.mjs`** (chosen), matches all five existing scripts, needs no tsconfig change, no build step, no new devDependency, runs on the repo's Node 22/24 with native `fetch` and `AbortSignal.timeout()`.

**Chosen: `scripts/council/dispatch.mjs`.** Note this deviates from the brief's literal filename; the brief says "`dispatch.ts` (or equivalent)".

### 4.3 Context building: repomix vs. custom import-graph walker (RQ3)

**The discriminating question is not alias resolution: it is whether repomix traverses imports at all. It does not.**

Verified via Context7 (`/yamadashy/repomix`, both `info` and `code` modes) and `https://repomix.com/guide/command-line-options`:

> "There is no CLI option for importing/resolving dependencies or TypeScript path aliases. File selection relies exclusively on: glob patterns (`--include` / `--ignore`), stdin input (`--stdin`, read file paths from stdin, one per line), and gitignore rules. External tools like `find` or `git ls-files` must handle dependency resolution, Repomix itself performs no entry-point analysis or TypeScript configuration parsing for path aliases."

npm registry, `repomix@1.17.0`: `engines.node >= 22`, 26 production dependencies including `web-tree-sitter` + `@repomix/tree-sitter-wasms` (for `--compress`), `gpt-tokenizer` (token counting), `globby`/`minimatch`, and **`@secretlint` packages** (built-in secret scanning).

So the brief's plan, "packed via `repomix` with a scoped `--include`", **does not work unaided on this codebase**. A glob can express "pack `src/pages/ecommerce/**`", but it cannot answer "pack the files this diff imports," and 85 of this repo's imports are `@`-aliased forms that no glob can follow. Any automated resolver must handle **both** the alias and relative forms.

That reframes the comparison. Whoever resolves the graph, repomix's role is reduced to **formatter**.

| Option | Pros | Cons |
|---|---|---|
| **A. Claude Code resolves + `npx repomix --stdin`** (chosen) | Claude already reads the diff and sees every import line; it resolves `@config/*` to `src/config/*` from a tsconfig it already has in context, and relative paths trivially. Zero resolver code to write or maintain. repomix contributes real value as a formatter: consistent structure, `--token-count-tree` for budget visibility, `--compress` (tree-sitter signature extraction) as an escape hatch for oversized packs, and a `@secretlint` pass as a *second* net alongside `scrub.mjs`. Invoked as `npx -y repomix@1.17.0 --stdin`, so no permanent devDependency is added for an occasional dev-time tool and `package-lock.json` stays untouched. **This does not shrink the 26-transitive-dep surface: it moves it outside `npm audit` / `security.yml` visibility, which is a trade, not a win.** A pinned devDependency would be strictly more auditable; the reason to prefer `npx` here is scope hygiene (the tool is not part of the test suite), not security. | Network fetch on first `npx` run (cached after). Depth is whatever Claude decides: no guarantee of transitive completeness. repomix's secretlint check may *exclude* a flagged file, which could silently drop something the panel needed; verify behaviour and surface exclusions. Node >=22 required (satisfied: CI 22, local 24). |
| **B. Custom import-graph walker** (`scripts/council/walk-imports.mjs`) | Deterministic and repeatable: same diff always yields the same pack. Handles both alias and relative forms explicitly by reading `tsconfig.json` `paths`. Can enforce a depth limit and a hard token budget. Zero third-party code. Reusable outside Claude Code. | ~150-250 lines of parsing to write and maintain: `import` / `export ... from` / `import type` / dynamic `import()`, `NodeNext` extension resolution (`.js` specifiers resolving to `.ts` sources), index resolution, cycle detection, and the 5 alias mappings. Known-fiddly with a long tail. Duplicates work Claude does for free. No secret scanning unless bolted on. Violates CLAUDE.md §2 (Simplicity First) for a v1. |
| **C. Neither: dispatcher concatenates a plain file list** | Truly zero dependencies. ~40 lines: read each path, emit a path header plus content. Matches the reverted tool's "zero new npm dependencies" property. Full control over the scrub pass. | Loses token counting, `--compress`, and the secretlint net. Reinvents a small piece of repomix badly. |

**Chosen: A, with C as the fallback** if `npx` is unacceptable in the user's environment. Reject B for v1, build it only if the "Claude picks the files" approach empirically misses relevant files, for which §11 check 16 defines a test.

Concretely, `/council-review` would do:

```bash
git diff --name-only main...HEAD          # Claude reads the diff
# Claude resolves each file's depth-1 imports (alias + relative) itself
# Write the list OUTSIDE the repo (session scratch dir), not to the repo root — an
# untracked .council-files.txt would contaminate the very `git status` / `git diff`
# this command is about to read.
printf '%s\n' <resolved file list> > "$SCRATCH/council-files.txt"
cat "$SCRATCH/council-files.txt" | npx -y repomix@1.17.0 --stdin --stdout --token-count-tree 1000
```

then hands the pack to `dispatch.mjs` via `--context=<packfile>`.

### 4.4 Panel shape: flat fan-out vs. the reverted debate pattern

Stated explicitly because it is the core pivot from the prior art.

| Option | Pros | Cons |
|---|---|---|
| **Flat parallel fan-out (2-3 models, one round)** (chosen) | One round-trip per model, all in parallel: lowest cost, lowest latency. Every finding reaches the human unfiltered. Trivially explainable. Matches the brief: "returns each model's response independently... a human compares." | Human does the merging. Duplicate findings across models are not deduplicated. |
| **Debate + ranking + chairman (reverted design)** | Produces one polished answer; good for genuinely open decisions. | ~3x the calls and ~3x the cost for grounded tasks; the synthesis step can *delete* a true finding as an outlier; the free `llm-council` skill already covers the open-decision case at zero marginal cost. |

---

## 5. Recommended Approach

**Build `scripts/council/dispatch.mjs`, a generic, task-agnostic parallel fan-out client, and drive it from three task-specific slash commands. Claude Code assembles context; the script only transports, scrubs, gates, and reports.**

### 5.1 Architecture

```
/council-review   ---+
/council-fix      ---+--> Claude Code assembles context --> temp files
/council-research ---+     (diff / error+files / question only)
                             |
                             v
        node scripts/council/dispatch.mjs
          --question-file=<tmp>            # never interpolated into shell
          --context=<pack>                 # repeatable, explicit only
          --tier=cheap|premium             # or --models=a,b,c
          --dry-run   ->  manifest + cost estimate, no calls
          --yes       ->  real run, after explicit user approval only
                             |
                    scrub.mjs (denylist)
                    assertNoApiKeyInPayload()
                             |
                POST {COUNCIL_BASE_URL}/chat/completions   xN in parallel
                             |
              council-output/<ts>-{transcript.md, run.json}
```

### 5.2 Design invariants (non-negotiable)

1. **No cross-ranking, no chairman.** N independent responses, side by side. The human decides.
2. **The script never scans the workspace.** Context enters only via explicit `--context=<path>`. Inherited from the reverted tool and worth keeping: it makes the manifest an exhaustive statement of what leaves the machine.
3. **Two-step consent, always** (§3.3.4). Non-interactive-safe: `--dry-run`, paste manifest verbatim, **stop and wait for a user message**, identical re-run with `--yes`.
4. **Question text always via `--question-file`.** Never interpolated into a shell command string.
5. **Never in CI, never in the test suite.** No workflow, no config, no fixture references it.
6. **Zero new `package.json` dependencies.** Raw `fetch`, `AbortSignal.timeout()`, existing `dotenv`. repomix via pinned `npx`.
7. **Credentials from shell env or gitignored `.env.local` only.** Never `.env.{NODE_ENV}`. Never read by `src/config/environment.ts`.
8. **Vendor diversity is a design goal.** Claude Code is Anthropic. An Anthropic panelist is a correlated second opinion at premium prices, exclude by default.
9. **Fail soft on catalog/key endpoints, fail hard on 401/402.** `FatalAuthError` aborts the whole run; missing pricing prints "UNKNOWN", never "$0.00".

### 5.3 CLI surface

```
node scripts/council/dispatch.mjs
  --question-file=<path>       (required) question/instruction text
  --context=<path>             (repeatable) attach a file as context
  --tier=cheap|premium         named model set (default: cheap)
  --models=slug,slug,slug      explicit override (max 4)
  --dry-run                    manifest + estimate only, no calls
  --yes                        skip interactive confirm (required in Claude Code)
  --max-cost=<usd>             abort before spend (default 0.25)
  --max-tokens=<n>             per-response cap (default 1200)
  --timeout=<ms>               per-call timeout (default 120000)
  --out-dir=<path>             default ./council-output
  --show-payload               print full scrubbed payload in the manifest
  --allow-training             disable the default provider data-collection deny
```

Env: `COUNCIL_BASE_URL` (default `https://openrouter.ai/api/v1`), `OPENROUTER_API_KEY`, `COUNCIL_MOCK=1`, `COUNCIL_MOCK_FAIL=slug,slug`.

npm aliases: `council`, `council:dry`, `council:mock` (the reverted names were fine).

---

## 6. Context-Assembly Approach per Task Type

### 6.0 The gating rule (RQ7)

Apply **before** invoking anything. Answer three questions in order; stop at the first that resolves.

| # | Question | If yes |
|---|---|---|
| 1 | Does the task reference a **concrete artifact that exists right now**: a diff, a stack trace, a named file, a failing test ID? | Attach that artifact. Go to 2. |
| 2 | Would a competent reviewer need to see **code the artifact references** to judge it? (does it call/extend/import something whose contract matters?) | Attach depth-1 imports of the touched files. Go to 3. |
| 3 | Does the task turn on a **project convention** (naming, fixture registration, helper ownership, import rules)? | Attach the *relevant excerpt* of `CLAUDE.md` or the matching `memory-vault/20-memory/` note: **never the whole file**. |

If none apply, send the question alone. That is the original `llm-council` use case and needs no repo context.

**Hard budget:** if the assembled pack exceeds **~40,000 tokens**, stop and narrow. Do not raise the budget. At 40k the pack is already 15% of a full-repo dump and well past the point where "lost in the middle" degradation starts mattering for the cheap-tier models. Narrow by: dropping depth-1 imports of files the diff only touches cosmetically; replacing a full file with the relevant class/function; substituting a vault note for source.

**Never attach, under any circumstance, without an explicit scrub pass and a human look at the manifest:**
- `test-results/**` or `api-results/**` (traces, videos, error contexts)
- `api-verbose-failure-context.json` (redacted request/response bodies, redacted by `src/utils/redact.ts`'s denylist, which CLAUDE.md itself calls "not a provably complete one")
- `console-failure-context.log` (console + failed-request capture)
- `.env*` files of any kind
- `.auth/` storage state

These are the highest-leakage artifacts in the repo and they sit exactly where a bug-fix workflow would reach. See §9.2.

### 6.1 Diff review

**Trigger:** `/council-review` (optionally with explicit paths; default `git diff main...HEAD`).

**Assembly:**

1. `git diff main...HEAD -- '*.ts'` gives the diff itself, verbatim, as `--context=diff.patch`. The diff is the primary artifact; do not summarize it.
2. Full current content of each changed `.ts` file. The diff shows deltas; reviewers need surrounding context, a `private readonly` locator violation is invisible in a hunk that doesn't include the class header.
3. **Depth 1 only** of each changed file's imports, resolving both forms:
   - `@config/base-test` to `src/config/base-test.ts`
   - `@pages/ecommerce/pdp-page` to `src/pages/ecommerce/pdp-page.ts`
   - `../base-page` to `src/pages/base-page.ts`
   - Skip `@playwright/test` and other bare package specifiers.
   - **Special case:** `src/config/base-test.ts` is large and imports every fixture. If a changed file imports it, attach only its fixture-type declarations, or reference `memory-vault/20-memory/project/fixture-registry.md` instead.
4. A **curated conventions excerpt**, not all of `CLAUDE.md` (~600 lines). Pick by area:
   - page object changed: "Adding a New Page Object" + the helper table
   - UI spec changed: "Import Convention", "Test Structure", "Soft Assertions", "Test Data"
   - API spec changed: "API Tests" (import rule, `ApiResponseWrapper`, GraphQL operation placement)
5. Pipe the file list through `npx -y repomix@1.17.0 --stdin --stdout`, then `--context=` the result.

**Typical size:** 1 diff + 2-4 changed files + 3-8 imports + ~150 lines of conventions is roughly **10k-20k tokens**.

**Tier:** `cheap` for WIP, `premium` for pre-merge.

### 6.2 Bug fixing

**Trigger:** `/council-fix <spec path or test name>`.

**Assembly:**

1. **The symptom, verbatim and scrubbed**: error message, assertion diff, stack trace. Extract by hand from the failure output, **do not attach the raw artifact files** (§6.0). Run the extracted text through `scrub.mjs` and check the manifest's scrub-hit counts before approving.
2. The **failing test block** plus its `describe` wrapper (not the whole spec, unless small).
3. The **page object / service method the stack trace names**, in full.
4. **Depth 1 imports** of that page object, critically, its `BasePage` helper surface. If the trace touches `this.elements.*` or `this.waits.*`, attach the relevant helper from `src/pages/helpers/` so the panel can see what those methods actually do rather than guessing from the name.
5. **A vault note if one exists for this area.** Highest-leverage step, and unique to this repo. `memory-vault/20-memory/project/` and `feedback/` hold 39 distilled notes including `ecommerce-pdp-page-gotchas.md`, `ecommerce-auth-modal-gotchas.md`, `gra-storefront-tech-notes.md`, `pdp-004-005-vans-au-root-cause.md`, `parallel-ui-data-isolation.md`, `windows-ci-timeout-shard-fix.md`. Grep the vault for the failing area first; a 30-line note saying "Vans AU has a Bloomreach popup you must dismiss with `#popup-close`" is worth more than 2,000 lines of page-object source at ~1% of the cost.
6. **What was already tried**, one short paragraph. Without this the panel's first suggestion is almost always something already ruled out. This alone is the difference between useful and useless bug-fix output.

**Typical size:** **6k-15k tokens**.

**Tier:** `cheap` first pass; `premium` if the cheap trio converges on something already ruled out.

**Interaction with `advisor()`:** CLAUDE.md §5 lists seven patterns warranting an immediate `advisor()` call. The council is **not** a replacement, `advisor()` sees the full conversation transcript and is free; the council sees only what is pasted and costs money. Correct ordering: `advisor()` first, council only when the two would genuinely see different things (e.g. the question is about vendor/framework behaviour rather than about what this session already tried).

### 6.3 Technical research

**Trigger:** `/council-research <question>`.

**Assembly, default is nothing.** Send the question alone. Then apply §6.0:

- **No repo anchor** ("Is contract testing worth it for a 4-brand GraphQL API?"): question only. ~500 tokens. This is the original `llm-council` use case.
- **Repo-anchored but conceptual** ("Should our composition-based POM own network mocking in a helper or a fixture?"): question + **a vault note**, not source. `memory-vault/20-memory/project/project_architecture.md` or `fixture-registry.md`. Vault notes are already distilled for exactly this purpose (the brief: "curated specifically to prevent hallucination from missing project context").
- **Names a specific file or module** ("Is `ApiClientExt`'s wrapper chain the right abstraction?"): question + that one file + the relevant `CLAUDE.md` section. Still no import walk, research questions are about *design*, and design is legible from one file plus its contract.
- **Multi-note synthesis needed**: `mcp__lightrag__query_document` (mode `hybrid`), health-check first, and attach *that synthesis* rather than N raw notes. If LightRAG is down, fall back to Grep + attach 1-2 notes.

**Typical size:** **0.5k-5k tokens.**

**Tier:** `cheap`. Model *disagreement* is the product here, and cheap models disagree just as informatively as expensive ones on open questions. Escalate to `premium` only when the decision is expensive to reverse.

---

## 7. Prompt Templates per Task Type (RQ6)

Four properties every template must have, because they are what separate focused output from generic output:

1. **State the reviewer's role and the stack concretely**, "senior Playwright/TypeScript reviewer," not "helpful assistant."
2. **Forbid restating.** Models default to summarizing the input back. Explicitly ban it.
3. **Demand file:line anchoring.** An unanchored finding cannot be acted on or verified.
4. **Require an explicit "nothing found" path.** Without it, every model invents a finding to look useful. This is the single highest-value line in each template.

A shared system message precedes all three:

```
You are reviewing material from a Playwright + TypeScript end-to-end test automation
framework. You have ONLY the context provided below - you cannot browse the repository,
run commands, or see files that were not attached.

Rules:
- If you need a file that was not provided, say exactly which file and why. Do not guess
  its contents.
- Anchor every point to a file path and, where possible, a line or symbol name.
- Do not restate or summarize the input back to me.
- If you find nothing worth reporting in a category, write "None." and move on.
  Inventing a finding to appear useful is worse than finding nothing.
```

### 7.1 Diff review

```
TASK: Review this diff for correctness and for violations of the project conventions below.

CONTEXT PROVIDED:
1. The diff (git diff main...HEAD)
2. Full current content of each changed file
3. Direct (depth-1) imports of each changed file
4. Relevant excerpts of the project's CLAUDE.md conventions

Report ONLY these five categories, in this order. Skip any category with nothing to report.

1. CORRECTNESS - logic errors, wrong assertions, race conditions, unhandled rejections,
   assertions that can pass vacuously (a check that is always true regardless of the
   state it claims to verify).
2. CONVENTION VIOLATIONS - measured against the attached CLAUDE.md excerpt only. Do not
   apply generic style preferences from other codebases. Common ones here: locators
   inlined in method bodies instead of hoisted to private readonly class fields;
   page.locator()/page.click() called directly inside a page class instead of going
   through a BasePage helper; importing from '@playwright/test' in a UI spec instead of
   '@config/base-test'; magic-number timeouts instead of TIMEOUTS.* constants; test data
   hardcoded in a spec instead of a typed module under src/data/.
3. TEST RELIABILITY - what makes this flaky. Fixed waits, order dependence, shared
   mutable state across tests, locators that depend on DOM structure rather than
   role/label/text, missing cleanup.
4. TYPE SAFETY - this project is TypeScript strict mode. Flag any, unchecked non-null
   assertions, missing explicit return types on exported functions, exported data objects
   without a named interface annotation.
5. WHAT I WOULD CHANGE FIRST - exactly one item, the highest-impact one, with the
   concrete edit. Not a list.

Format each finding as:
  [CATEGORY] path/to/file.ts:LINE - one-sentence problem - one-sentence fix

Be specific about THIS diff. A finding that would apply to any TypeScript file is not
useful to me.
```

### 7.2 Bug fixing

```
TASK: Diagnose why this Playwright test is failing. Propose the most likely root cause
and a concrete fix.

CONTEXT PROVIDED:
1. Error message, assertion diff, and stack trace (secrets redacted)
2. The failing test and its describe block
3. The page object / service method the stack trace names
4. Direct imports of that file, including the relevant BasePage helper
5. Project notes for this area, if any exist
6. What has already been tried

Answer in exactly this structure:

ROOT CAUSE HYPOTHESIS (1-3 sentences)
  Commit to the single most likely cause. Do not list five possibilities ranked by
  probability - that is not actionable.

EVIDENCE
  Quote the specific lines from the provided context that support the hypothesis. If the
  provided context does not actually support any hypothesis, say so and name the ONE file
  or artifact you would need next.

THE FIX
  Concrete code. Exact file, exact change. If the fix belongs in a helper class rather
  than the page object or the spec, say which and why.

WHY THE ALREADY-TRIED APPROACHES FAILED
  Address them directly. Do not re-propose anything listed under "already tried".

WHAT WOULD FALSIFY THIS
  One check I can run in under a minute that proves the hypothesis wrong if it is wrong.

Note: this suite runs against live staging storefronts across multiple brands and
regions. Timing, third-party overlays (cookie banners, marketing popups), and per-brand
DOM differences are common real causes - but do not default to "add a wait" unless the
evidence points there. "Add a longer timeout" is almost never the correct answer and I
will discard it.
```

### 7.3 Technical research

```
TASK: Give me your independent view on the question below.

You are one of three models being asked this question in parallel. Your answers will be
compared side by side. Do not hedge toward a consensus you cannot see. If you think the
premise of the question is wrong, say so first - that is a more valuable answer than a
well-organized answer to the wrong question.

Answer in this structure:

POSITION (2-4 sentences)
  Your actual recommendation. Commit to it.

WHY
  The two or three load-bearing reasons. Not a survey of considerations.

WHAT THIS COSTS
  The concrete trade-off you are accepting. Every real recommendation has one. If you
  claim there is no downside, you have not thought about it.

WHEN THIS IS THE WRONG CALL
  The conditions under which you would recommend the opposite.

WHAT I SHOULD VERIFY
  The one fact that, if I checked it and it came out differently, would change your
  answer.

Constraints: this is a solo-maintained QA automation framework. Recommendations that
require a dedicated platform team, a new service to operate, or ongoing manual curation
are not viable - say so if the honest answer is that the problem needs more people than
are available.
```

---

## 8. Model Tiering Recommendation (RQ5)

### 8.1 Source and method

Retrieved **2026-08-01** from `https://openrouter.ai/api/v1/models` (public, unauthenticated JSON, **336 models** returned). Prices below are **USD per million tokens**, converted from the API's per-token `pricing.prompt` / `pricing.completion` strings. `ctx` is `context_length`.

Corroborating docs fetched the same day: `openrouter.ai/docs/api-reference/overview` (endpoint `POST https://openrouter.ai/api/v1/chat/completions`; `Authorization: Bearer`; optional `HTTP-Referer` and app-title header; OpenAI-normalized schema; `usage` object with `prompt_tokens`/`completion_tokens`/`total_tokens` plus an optional `cost` field; a `provider` field for routing preferences), `openrouter.ai/docs/api-reference/limits`, and `openrouter.ai/docs/features/privacy-and-logging`.

**Caveat carried forward from the reverted CLAUDE.md section, which was right about this:** "the OpenRouter model catalog changes quickly... should be spot-checked periodically against `https://openrouter.ai/api/v1/models`, there is no automated check by design." Treat the table below as a dated snapshot, not a constant. Re-check before the first real run.

### 8.2 Cheap / default tier

| Model | Prompt $/M | Completion $/M | ctx | Notes |
|---|---|---|---|---|
| `qwen/qwen3.7-flash` | 0.030 | 0.130 | 1,000,000 | Cheapest credible entry; **China jurisdiction** |
| `openai/gpt-5-nano` | 0.050 | 0.400 | 400,000 | Cheapest OpenAI-family entry |
| `z-ai/glm-4.7-flash` | 0.060 | 0.400 | 202,752 | Z.ai / Zhipu; **China jurisdiction** |
| `qwen/qwen3-coder-30b-a3b-instruct` | 0.070 | 0.280 | 262,144 | Code-specialized: strong fit for diff review; **China jurisdiction** |
| `mistralai/mistral-small-3.2-24b-instruct` | 0.075 | 0.200 | 256,000 | EU jurisdiction |
| `google/gemini-2.5-flash-lite` | 0.100 | 0.400 | 1,048,576 | Huge context for the price |
| `deepseek/deepseek-v4-flash` | 0.140 | 0.280 | 1,048,576 | The brief's DeepSeek preference; **China jurisdiction** |

**Recommended default trio (three distinct vendors):**
`openai/gpt-5-nano` + `google/gemini-2.5-flash-lite` + `deepseek/deepseek-v4-flash`.
DeepSeek is China-hosted. For a US/EU-only variant, substitute `mistralai/mistral-small-3.2-24b-instruct`.

### 8.3 Mid tier

| Model | Prompt $/M | Completion $/M | ctx |
|---|---|---|---|
| `openai/gpt-5-mini` | 0.250 | 2.000 | 400,000 |
| `google/gemini-3.1-flash-lite` | 0.250 | 1.500 | 1,048,576 |
| `deepseek/deepseek-chat-v3.1` | 0.250 | 0.950 | 163,840 |
| `z-ai/glm-4.7` | 0.400 | 1.750 | 204,800 |
| `deepseek/deepseek-v4-pro` | 0.435 | 0.870 | 1,048,576 |
| `openai/gpt-5.4-mini` | 0.750 | 4.500 | 400,000 |

### 8.4 Premium / high-stakes tier

| Model | Prompt $/M | Completion $/M | ctx |
|---|---|---|---|
| `openai/gpt-5.1` | 1.250 | 10.000 | 400,000 |
| `google/gemini-2.5-pro` | 1.250 | 10.000 | 1,048,576 |
| `x-ai/grok-4.5` | 2.000 | 6.000 | 500,000 |
| `google/gemini-3.1-pro-preview` | 2.000 | 12.000 | 1,048,576 |
| `anthropic/claude-sonnet-5` | 2.000 | 10.000 | 1,000,000 |
| `openai/gpt-5.4` | 2.500 | 15.000 | 1,050,000 |
| `anthropic/claude-opus-5` | 5.000 | 25.000 | 1,000,000 |

**Recommended premium trio:** `openai/gpt-5.1` + `google/gemini-3.1-pro-preview` + `x-ai/grok-4.5`.

**Deliberately excluding Anthropic from both tiers.** Claude Code in this session is `claude-opus-5`. Buying `anthropic/claude-sonnet-5` as a panelist purchases the most *correlated* opinion available at premium prices. Vendor diversity is the entire product. The reverted design's default panel included `anthropic/claude-haiku-4.5` alongside a Claude-driven workflow, a mistake worth not repeating.

Also: never pair two models from the same vendor family in one panel (e.g. `openai/gpt-5.1` + `openai/gpt-5-nano`).

### 8.5 Cost arithmetic: the concrete case against packing everything

Assume a diff review: **15,000 prompt tokens** (per §6.1) and **1,500 completion tokens** per model.

| Panel | Prompt cost | Completion cost | **Total / run** |
|---|---|---|---|
| Cheap trio (gpt-5-nano + gemini-2.5-flash-lite + deepseek-v4-flash) | 15,000 x $0.29/M = $0.0044 | 1,500 x $1.08/M = $0.0016 | **~$0.006** |
| Mid trio (gpt-5-mini + gemini-3.1-flash-lite + deepseek-v4-pro) | 15,000 x $0.935/M = $0.0140 | 1,500 x $4.37/M = $0.0066 | **~$0.021** |
| Premium trio (gpt-5.1 + gemini-3.1-pro-preview + grok-4.5) | 15,000 x $5.25/M = $0.0788 | 1,500 x $28.00/M = $0.0420 | **~$0.121** |

Now the "pack the whole repo" alternative. The repo is **141 TS files / 1,094,010 bytes ~= 273,000 tokens** before repomix's tree and headers:

| Panel | Prompt cost at 273k tokens | Prompt-cost ratio vs. scoped 15k |
|---|---|---|
| Cheap trio | 273,000 x $0.29/M = **$0.079** | 18x |
| Premium trio | 273,000 x $5.25/M = **$1.43** | 18x |

At ~100 runs/month (5 reviews/day x 20 working days), counting prompt **and** completion: **$0.60/month scoped vs. $8.06/month packed** on the cheap trio, and **$12.10 vs. $147.50/month packed** on the premium trio. And the packed version is *worse*: 273k tokens exceeds `openai/gpt-5.3-chat`'s 128k window outright, and sits in the region where relevant-detail recall degrades for every cheap-tier model. **~18x the prompt cost (~13x total, once completion is included) for lower-quality answers** is the concrete form of the brief's "more context is not strictly better."

### 8.6 Endpoint caveat: must be resolved before implementation

Everything in §8 is valid **only** for `COUNCIL_BASE_URL=https://openrouter.ai/api/v1`. If the user routes through ShopAIKey / Nanobot (as the reverted code did, §3.3.1):

- Model IDs change. The reverted `panels.mjs` slugs were unversioned bare names (`gpt-5.4-mini`, `deepseek-v4-pro`) vs. OpenRouter's namespaced `openai/gpt-5.4-mini`, `deepseek/deepseek-v4-pro`. Not interchangeable.
- `GET /models` and `GET /key` may not exist, so no pricing and no credit check. The cost estimator must print "UNKNOWN", and `--max-cost` becomes unenforceable, leaving the consent manifest as the sole cost backstop.
- Provider-routing preferences are OpenRouter-specific and will be ignored or rejected by a generic OpenAI-compatible proxy.

**This must be a decision the user makes explicitly at implementation time, not a default that drifts.**

### 8.7 Rate limits and privacy routing

`openrouter.ai/docs/api-reference/limits`, retrieved 2026-08-01: paid models have **no platform-level request cap** (only Cloudflare DDoS protection against dramatic overuse); `:free` model variants are capped at 20 req/min and 50 req/day under $10 lifetime credit, rising to 1,000 req/day at $10+. 429 means retry with exponential backoff honouring `Retry-After`. 402 means out of credit or per-key limit hit. `GET /api/v1/key` reports `limit_remaining` and usage. Three parallel calls is trivially within limits.

`openrouter.ai/docs/features/privacy-and-logging`, retrieved 2026-08-01: each provider follows its own data-handling policy; an account-level setting can restrict routing to providers that train on prompts ("OpenRouter will not route to providers that train"); provider data-retention classifications including "Zero retention" appear in the provider table; and critically, OpenRouter states these routing settings have **"no bearing on OpenRouter's own policies and what we do with your prompts."**

**Unverified:** the reverted code sent a per-request `provider: { data_collection: 'deny', zdr: true }` body field. The API-reference page does list a `provider` field for "provider preferences," but I could not confirm those exact key names from primary docs. Treat the field name as unverified, confirm against `openrouter.ai/docs/features/provider-routing` before relying on it, and set the account-level training restriction regardless, since that *is* documented.

Practical consequence: **assume anything sent leaves the machine and may be retained.** That is why §9.2 exists.

---

## 9. Risk Assessment

### 9.1 The permission system is not a gate here

`.claude/settings.json` sets `"defaultMode": "bypassPermissions"`. Claude Code will run `node scripts/council/dispatch.mjs` without prompting. **The two-step consent flow in the command file is therefore the only thing standing between an ambiguous user request and money spent plus source code egressed to three vendors.** This raises the stakes on §3.3.4 considerably and is a further argument against a *skill* (auto-triggering) or a *git hook* (no gate at all).

Mitigations that must ship together, not individually:
- Commands, not skills, explicit invocation only.
- Mandatory `--dry-run` first step; `--yes` only after an explicit user approval *message*.
- `--max-cost` default $0.25 (lower than the reverted tool's $0.50, since panels are smaller).
- The command file must repeat the reverted file's exact language: *"Do not treat your own assessment that the plan 'looks fine' as approval."*

### 9.2 Secret and source leakage

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| Staging URLs, brand names, internal hostnames sent to 3 vendors | Medium | **High**: inherent to the design | Disclose in `CLAUDE.md`; `scrub.mjs` internal-host rules; per-source scrub-hit counts in the manifest; user reviews before approving |
| Credentials leaked via bug-fix artifacts (`api-verbose-failure-context.json`, `console-failure-context.log`, `test-results/**`, `.auth/`) | **High** | Medium: these are exactly where a bug-fix flow reaches | **Blocklist them in the command file** (§6.0). Extract only the error text by hand. Route everything through `scrub.mjs`. Non-zero scrub-hit counts in the manifest are a stop-and-look signal, not a "good, it worked" signal |
| `OPENROUTER_API_KEY` committed | High | Low | Shell env or gitignored `.env.local` only; `.env.example` carries a commented placeholder with an explicit "never `.env.testing`/`.env.staging`/`.env.production`" warning; `assertNoApiKeyInPayload()` hard-stops if the literal key appears in an outbound body; `maskKey()` prints last-4 only |
| Two divergent redaction implementations | Medium | Medium | **Named, deliberate divergence.** `src/utils/redact.ts` (TypeScript, test-runtime payload keys) and `scrub.mjs` (JS, outbound text denylist) were deliberately kept separate for different threat models: the reverted `scrub.mjs` header says so explicitly. A future implementation must either keep them separate *and document why*, or bridge them explicitly. **Silently letting them drift is the failure mode.** If bug-fix mode ever attaches verbose-log content, both denylists apply and both must be extended together |
| Scrubbing gives false confidence | Medium | Medium | Both denylists are explicitly non-exhaustive (CLAUDE.md says so of `redact.ts`; `scrub.mjs`'s header says so of itself). The manifest + human review is the primary control; scrubbing is second line, never a justification to skip consent |
| On-demand `npx repomix` executes third-party code outside `npm audit` / `security.yml` coverage | Medium | Medium | Pin the exact version (`repomix@1.17.0`), never a range or a bare `repomix`; treat first-run output as untrusted; re-pin deliberately on upgrade. Under `defaultMode: bypassPermissions` this fetch is not permission-gated, so the version pin is the only control. A pinned devDependency is the stricter alternative if that is unacceptable |
| `council-output/`, the repomix file list, or the question temp file committed | Low | Low | `.gitignore` entry for `council-output/`; route the file list and question temp to a scratch dir outside the repo (§4.3), or gitignore those paths too |

### 9.3 Cost and operational

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| Runaway spend from repeated invocations | Medium | Low | `--max-cost` default $0.25; per-key spending limit set at OpenRouter; explicit invocation only; `GET /api/v1/key` pre-flight where available |
| Cost estimate wrong or unavailable | Medium | **High if not on openrouter.ai** | Fail soft to `pricing: null`, print "UNKNOWN", never "$0.00" (the reverted code did this correctly); disable `--max-cost` enforcement rather than enforcing against a fabricated number |
| Model catalog drift: pinned slug 404s | Low | **High over months** | Pin explicit versioned slugs; reject floating "latest" aliases (reverted guard); re-check `/api/v1/models` before use; fail per-model, not per-run |
| Rate limiting / 429 | Low | Low | Paid models have no platform request cap; 3 parallel calls is trivial. `withRetry()` honours `Retry-After` |
| One model fails, run aborts | Low | Medium | Per-model failure isolation via `Promise.allSettled`: report N-1 responses plus the failure. Only `FatalAuthError` (401/402) aborts the whole run |
| Latency (10-60s for premium models on 15k-token prompts) | Low | High | Parallel fan-out; 120s per-call timeout; explicitly not in CI so nothing blocks on it |

### 9.4 Breaking changes and rollback

**Breaking-change risk: effectively zero.** Every change is additive and lives outside `src/`, `tests/`, and both Playwright configs. Specifically unaffected: the 11 `BasePage` helpers, all 14 UI fixtures, all API fixtures, `playwright.config.ts`, `api.config.ts`, `src/config/base-test.ts`, `src/config/environment.ts`, `tsconfig.json` (no change needed given the `.mjs` decision, §4.2), and all 8 GitHub workflows. `npm run lint` (`tsc --noEmit`) is unaffected because `scripts/` is outside `tsconfig.json`'s `include`. With no `package.json` dependency added, `package-lock.json` is untouched and `npm audit` / `audit:ci` / `security.yml` see no new surface.

**Rollback: `git revert`.** Precedent is proven, commit `257dee5` reverted the entire 2,050-line prior implementation cleanly with no residue (verified: the working tree has zero `council`/`OPENROUTER` references today). Because the tool has no runtime dependents, reverting cannot break a test.

**The salient risk is not technical: it is that this gets built and reverted again.** The prior attempt lasted one day. Two things should change to avoid a repeat: (a) build the smallest thing that answers one task type well (`/council-review`) and use it for a week before adding the other two; (b) resolve §8.6's endpoint question **before** writing code, since it determines whether the model list and cost estimator mean anything.

---

## 10. Implementation Checklist

Ordered, for `technical-implementation-agent` **after user approval** (WORKFLOW-10 hard gate).

**Phase 0: decisions the user must make before any code, RESOLVED 2026-08-02**

1. **Endpoint: `https://direct.shopaikey.com/v1`.** This means every dollar figure and every `ctx` value in §8 is void, per §8.6, because that table was pulled from `https://openrouter.ai/api/v1/models` and namespaced slugs (`openai/gpt-5.1`) are not the same identifier space as a ShopAIKey proxy's bare model names. `COUNCIL_BASE_URL` must be set to this value; `tiers.mjs` (Phase 2, step 9) must ship pricing as `null` for every entry rather than carry over the OpenRouter numbers. The cost estimator prints "UNKNOWN," never "$0.00," exactly as the reverted `fetchModelCatalog()` already did for this same reason (§3.3.1).
2. **Jurisdiction: acceptable.** China-hosted models are in scope for the default panel.
3. **Scope: `/council-review` only for v1.** `/council-fix` and `/council-research` (§6.2, §6.3, §7.2, §7.3, checklist steps 13-14) are deferred, not built now. Re-open them after the usefulness gate (§11 check 17) has been run for at least a week on `/council-review` alone, per §9.4's "avoid a second revert" mitigation.

**Model selection.** The user has named the actual panel: **Kimi-K3** (Moonshot AI), **GPT Sol 5.6** (matches the reverted commit's `openai/gpt-5.6-sol` naming, so this is presumably ShopAIKey's chairman-tier alias, now used as a panelist, not a chairman, since this design has no chairman step), and **GLM 5.2** (Zhipu). These are **user-supplied, unverified from this repo** — nothing in the working tree or OpenRouter's public catalog (§8) confirms these exact identifiers, because they belong to ShopAIKey's namespace, not OpenRouter's. Two consequences for Phase 2:

- `tiers.mjs` ships these three bare slugs as the (only) default panel — `KIMI_K3`, `GPT_SOL_5_6`, `GLM_5_2` (placeholder constant names; use ShopAIKey's actual casing once confirmed against a real call) — with `pricing: null` and `context_length: null` for all three, and a comment stating they are unverified against a live `/models` call because ShopAIKey may not expose one (§3.3.1 point 2 already anticipates this).
- Before the first non-mock run, checklist step 9 must add a live smoke check: one real `chat.completions` call per slug with `--max-tokens=16`, to confirm the identifier resolves at all before it is trusted as a default. A 404/400 on any of the three should fail loud, not silently drop that model from the panel.
- The vendor-diversity design goal (§5.2 invariant 8, "exclude Anthropic, Claude Code is the first opinion") still holds and is satisfied: none of the three named models is Anthropic.

**Phase 1: salvage (no new logic)**
4. `git show c8361ce:scripts/council/scrub.mjs > scripts/council/scrub.mjs`, take verbatim. Keep `scrub()`, `assertNoApiKeyInPayload()`, `SCRUB_RULES`, `INTERNAL_HOST_PATTERNS`.
5. Adapt `buildManifest()` from the same file: replace the `panel`/`chairman` fields with a flat `models: [{slug, family}]`. Keep per-source byte counts, per-source scrub-hit counts, truncated framed-prompt preview, provider policy, cost estimate.
6. Extract from `git show c8361ce:scripts/council/openrouter.mjs` into `scripts/council/client.mjs`: `chat()` (including HTTP-200-with-error-body handling and the empty-content error class), `withRetry()`, `OpenRouterError`, `FatalAuthError`, `RETRYABLE_STATUSES`, `parseRetryAfterMs()`, `resolveApiKey()`, `maskKey()`, `fetchModelCatalog()`, `fetchKeyStatus()`, and the whole `COUNCIL_MOCK` path. Per Phase 0 decision 1, set `API_BASE_URL` default to `process.env.COUNCIL_BASE_URL ?? 'https://direct.shopaikey.com/v1'` (not the OpenRouter default this checklist originally assumed). Keep `fetchModelCatalog()`'s and `fetchKeyStatus()`'s fail-soft behaviour intact: ShopAIKey is not confirmed to expose `/models` or `/key`, so both must degrade to "UNKNOWN" pricing rather than error.
7. Do **not** port `panels.mjs`, `report.mjs`, `SELF_ID_PATTERNS`, `stripSelfId()`, `levenshtein()`, or `nearestMatch()`.

**Phase 2: the dispatcher**
8. Write `scripts/council/dispatch.mjs`: arg parsing (reuse the reverted `parseArgs`/`asBool`/`parseNumericFlag`), `--question-file` + repeatable `--context` reading, scrub pass, manifest build, `--dry-run` early return, `--max-cost` gate, `Promise.allSettled` fan-out, per-model failure isolation, output writing.
9. Write `scripts/council/tiers.mjs`: per Phase 0, the default (and only, for v1) panel is Kimi-K3 / GPT Sol 5.6 / GLM 5.2 with `pricing: null`, not the §8 OpenRouter lists (§8 remains documentation for a possible future OpenRouter-endpoint mode, not the live default). Include a `MODEL_FAMILIES` map (Moonshot AI, OpenAI-compatible-via-ShopAIKey, Zhipu) for jurisdiction disclosure in the manifest. Keep the floating-alias slug guard. Add a comment stating these three slugs are user-supplied and unverified against a live catalog call, with the date this was decided.
10. Write `scripts/council/output.mjs`: Markdown transcript (one `##` section per model; failures as `## <model> - FAILED: <reason>`) + `run.json`. **No HTML generator.**
11. `package.json` scripts only: `council`, `council:dry`, `council:mock` (using existing `cross-env`). **No dependency additions.**

**Phase 3: the commands (v1 scope: `/council-review` only, per Phase 0 decision 3)**
12. `.claude/commands/council-review.md`, §6.1 assembly steps, §7.1 template, `--tier=cheap` default (mapping to the Kimi-K3/GPT Sol 5.6/GLM 5.2 trio, since there is no separate premium tier once pricing is unverified, see Phase 0 model-selection note), and the §3.3.4 consent flow verbatim (including "do not treat your own assessment as approval").
13. `.claude/commands/council-fix.md` and 14. `.claude/commands/council-research.md`: **not built in v1.** §6.2/§6.3/§7.2/§7.3 remain the design for when scope reopens; do not create these command files yet.

**Phase 4: config and docs**
15. `.gitignore`: `council-output/`. Route the `--question-file` temp and the repomix file list to a scratch directory **outside** the repo; if that is not possible, gitignore those paths too, an untracked file in the repo root would contaminate the `git status` / `git diff` that `/council-review` itself reads.
16. `.env.example`: commented `OPENROUTER_API_KEY` / `COUNCIL_BASE_URL` block, reusing the reverted wording (dev-time only; not read by `src/config/environment.ts`; never in `.env.testing`/`.env.staging`/`.env.production`).
17. `CLAUDE.md`: one new section stating (a) never in CI, never in the test suite; (b) the three-way naming distinction from §3.4; (c) the catalog-drift warning; (d) the jurisdiction disclosure; (e) that `scrub.mjs` is deliberately separate from `src/utils/redact.ts`.
18. Do **not** re-add a cross-reference from `.claude/skills/llm-council/SKILL.md` to this tool, that coupling is what made the three confusable.

**Phase 5: verify**
19. Run §11 in order. Do not make a real paid call until checks 1-12 pass.

---

## 11. Validation

**No real API call until every mock-mode check passes.** The reverted implementation's `COUNCIL_MOCK=1` path exists precisely so the pipeline can be validated at zero cost, reuse it.

| # | Check | Command / method | Pass criterion |
|---|---|---|---|
| 1 | No regression in the test suite | `npm run lint` | Exits 0. Also confirms `scripts/` is genuinely outside the typecheck: if it now errors on the new files, the tsconfig was wrongly modified |
| 2 | Zero impact on the framework | `npm run test:simple` (chromium, 1 worker) | Same pass/fail as before the change |
| 3 | No dependency drift | `git diff package-lock.json` | Empty |
| 4 | CI untouched | `grep -r "council" .github/ playwright.config.ts api.config.ts src/` | No matches |
| 5 | Mock pipeline end-to-end | `npm run council:mock -- --question-file=q.txt --context=CLAUDE.md` | 3 canned responses, transcript + run.json written, $0.00 real cost, **zero network requests** |
| 6 | Per-model failure isolation | `COUNCIL_MOCK=1 COUNCIL_MOCK_FAIL=<slug> ...` | Run completes, reports 2 successes + 1 named failure, exit 0 |
| 7 | Fatal auth aborts | Force a 401 in mock | Whole run aborts, no partial spend, clear message, non-zero exit |
| 8 | Scrubbing works | Craft a fixture containing a fake `sk-or-v1-...`, a JWT, an `Authorization: Bearer x`, an email, and a Windows user path; pass as `--context` | All five redacted in the payload; manifest shows 5 named rule hits with counts; **no raw matched values** appear in the manifest or run.json |
| 9 | Key never egresses | Set a distinctive fake key, include that literal string inside a `--context` file | `assertNoApiKeyInPayload()` throws before any request |
| 10 | Consent gate cannot be bypassed | `--dry-run` without `--yes` | Prints manifest, makes zero chat calls, exits 2 |
| 11 | Non-interactive safety | Invoke via the slash command inside Claude Code | Does not hang. Confirms the dry-run then wait then `--yes` handshake works with a non-interactive Bash tool |
| 12 | Question text never shell-interpolated | Ask a question containing a double quote, a command substitution, and a newline | Passed intact via `--question-file`; no shell expansion in the transcript |
| 13 | Cost estimate accuracy | One real run against ShopAIKey; check `--dry-run`'s estimate | Per Phase 0 decision 1, `usage.cost` is not confirmed to exist on this endpoint, so the pass criterion is that the estimate prints "UNKNOWN" (not "$0.00") rather than a numeric ~2x match |
| 14 | Model slugs resolve | One real `--max-tokens=16` smoke call per slug (Kimi-K3, GPT Sol 5.6, GLM 5.2) against `https://direct.shopaikey.com/v1/chat/completions` | All three return 200 with non-empty content. A 404/400 on any slug fails this check and that model must not ship as a default until its correct identifier is confirmed |
| 15 | Context budget respected | `/council-review` on a real 3-file diff, then `npx repomix --token-count-tree` on the pack | Under 40,000 tokens |
| 16 | **Context sufficiency: the real quality gate** | Run `/council-review` on a diff with a *known planted* convention violation in a file the diff imports but does not change | At least one model catches it. If none do, Claude Code's depth-1 resolution missed a needed file, so revisit §4.3 Option B (custom walker) |
| 17 | Output usefulness | Run `/council-review` on 3 real diffs; count findings that are (a) true, (b) actionable, (c) not already obvious to Claude | If under 1 novel true finding per run averaged over 3 runs, the tool is not earning its cost: retune prompts (§7) or escalate tier before adding features |
| 18 | Rollback | `git revert <sha>` on a scratch branch; `npm run lint && npm run test:simple` | Both pass; no residue (grep for council is clean) |

**Check 17 is the one that decides whether this survives.** The prior implementation was reverted after a day. A usefulness metric applied early, before three commands, an HTML report, and 2,000 lines exist, is the main structural defence against a repeat.

---

## 12. Open Questions

1. ~~**Endpoint (blocking).**~~ **Resolved 2026-08-02: `https://direct.shopaikey.com/v1`.** See §10 Phase 0 decision 1. §8's OpenRouter tier table is now reference material for a possible future mode, not the live default; `tiers.mjs` ships the user-named Kimi-K3/GPT Sol 5.6/GLM 5.2 trio with unverified, `null` pricing instead.
2. ~~**Jurisdiction.**~~ **Resolved 2026-08-02: acceptable.** China-hosted inference (Kimi-K3 is Moonshot AI, GLM 5.2 is Zhipu) is in scope for the default panel.
3. **Nanobot specifics, unverifiable from this repo.** Still open, though now largely moot: the endpoint decision above makes the base URL explicit (`https://direct.shopaikey.com/v1`) regardless of whatever Nanobot-side configuration produced it. Nothing in the working tree or git history documents the Nanobot agent's internals, and nothing here depends on that being documented.
4. ~~**Scope for v1.**~~ **Resolved 2026-08-02: `/council-review` only.** See §10 Phase 0 decision 3.
5. **Should the transcript be read back into the conversation automatically?** Still open. Doing so lets Claude act on findings immediately, but also lets a wrong external suggestion enter Claude's context unchallenged. Leaning: yes, but the command must instruct Claude to present findings *as external opinions to evaluate*, never as instructions to execute.
6. **Vault-note freshness.** Still open, and now out of scope for v1 since it only matters for `/council-fix`/`/council-research`, which are deferred. Revisit if/when scope reopens.

---

## 13. References

| Source | Type | Reference | Retrieved |
|---|---|---|---|
| OpenRouter model catalog | Official API | `https://openrouter.ai/api/v1/models`: 336 models, pricing + `context_length` | 2026-08-01 |
| OpenRouter API reference | Official docs | `https://openrouter.ai/docs/api-reference/overview` | 2026-08-01 |
| OpenRouter rate limits | Official docs | `https://openrouter.ai/docs/api-reference/limits` | 2026-08-01 |
| OpenRouter privacy & logging | Official docs | `https://openrouter.ai/docs/features/privacy-and-logging` | 2026-08-01 |
| repomix docs | Context7 MCP | `/yamadashy/repomix` (info + code modes): confirms glob/`--stdin` only, no import traversal, no tsconfig alias resolution | 2026-08-01 |
| repomix CLI options | Official docs | `https://repomix.com/guide/command-line-options` | 2026-08-01 |
| repomix package metadata | npm registry | `https://registry.npmjs.org/repomix/latest`: v1.17.0, `engines.node >=22`, 26 deps incl. `@secretlint`, `gpt-tokenizer`, `web-tree-sitter` | 2026-08-01 |
| Reverted council implementation | Git history | `git show c8361ce93e7f399cff9ed9e017c5574377618367` (2,050 lines, 11 files); reverted by `257dee5` | working tree |
| Repo conventions | In-repo | `CLAUDE.md`, `tsconfig.json`, `package.json`, `.mcp.json`, `.claude/settings.json`, `.claude/commands/*.md`, `.claude/skills/*/SKILL.md`, `memory-vault/20-memory/**` | working tree |
| Research brief | In-repo | `docs/technical-research/ai-council-research-brief.md` | working tree |

**Corrections applied to the brief:** "GRA-vault (Obsidian)" is `memory-vault/20-memory/` (§3.2). The skills `refine-ticket` / `ai-test-data` / `pert-est` do not exist in this repo; the real precedent is the `/sync-vault` to `scripts/sync-vault-to-lightrag.mjs` pair (§3.1). "OpenRouter-based prior attempt", the code pointed at `https://direct.shopaikey.com/v1` (§3.3.1). "repomix with a scoped `--include`", repomix cannot follow imports or resolve aliases; Claude Code must be the resolver (§4.3).

**This is research only. No code was written and no files were modified other than this report. Per WORKFLOW-10, implementation requires explicit user approval before `technical-implementation-agent` is dispatched.**
