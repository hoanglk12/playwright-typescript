---
name: feedback-preferences
description: "Confirmed working patterns, corrections given, stylistic preferences"
type: feedback
tags: [memory, feedback]
source_session: da3c13e7-e43f-48e9-8c8e-a045c7cfd24c
last_verified: 2026-06-14
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

**When debugging a click-not-registering failure: read error-context.md FIRST, not diagnostic scripts.**

For any "element clicked but no effect" test failure, the test already produces a page snapshot in `test-results/.../error-context.md`. This snapshot reveals both the visible error message (e.g. "Size was not chosen") and the actual state of the DOM. Reading it first eliminates the need for most diagnostic scripts.

**Why:** In the DM NZ CART-005-008 session, multiple diagnostic scripts were written before the error-context.md page snapshot was read. The snapshot would have confirmed the root cause (ATC button always-active, size not registered) in the very first run. The investigation took multiple sessions and advisor consultations that were avoidable.

**How to apply:**
1. Run failing test once.
2. Read `test-results/.../error-context.md` — page snapshot shows what was visible at failure time.
3. Read the screenshot if a visual check is needed.
4. Only write a diagnostic script if the above doesn't reveal the cause (rare).
5. When simulating a failing flow in a diagnostic script, always match the **actual test viewport** from `playwright.config.ts` — never assume the Playwright default (1280×720) is what the test uses.

---

**For React SPA click-coverage bugs: `dispatchEvent` over `force:true` when `elementFromPoint` shows another element.**

`force:true` in Playwright dispatches `page.mouse.click(cx, cy)` at the element's centre coordinates. If another element (e.g. a nav megamenu container with `z-index:100, pointer-events:auto`) sits at those coordinates, the click goes to it — not the target. Pressing Escape to close the dropdown may not help if the container element stays in the DOM at the same position.

**Fix pattern (confirmed on DM NZ):**
```ts
const isTopmost = await btn.evaluate((el) => {
  const r = el.getBoundingClientRect();
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return hit === el || el.contains(hit);
}).catch(() => true);

if (!isTopmost) {
  await btn.evaluate((el: HTMLElement) => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true, view: window }));
  });
} else {
  await btn.click({ force: true });
}
```

`dispatchEvent(new MouseEvent('click', {bubbles:true, composed:true}))` fires directly on the DOM node and bubbles to React's root listener — bypasses coordinate-based interception entirely. `el.click()` (native method) does NOT reliably reach React's delegation. `dispatchEvent` does.

---

**`softExpect` (bare) does NOT log internally — `logger.verify()` adjacent to it is correct.** Only the `softAssert.*` fixture (SoftAssertHelper) logs internally with `🔵 [SOFT]`. The qa-code-reviewer has flagged `logger.verify()` before `softExpect()` as a "duplicate log" warning — this is a false positive for Pattern A (bare `softExpect`).

**Why:** `softExpect` is imported as a drop-in for `expect` with no logger integration (Pattern A). `softAssert` is the fixture (Pattern B) that calls `logger.verify()` internally. The root CLAUDE.md correctly scopes the "no duplicate logging" rule to `softAssert.*` only.

**How to apply:** In API test files using `softExpect`, always call `logger.verify()` before the assertion. Do NOT remove logger.verify calls because the qa-code-reviewer flags them — check whether the code uses `softExpect` (bare) or `softAssert.*` (fixture) first.

---

**When writing a new test, ask the user for one example from an existing spec in the same area.** A single line like "follow the pattern in `tests/ecommerce/cart-smoke.spec.ts`" eliminates all pattern-discovery file reads. Without it, 3–4 files are read just to establish boilerplate.

**Why:** The fixture names, import rules, logger pattern, and assertion style are already in memory. The only thing not known without reading is the local structural pattern of that specific spec suite. One existing spec example provides it instantly.

**How to apply:** If the user hasn't referenced an existing spec and the task is writing a new test, ask: "Which existing spec in this area should I follow as a pattern?" before opening any files.
