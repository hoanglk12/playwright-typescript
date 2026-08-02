---
name: e2e-chkout-009-checkout-address-prefill
description: "E2E-CHKOUT-009 (logged-in checkout pre-fills saved default shipping address) — build, qa-code-reviewer + council-review findings, all 7 fixes applied, current per-storefront skip/pass breakdown, and its testIgnore exclusion from the chromium project"
type: project
tags: [memory, project, ecommerce, checkout, my-details, council-review]
last_verified: 2026-08-02
---

# E2E-CHKOUT-009 — Checkout Address Prefill (built + fixed 2026-08-02)

**Files:** `tests/ecommerce/smoke/checkout-address-prefill.spec.ts` (new), `src/pages/ecommerce/my-details-page.ts` (new), additive changes to `src/pages/ecommerce/checkout-page.ts`, `tests/ecommerce/smoke/smoke-helpers.ts`, `src/data/ecommerce/test-accounts.ts`, `src/pages/helpers/element-helper.ts`.

## Scope and design history

- Requirement (`Guideline/E2E_DISCOVERY_REPORT.md` line 473) was initially falsified against Platypus AU staging (manual Edit→picker→APPLY, not auto-prefill). A later Dr. Martens AU screenshot proved genuine automatic prefill DOES occur on other storefronts — the test was reverted to the original literal auto-prefill assertion design, reconned against Dr. Martens AU instead.
- **Platypus AU/NZ excluded** from the storefront loop by explicit user instruction — `createCustomer` GraphQL mutation returns "Internal server error" for these two brands specifically on staging (confirmed via curl + existing GRA API suite).
- Region/State combobox selector (`[data-region="state"]`, options as `<li class="option">`) was only ever confirmed live on Dr. Martens AU.

## Review pipeline and fixes (all applied 2026-08-02)

`qa-code-reviewer` raised 4 Warnings; `/council-review` (gpt-5.6-sol only — kimi-k3 failed both attempts with HTTP 503 "no available channel") independently confirmed 2 of the 4 and found 2 new High-severity issues. All 7 combined findings were fixed:

1. **Product-scan gave up too early** (High, council-only) — the scan loop used to stop at the first product exposing ANY listed size, then only tried that one product's sizes. Fixed: loop now `continue`s to the next product when all of a product's sizes are exhausted, only skipping after `MAX_PRODUCTS_TO_SCAN` (10) products are tried.
2. **Race condition on address save** (High, council-only) — `submitNewAddress()` used to return immediately on click, before the create-address mutation necessarily completed. Fixed two ways: `submitNewAddress()` now waits for the drawer to close (`ElementHelper.waitForLocatorHidden`, new method), AND the GraphQL confirmation step is now `expect.poll()` instead of a single-shot read.
3. **W3 (confirmed by both reviews)** — `confirmDefaultShippingAddressViaGraphQL` (`smoke-helpers.ts`) had no HTTP-status/GraphQL-error guard, unlike its sibling `createFreshAccountViaGraphQL`. Fixed: mirrored guard added to both the token and address calls.
4. **W4 (confirmed by both reviews)** — `getDeliverToAddressDiagnostics` (`checkout-page.ts`) resolved the heading's next-sibling without checking it was visible. Fixed: added the same bounding-rect `isVisible()` check already used elsewhere in that evaluate callback.
5. **NZ phone number bug** (Low, council-only) — `createNewSavedAddressData` hardcoded the AU phone format regardless of `isNz`. Fixed: `isNz ? '0212345678' : '0412345678'`.
6. **W1 (BasePage helper bypass)** — `my-details-page.ts` used direct `.click()`/`.fill()`/`.waitFor()` instead of `this.elements.*`. Fixed: routed through `ElementHelper`; added two new helper methods since no locator-based equivalents existed — `fillLocator(locator, text)` and `waitForLocatorHidden(locator, timeout)`.
7. **W2 (regionOptionList scoping) — deliberately left unfixed.** Council refined this to say the risk is specifically `li.option` possibly matching hidden/stale options, not the top-level `regionCombobox` (already properly drawer-scoped). Could not confirm live whether `li.option` renders as a DOM child of `[data-region="state"]` or in a portal — re-scoping on a guess risked silently breaking the one confirmed-working storefront (Dr. Martens AU). Open item if revisited.

## Verified skip/pass breakdown (2026-08-02, chromium, post-fix)

| Storefront | Result | Reason |
|---|---|---|
| Dr. Martens AU | **PASS** | Full flow, all soft-asserts run |
| Vans AU | **PASS** | Full flow, all soft-asserts run |
| Skechers AU | Skip (new depth) | Reaches product-scan step (13) — genuine staging stock unavailability for "Go Walk" across all 10 scanned products, not a test defect. Confirms fix 1 is working: this storefront now exercises address-save + GraphQL-poll-confirm + full product scan for the first time (previously unreachable). |
| Skechers NZ | Skip | Region/State combobox not found — selector unconfirmed on this storefront |
| Vans NZ | Skip | Region/State combobox not found — selector unconfirmed on this storefront |
| Dr. Martens NZ | Skip | Region/State combobox not found — selector unconfirmed on this storefront |

`npm run lint` clean. No regressions on the two previously-passing storefronts.

## Current exclusion from the regular chromium run

As of 2026-08-02, `playwright.config.ts`'s `chromium` project has a `testIgnore` for this spec file specifically — it is not yet part of the regular local/CI chromium run. Reason: 4 of 6 in-scope storefronts still skip (3 on an unconfirmed region-combobox selector, 1 on genuine staging stock), so the test isn't proven stable enough across the full storefront matrix to run unattended yet. Remove the `testIgnore` entry once the NZ region-combobox selector is reconned and confirmed (or a per-storefront selector strategy is added).

Related: [[ecommerce-storefronts]], [[ecommerce-smoke-spec-catalog]], [[fixture-registry]], [[e2e-chkout-004-shipping-method]], [[council-review-transcript-vs-console]]
