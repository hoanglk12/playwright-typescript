---
name: loop-engineering-research
description: "Loop engineering research (2026-07-28); Increment A implemented and reviewed, Increment B still awaiting approval"
type: project
tags: [memory, project]
last_verified: 2026-07-28
---

Technical research report on "loop engineering" (bounded iteration) applied to this framework, produced 2026-07-28 and published as a bilingual EN/VI HTML report at `docs/technical-research/loop-engineering.research.html`, matching the design system of sibling reports in that folder.

Three loop families were found and verified against actual source:
- **Agentic iteration** — `qa-orchestrator.md` correctly caps loop-backs at one iteration with a stop action, but `playwright-test-healer.md:239` and `technical-debt-fixer.md:335` looped with no cap or convergence check. This is Increment A, implemented 2026-07-28 (see below).
- **Test-execution retry** — `api.config.ts:46` hardcodes retries, ignoring the already-imported `env.retries` (dead knob). Conflicting defaults also exist between `src/api/config/environment.ts:41` (2) and `src/config/environment.ts:106` (3). Out of scope for the flaky-test doc, but flagged as a one-line cleanup (Increment B′). Not implemented.
- **Feedback/monitoring** — the monocart trend cache key is static per branch (`playwright-with-slack.yml:152`, `api-restful-tests-with-slack.yml:58`), and `actions/cache` skips the save on an exact key match, so the trend chart advances once per branch then freezes permanently. Recommended: Increment B, CI-only fix. Not implemented, still awaiting approval.

## Increment A — implemented 2026-07-28

Added a shared "loop contract" (bound, convergence check, stop action, carried state) to `CLAUDE.md` §4, rewrote the open-ended iteration steps in `playwright-test-healer.md` and `technical-debt-fixer.md` to that contract, and added one cross-reference line in `qa-orchestrator.md`. Reviewed by `qa-code-reviewer`: APPROVED WITH COMMENTS, two warnings fixed, one warning rejected after verification (the "twice in a row" convergence trigger in `technical-debt-fixer.md` can fire before the cap is exhausted, so it was not inert as first flagged).

**Durable correction surfaced during review:** `qa-orchestrator.md` does not dispatch `technical-debt-fixer` — that agent is absent from its Sub-Agent Roster. An earlier draft of the implementation wrongly claimed the orchestrator's one-iteration cap wraps both agents; only `playwright-test-healer` is actually dispatched by it. Any future reference to what `qa-orchestrator` dispatches should check the roster directly rather than assume.

**User decisions confirmed 2026-07-28:**
- `advisor` added to both agents' `tools:` frontmatter after an initial "don't add it" was reversed once the user weighed the tradeoff: the fixed cost of one extra round trip per stuck loop versus the unbounded, hidden cost of a missed root cause. Both stop actions now call `advisor()` unconditionally rather than the earlier "if available in this session's tool list" hedge. Rationale: this mirrors CLAUDE.md §5's existing rule for the main session (call advisor at named stuck points) applied one layer down to the two agents that actually run bounded retry loops, not a new judgment call.
- Cap granularity is per-failing-test, not per-spec-file (a per-spec cap of 3 would exhaust almost immediately on a spec with several failures).

**Why:** requested by the user as a `/research` topic, then exported to HTML per their follow-up request, with a dedicated bilingual "Benefits" section (§06) added on request and the prose passed through the `/humanizer` skill (em dashes removed except inside two direct source quotations, which are exempt). Increment A was then approved and implemented in the same session, followed by the advisor-access reversal above.

**How to apply:** Increment B (monocart trend cache fix) is CI-only and still requires its own approval. Per the report, it should not land before [[flaky-test-detection-research]]'s own approval process resolves, since that document's Option D separately proposes touching the same cache-key lines (`playwright-with-slack.yml:152`) — no dedicated vault note exists yet for that document, this link is a placeholder for one. Option C (scheduled CI loop) is deferred until B is verified working. Any further implementation routes through `qa-orchestrator` (WORKFLOW-10), per [[project_context_engineering]].
