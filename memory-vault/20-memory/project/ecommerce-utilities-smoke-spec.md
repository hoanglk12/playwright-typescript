---
name: ecommerce-utilities-smoke-spec
description: "Test catalog for utilities-smoke.spec.ts — E2E-UTIL-001 (Track Order, footer link) and E2E-UTIL-005 (Help/Support, header figure-trigger + flyout)"
type: project
tags: [memory, project]
last_verified: 2026-07-02
---

## Overview

Path: `tests/ecommerce/smoke/utilities-smoke.spec.ts`

**Suite tag:** `@ecommerce @smoke @utilities`

Shares the standard ecommerce smoke pattern: `test.slow()`, `storefronts` loop from `@data/ecommerce/storefronts` (8 sites), `@config/base-test` import, `createTestLogger` + `softAssert` fixture.

Related: [[fixture-registry]], [[ecommerce-storefronts]], [[ecommerce-header-help-gotcha]], [[ecommerce-smoke-spec-catalog]]

---

## Test catalog

| Test ID | Storefronts | Fixtures | What it asserts |
|---|---|---|---|
| E2E-UTIL-001 | All 8 storefronts | `ecommerceTrackOrderPage`, `softAssert` | Footer Track Order link present → clicked → form (order number input, email input, submit button) present |
| E2E-UTIL-005 | All 8 storefronts | `ecommerceHelpSupportPage`, `softAssert` | Header Help trigger present → clicked → flyout link clicked → navigated away from homepage; soft-asserts landed on a help/support-pattern URL |

## E2E-UTIL-001 flow

1. `navigate(site.url)` — goes to homepage, scrolls to bottom (footer is intersection-observer-gated, not in initial DOM)
2. `isTrackOrderLinkPresent()` → `test.skip()` if false
3. `clickTrackOrderLink()`
4. Hard-assert `assertFormPresent(site.name)` — at least one of the 3 form elements visible
5. Soft-assert each of order-number input, email input, submit button individually visible

## E2E-UTIL-005 flow

1. `navigate(site.url)` — goes to homepage, does **not** scroll (Help trigger lives in the header, not the footer)
2. `isHelpSupportLinkPresent()` → `test.skip()` if false (in practice: never observed false across the 2 brands verified live + 8/8 passing on all brands post-fix)
3. `clickHelpSupportLink()` — clicks the header `<figure>` trigger, waits for the `role="complementary"` flyout, clicks the Help/FAQs/Support link scoped inside it
4. Hard-assert `assertNavigatedToHelpSupportPage(site.name)` — URL changed from homepage (destination is confirmed external, so this is unfakeable)
5. Soft-assert `isOnHelpDestination()` — URL matches `/help\.|\/hc\/|support/i`

**Do not confuse the header Help trigger with a direct link** — see [[ecommerce-header-help-gotcha]] for the full root-cause writeup of why the first implementation produced a vacuous 8/8 skip.

## Verified state (2026-07-02)

16/16 tests pass on Chromium (`npx playwright test tests/ecommerce/smoke/utilities-smoke.spec.ts --project=chromium`). `qa-code-reviewer`: APPROVED WITH COMMENTS on first pass (flyout-link scoping WARNING), re-verified clean after the scoping fix — no outstanding review gate.
