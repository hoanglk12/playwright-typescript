---
name: ecommerce-smoke-spec-catalog
description: "Full catalog of tests in localization-smoke.spec.ts and error-handling-smoke.spec.ts — scope, fixtures, skip conditions, and known behaviours"
type: project
tags: [memory, project]
last_verified: 2026-06-30
---

## Overview

Both specs live under `tests/ecommerce/smoke/` and share:
- `test.slow()` — triples timeout for SPA staging hydration
- `storefronts` loop from `@data/ecommerce/storefronts` (8 sites)
- `smoke-helpers.ts` for shared navigation and ATC utilities
- `@config/base-test` import (UI tests, not API)
- Tags: `@ecommerce @smoke` + suite-specific tag

Related: [[fixture-registry]], [[ecommerce-storefronts]], [[ecommerce-pdp-page-gotchas]]

---

## localization-smoke.spec.ts

**Suite tag:** `@ecommerce @smoke @localization`

Path: `tests/ecommerce/smoke/localization-smoke.spec.ts`

Data module: `src/data/ecommerce/localization-data.ts` → `LocalizationExpectations` (price regex patterns)

### Test catalog

| Test ID | Storefronts | Fixtures | What it asserts |
|---|---|---|---|
| E2E-LOC-001 | Platypus AU, Skechers AU | `ecommerceNavPage`, `ecommercePLPPage` | First price on MENS PLP matches `$X.XX` AUD regex |
| E2E-LOC-002 | Platypus NZ, Skechers NZ | `ecommerceNavPage`, `ecommercePLPPage` | First price on PLP matches `$X.XX` NZD regex |
| E2E-LOC-003 | All 8 storefronts | `ecommerceHomePage` | AU sites: Qantas Points visible; NZ sites: Qantas Points absent (driven by `site.hasQantasPoints`) |
| E2E-LOC-004 | Skechers AU, Skechers NZ | `ecommerceNavPage` | WOMEN nav visible (hydration proof); CLOTHING nav present/absent matches `site.navLinks` config |
| E2E-LOC-007 | All 8 storefronts | `ecommerceHomePage` | Brand name visible in page body; loyalty program name visible (skips if `site.loyaltyProgramName` is falsy) |

### Site-scoping constants

```ts
const LOC_001_SITES = ['Platypus AU', 'Skechers AU'];          // E2E-LOC-001
const LOC_002_SITES = ['Platypus NZ', 'Skechers NZ'];          // E2E-LOC-002
const LOC_004_SITES = ['Skechers AU', 'Skechers NZ'];          // E2E-LOC-004
// E2E-LOC-003, E2E-LOC-007 loop all storefronts
```

### Nav-label selection

LOC-001 and LOC-002 use inline `preferMens` logic (not `shouldPreferMens()` from smoke-helpers):
```ts
const preferMens = site.name.toLowerCase().includes('skechers');
```
Skechers sites prefer MENS nav to land on footwear PLP (WOMENS leads to non-footwear apparel).
Platypus NZ has no `womensNavLabel` — `getPreferredNavLabel` falls back to `mensNavLabel`.

### Skip conditions

- `navLabel` is null → `test.skip()` with message

### Key assertions

- LOC-001/002: `expect(priceText).toMatch(pattern)` — hard assertion, price regex
- LOC-003: `assertQantasPointsVisible(site.name)` / `assertQantasPointsAbsent(site.name)` — page object wraps visibility check
- LOC-004: Step 3 hard-asserts WOMEN nav visible (guards Step 4); Step 4 hard-asserts CLOTHING visibility equals `shouldHaveClothing`
- LOC-007: brand name via `assertBrandNameVisible(site.brandName, site.name)`; loyalty name via `assertLoyaltyProgramVisible(site.loyaltyProgramName, site.name)` (skipped if falsy)

---

## error-handling-smoke.spec.ts

**Suite tag:** `@ecommerce @smoke @error-handling`

Path: `tests/ecommerce/smoke/error-handling-smoke.spec.ts`

### Test catalog

| Test ID | Storefronts | Fixtures | What it asserts |
|---|---|---|---|
| E2E-ERR-001 | All 8 storefronts | `ecommerceErrorPage` | 404 URL shows brand error UI + "Back to Home" button visible |
| E2E-ERR-003 | All 8 storefronts | `ecommerceNavPage`, `ecommercePLPPage`, `ecommercePDPPage` | ATC without size selected shows validation message; cart count unchanged (soft) |
| E2E-ERR-006 | All 8 storefronts | `ecommerceNavPage`, `ecommercePLPPage`, `ecommercePDPPage`, `ecommerceCartOverlayPage`, `ecommerceCheckoutPage` | Submitting blank checkout step shows required-field validation |

### E2E-ERR-001 flow

1. `navigateToNotFound(site.url)` — appends `/this-page-does-not-exist` path
2. `assertBackToHomeVisible()` — waits for Back to Home CTA
3. `assertBrandErrorUiVisible(site.brandName, site.name)` — brand text in error page body
No skip conditions.

### E2E-ERR-003 flow

1. Determine nav label via `shouldPreferMens()` + `getPreferredNavLabel()`
2. Navigate to PLP via `navigateToPlp()`
3. `findProductWithAvailableSizes()` → skip if empty
4. `ensureNoOverlay()` — dismisses any Bloomreach or cookie overlay
5. Read `initialCartCount`
6. `addToCart()` WITHOUT selecting a size
7. Hard-assert `hasSizeValidationMessage()` = true
8. Soft-assert cart count unchanged: `softExpect(getMiniCartCount()).toBe(initialCartCount)`

**Soft assertion note:** Step 8 uses `softExpect` (not `softAssert`). No logger.verify() before it (compliant — softExpect doesn't log internally).

### E2E-ERR-006 flow (12-step guest checkout gate)

1. Determine nav label via `shouldPreferMens()` + `getPreferredNavLabel()`
2. `navigateToPlp()`
3. `findProductWithAvailableSizes()` → skip if empty
4. `ensureNoOverlay()`
5. `selectFirstPurchasableSize()` (tries up to 3 sizes, checks `isAddToCartEnabled()`) → skip if null
6. `logger.action('Add to Cart', size)` → read `initialCartCount` → `addToCart()`
7. `waitForMiniCartCountIncrement(initialCartCount)` — best-effort (`.catch()`); silent failure cascades to Step 10
8. `ensureCartOverlayOpen()` — opens mini-cart if not already visible
9. `clickCheckoutCtaFromOverlay()` — `page.evaluate()` finds checkout CTA button in overlay panels
10. `waitForCheckoutLoad()` — polls for auth modal OR `/checkout` URL for up to `PAGE_LOAD` ms
11. Hard-assert `isOnCheckoutPage()` = true — guards Steps 12+
12. `submitCurrentStep()` — `page.evaluate()` clicks "Continue as guest" button (Pass 1) or generic submit (Pass 2)
13. Hard-assert `hasRequiredFieldValidation()` = true

### E2E-ERR-006 critical behaviour notes

**Magento PWA guest checkout:** Clicking CHECKOUT from the mini-cart overlay does NOT navigate to `/checkout`. Instead, it opens an auth modal on the same PDP page (URL stays unchanged). `isOnCheckoutPage()` detects EITHER `/checkout` URL OR "CONTINUE AS GUEST" button visible — this dual detection is intentional.

**React event delegation:** `submitCurrentStep()` uses `page.evaluate()` → `btn.click()` for the "Continue as guest" button. `locator.click({ force: true })` was confirmed to bypass React's synthetic event delegation on Skechers NZ and Dr. Martens NZ, leaving the validation container empty. The evaluate-click approach is required for validation to fire.

**`waitForMiniCartCountIncrement` best-effort risk:** If ATC fails silently (staging server drop, session reset), the test continues to Step 10 and fails with misleading "expected checkout auth modal" message instead of "cart count did not increment". Skechers AU and Dr. Martens AU exhibit this under 6-worker parallel load — both pass in isolation.

### Skip conditions (E2E-ERR-003 and E2E-ERR-006)

1. `navLabel` is null → skip
2. `availableSizes.length === 0` after `findProductWithAvailableSizes()` → skip (PLP discovery flake under staging load also triggers this)
3. E2E-ERR-006 only: `targetSize === null` after `selectFirstPurchasableSize()` → skip

### smoke-helpers.ts utilities used

| Helper | Used by |
|---|---|
| `shouldPreferMens(site)` | ERR-003, ERR-006 |
| `getPreferredNavLabel(site, preferMens)` | LOC-001, LOC-002, ERR-003, ERR-006 |
| `navigateToPlp(navPage, plpPage, site, navLabel)` | LOC-001, LOC-002, ERR-003, ERR-006 |
| `findProductWithAvailableSizes(plpPage, pdpPage)` | ERR-003, ERR-006 |
| `selectFirstPurchasableSize(pdpPage, sizes)` | ERR-006 |
| `ensureCartOverlayOpen(cartOverlayPage)` | ERR-006 |

---

## Staging load flakiness — known sites

Under 6-worker parallel runs (all 8 tests simultaneously), the following AU sites are environment-sensitive:

| Site | Failure mode | Passes in isolation |
|---|---|---|
| Skechers AU | Cart empties before Step 10 (silent ATC failure, session reset) | Yes |
| Dr. Martens AU | PLP grid timeout (`waitForProductGrid`) | Yes |

These are NOT code bugs. `retries: process.env.CI ? env.retries : 0` means retries = 0 locally, so staging flakes appear as hard failures during local full-suite runs.

---

## Playwright version note

Upgraded from 1.61.0 → 1.61.1 (2026-06-30) to resolve `TypeError: context.conditions?.includes is not a function` under Node.js v22.18.0. Both specs verified clean on 1.61.1.
