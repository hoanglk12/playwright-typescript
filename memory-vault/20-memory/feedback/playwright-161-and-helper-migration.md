---
name: playwright-161-and-helper-migration
description: Playwright 1.61 isVisible({timeout}) deprecation fix + dom.count / waitForUrlPredicate migration patterns
type: feedback
tags: [memory, feedback]
last_verified: 2026-06-22
---

## Playwright 1.61 — `isVisible({ timeout })` is silently ignored

In Playwright ≥1.61, the `timeout` option on `locator.isVisible({ timeout })` is silently dropped — `isVisible()` becomes a synchronous check immediately. Animated popups and overlays that haven't rendered yet will be missed.

**Fix pattern** (drop-in replacement):
```ts
// BEFORE (broken in 1.61)
if (await closeBtn.isVisible({ timeout: TIMEOUTS.ELEMENT_CLICKABLE }).catch(() => false)) { ... }

// AFTER
const visible = await closeBtn
  .waitFor({ state: 'visible', timeout: TIMEOUTS.ELEMENT_CLICKABLE })
  .then(() => true)
  .catch(() => false);
if (visible) { ... }
```

**Inside polling loops** (`waitForCustomCondition` callbacks): drop the timeout entirely — `isVisible()` without options is still valid; the outer polling loop handles retry timing.

**Files patched (2026-06-22):** `element-helper.ts` (dropped ignored option), `nav-page.ts` `dismissBloomreachPopup`, `pdp-page.ts` `dismissAcquisitionPopup`, `plp-page.ts` `dismissOverlays` (4 call sites).

**Why:** Silent deprecation — tsc and lint produce zero errors; only fails at runtime on animated popups.

**How to apply:** Any `isVisible({ timeout: T })` in page objects or helpers is broken and must be replaced.

---

## `this.dom.count()` replaces `page.evaluate(querySelectorAll.length)`

`DomScanHelper.count(selector)` does a DOM count and returns 0 on error (never throws). It is the correct replacement for:

```ts
// BEFORE — common pattern in ecommerce page objects
const selector = this.someSelector;
await this.waits.waitForCustomCondition(
  async () => {
    try {
      return await this.page.evaluate(
        (sel) => document.querySelectorAll(sel).length > 0,
        selector,
      );
    } catch {
      return false;
    }
  },
  { timeout: TIMEOUTS.PAGE_LOAD_SLOW, interval: TIMEOUTS.POLL_INTERVAL_FAST }
);

// AFTER — the local `selector` binding and try/catch are both unnecessary
await this.waits.waitForCustomCondition(
  async () => (await this.dom.count(this.someSelector)) > 0,
  { timeout: TIMEOUTS.PAGE_LOAD_SLOW, interval: TIMEOUTS.POLL_INTERVAL_FAST }
);
```

Also works for direct count returns:
```ts
// BEFORE
return this.page.evaluate((sel) => document.querySelectorAll(sel).length, this.someSelector);
// AFTER
return this.dom.count(this.someSelector);
```

**Applied to (2026-06-22):** `search-page.ts` `getResultCount` + `waitForSearchResults`, `plp-page.ts` `getProductCount` + `waitForProductGrid`, `nav-page.ts` `waitForNavHydration`.

**Limitation:** `DomScanHelper` only does selector-based queries — no recursive DOM tree-walk / regex leaf scan. The price-leaf and size/gender proximity walks in pdp-page and plp-page are **not** candidates.

---

## `this.waits.waitForUrlPredicate()` replaces `page.waitForURL(fn)`

`WaitHelper.waitForUrlPredicate(predicate, timeout?)` wraps `page.waitForURL((url) => predicate(url.toString()), { timeout })`. The predicate receives a full URL string.

```ts
// BEFORE — with stale comment
// WHY: no WaitHelper equivalent for function-predicate URL matching
await this.page.waitForURL((url) => url.toString() !== previousUrl, {
  timeout: TIMEOUTS.PAGE_LOAD_SLOW,
});

// AFTER — delete the stale WHY comment
await this.waits.waitForUrlPredicate(
  (url) => url !== previousUrl,
  TIMEOUTS.PAGE_LOAD_SLOW,
);
```

**Applied to (2026-06-22):** `pdp-page.ts` `waitForVariantNavigation` (stale comment deleted with the change).

**How to apply:** Any `// WHY: no WaitHelper equivalent for function-predicate URL matching` comment in page objects is now stale — the helper exists.
