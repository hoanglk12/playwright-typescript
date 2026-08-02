---
name: council-review-transcript-vs-console
description: "/council-review console/notification summary can report a model as failed (timeout) even when its transcript file contains a complete, substantive response — always read the transcript before concluding a model failed"
type: feedback
tags: [memory, feedback, council-review, tooling]
last_verified: 2026-08-02
---

# council-review: trust the transcript file, not the console summary

**Rule:** After any `/council-review` run, before reporting a model as "failed", open the actual `council-review-transcript-*.md` file and check for that model's section. Do not rely solely on the dispatcher's console/task-notification summary.

**Why:** During the E2E-CHKOUT-009 review (2026-08-02, see [[e2e-chkout-009-checkout-address-prefill]]), a retry run's console-level report characterized gpt-5.6-sol as failed via "Network error... aborted due to timeout" — identical to the first failed attempt. Based on that summary, the user chose "Skip external review" (via AskUserQuestion). Only when re-reading the transcript file itself for a follow-up comparison request did it become clear that gpt-5.6-sol's response had actually completed and was fully captured in the transcript with substantive findings — only kimi-k3 had genuinely failed (HTTP 503) on that run. The console/notification layer and the transcript-write layer can diverge; a late-arriving SSE completion can land in the transcript after the console-level timeout is already reported.

**How to apply:**
- After every council-review run (dry or live), read the transcript file directly (`Read` tool) before summarizing results to the user — do not just relay the dispatcher's stdout.
- If a user has already acted on a "both models failed" summary (e.g. chosen to skip), and the transcript later shows otherwise, surface the correction explicitly — don't silently use the recovered data without flagging that the earlier report was wrong.
- This is a tooling reliability gap in `scripts/council/dispatch.mjs`, not a one-off fluke — treat it as a standing caveat for every future council-review invocation, not just this one.

Related: [[e2e-chkout-009-checkout-address-prefill]]
