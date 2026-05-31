---
name: Feedback & Preferences
description: Confirmed working patterns, corrections given, stylistic preferences
type: feedback
---
**Keep responses short.** User gives terse commands and expects terse execution — no narration, no step summaries, no "Here's what I did" paragraphs at the end.

**Why:** User said "implement 1,2,3" with no additional context — expected Claude to infer from prior turn and execute. This is the consistent interaction style.

**How to apply:** Lead with action, not explanation. One sentence of context max before tool calls. End-of-turn summary: one line, what changed. Nothing else.

---

**No trailing summaries after implementation.** After writing code or making changes, do not produce a "Summary of changes" section listing every file touched.

**Why:** User can read the diff. Redundant summaries add noise.

**How to apply:** Skip the bullet-point recap. If clarification is needed about what was done, one sentence is enough.

---

**PLA API `beforeAll` must always sign in fresh and create a fresh cart.** Never guard with `if (!token)` or reuse `getCartId()` from shared-state.

**Why:** `pla-authentication.spec.ts` generates new tokens for the same account (TC_01/TC_02), which invalidates any previously issued token. A stale-but-non-empty `customerToken` bypasses the `if (!token)` guard, causing `graphql-authorization` errors in CI. Cart ownership is similarly tied to the session that created it — reusing a shared-state cartId with a different session token causes `"cannot perform operations on cart"`.

**How to apply:** In any PLA spec file that needs auth or a cart, write `beforeAll` to unconditionally call `generateCustomerToken` → create cart. See `pla-my-details.spec.ts` and `pla-support-features.spec.ts` for the reference pattern.

---

**`.claude/plans/` is the drop zone for spec documents.** The `user-prompt-submit.js` hook auto-routes prompts that reference files in this directory to `qa-orchestrator`. Drop acceptance criteria, user stories, or test plan docs here.

**How to apply:** When user mentions a spec or requirement document, check `.claude/plans/` first before asking for a path.

---

**`softExpect` (bare) does NOT log internally — `logger.verify()` adjacent to it is correct.** Only the `softAssert.*` fixture (SoftAssertHelper) logs internally with `🔵 [SOFT]`. The qa-code-reviewer has flagged `logger.verify()` before `softExpect()` as a "duplicate log" warning — this is a false positive for Pattern A (bare `softExpect`).

**Why:** `softExpect` is imported as a drop-in for `expect` with no logger integration (Pattern A). `softAssert` is the fixture (Pattern B) that calls `logger.verify()` internally. The root CLAUDE.md correctly scopes the "no duplicate logging" rule to `softAssert.*` only.

**How to apply:** In API test files using `softExpect`, always call `logger.verify()` before the assertion. Do NOT remove logger.verify calls because the qa-code-reviewer flags them — check whether the code uses `softExpect` (bare) or `softAssert.*` (fixture) first.
