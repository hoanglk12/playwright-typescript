---
name: pdp-004-005-vans-au-root-cause
description: Root cause and fix for E2E-PDP-004-005 Vans AU "Size selector shows correct sizes with gender toggle" failing in parallel run — breadcrumb button poisoned DOM walk
metadata:
  type: project
---

Root cause definitively identified and fixed for E2E-PDP-004-005 on 2026-06-20.

**Why:** The test failed in parallel (SPA navigation path) but passed when navigating directly via `page.goto()` (full page load). The symptom was: `Vans AU: sizes should be visible after toggling to "Womens"` → `Expected: > 0, Received: 0`. Page snapshot at failure showed the test was on the Women's PLP, not the PDP.

**Root cause — breadcrumb button poisoned the gender toggle DOM walk:**

When a test navigates via SPA (click WOMEN nav → click product on PLP), React Router sets a breadcrumb that renders `<button>Womens</button>` inside `<div class="bread-crumbs-root">`. The breadcrumb SECTION and the product FORM are **siblings** under `<div class="page-content">`.

`getSizeGenderToggleLabels()` in `src/pages/ecommerce/pdp-page.ts` walks UP the DOM from the first visible size button looking for gender-pattern `<button>` elements. On Vans AU the default size unit is CM (not US MENS/WOMENS), so no gender buttons exist inside the product FORM. The walk continued past the FORM boundary up to `div.page-content` — where `querySelectorAll('button')` at that level found the breadcrumb `<button>Womens</button>`.

The `pdpSizeToggleLabels: ['US MENS', 'US WOMENS']` configured for Vans AU (marked TODO/unconfirmed) then caused the test to enter the toggle-assertion branch. `"WOMENS".includes("MENS") === true` (substring match) made `actualFirstToggle = "Womens"`. `clickSizeGenderToggle("Womens")` clicked the breadcrumb button via `page.evaluate()` — bypassing `addLocatorHandler` which only fires during actionability waits — triggering SPA navigation back to the Women's PLP. `getVisibleSizeLabels()` returned 0 sizes → assertion failed.

**Three contributing factors:**
1. `getSizeGenderToggleLabels()` and `clickSizeGenderToggle()` did not stop the ancestor walk at the product FORM boundary
2. `pdpSizeToggleLabels: ['US MENS', 'US WOMENS']` was incorrectly set for Vans AU/NZ — Vans uses a size UNIT picker (CM/US/EU/UK via `<div class="size-menu-item">` elements, NOT `<button>`), not gender toggles
3. `"WOMENS".includes("MENS") === true` — substring match made both actualFirstToggle and actualSecondToggle resolve to the same "Womens" breadcrumb label

**Disproved hypotheses:**
- Nav 'WOMEN' link: nav links are `<a>` elements; `querySelectorAll('button')` ignores them
- Bloomreach popup has 'Womens' button: popup renders `<label class="checkbox-label">Womens</label>`, not `<button>`
- `page.goto()` reproduces it: direct URL load skips React Router breadcrumb rendering — hid the failure mode

**Fix (both in one session):**

`src/pages/ecommerce/pdp-page.ts` — added FORM-boundary guard in both DOM-walk functions:
```ts
// After checking gender buttons but before climbing to parentElement:
if (container.tagName === 'FORM') break;
container = container.parentElement;
```
Applied to both `getSizeGenderToggleLabels()` and `clickSizeGenderToggle()`.

`src/data/ecommerce/storefronts.ts` — removed `pdpSizeToggleLabels` from Vans AU and Vans NZ entries entirely. Without it, `site.pdpSizeToggleLabels` is undefined and the test skips the toggle branch for these storefronts.

**Verification:** All 8 E2E-PDP-004 storefronts passed (8/8, 0 failed, 0 flaky) in parallel with 4 workers in 51.6s.

**How to apply:** When `getSizeGenderToggleLabels()` returns unexpected labels for a storefront, first check whether SPA navigation caused a React Router breadcrumb to render `<button>` elements outside the product FORM. Direct `page.goto()` in isolation will NOT reproduce this — always test via SPA navigation path. Also verify `pdpSizeToggleLabels` entries are grounded in actual DOM inspection of the live staging site, not assumed to match nav label patterns.

Related: [[ecommerce-pdp-page-gotchas]], [[ecommerce-storefronts]]
