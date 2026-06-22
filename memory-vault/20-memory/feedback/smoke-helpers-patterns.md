---
name: smoke-helpers-patterns
description: smoke-helpers.ts export catalog, design decisions for extraction vs inline, and advisor-verified rules for cart scan and size selection patterns
metadata:
  type: feedback
  tags: [memory, feedback]
  last_verified: 2026-06-23
---

## smoke-helpers.ts — Current Export Catalog (7 functions)

File: `tests/ecommerce/smoke/smoke-helpers.ts`

| Export | Purpose |
|---|---|
| `getPreferredNavLabel(site, preferMens?)` | Nav label fallback chain (WOMENS → MENS → SALE or reversed) |
| `navigateToPlp(navPage, plpPage, site, navLabel)` | Standard 5-step homepage → PLP navigation |
| `shouldPreferMens(site)` | True for Skechers + Vans NZ (two-brand predicate) |
| `createFreshAccountViaGraphQL(request, site)` | GraphQL account creation; returns `AccountCreationResult` |
| `ensureCartOverlayOpen(cartOverlayPage)` | Opens mini cart overlay if it didn't auto-open after ATC |
| `findProductWithAvailableSizes(plpPage, pdpPage, maxProducts?)` | Scans PLP for first product with available sizes |
| `selectFirstPurchasableSize(pdpPage, sizes, maxToTry?)` | Selects first size that enables ATC button; returns size or null |

Private constants also moved here: `BRAND_CODES`, `CREATE_CUSTOMER_MUTATION`.

---

## Rule: Never call test.skip() inside a helper

**Why:** Calling `test.skip()` + `return` inside a helper only exits the helper function, not the test. The test continues running.

**How to apply:** Helpers return a result value. Caller checks the result and calls `test.skip()` + `return` itself.

Pattern for `createFreshAccountViaGraphQL`:
```ts
const { creds, created, skipReason } = await createFreshAccountViaGraphQL(request, site);
if (!created) {
  test.skip(true, `Account creation failed for ${site.name}: ${skipReason}`);
  return;
}
```

Pattern for `selectFirstPurchasableSize`:
```ts
const targetSize = await selectFirstPurchasableSize(ecommercePDPPage, availableSizes);
if (targetSize === null) {
  test.skip(true, `...`);
  return;
}
```

---

## Rule: `findProductWithAvailableSizes` uses cart structure (fast loop + post-loop fallback)

**Why:** Cart tests use a fast `getAvailableSizes()` call per product with NO wait inside the loop, then a single `waitForSizeButtonsToRender()` post-loop. PDP tests use `waitForSizeButtonsToRender()` inside the loop. The PDP structure burns the full ELEMENT_VISIBLE timeout (~20s CI) on every non-footwear product. On non-footwear-first storefronts (Skechers, Platypus AU, Vans NZ), this would cascade 20s × per product before finding footwear, against the test.slow() budget. Confirmed via advisor review 2026-06-23.

**How to apply:** `findProductWithAvailableSizes` in smoke-helpers uses cart structure. PDP-005 and PDP-007 keep their own inline loops because they have additional checks (`isSizeSelectorVisible`, wait-in-loop) that are semantically different.

---

## Rule: Flavor B (Vans AU hot-path) stays inline — do NOT extract

**Why:** CART-004, CART-005, CART-008 call `addToCart()` immediately after `isAddToCartEnabled()` inside the same loop iteration. This ~400ms hot-path minimises the window where Vans AU's SPA can lose the ATC button between the enabled check and the click. Extracting it into `selectFirstPurchasableSize` would separate the check from the click.

**How to apply:** Only `selectFirstPurchasableSize` (Flavor A — returns `targetSize`, caller does ATC separately) should call the helper. Flavor B loops stay inline. Currently used in: CART-002, CART-003, PDP-005, PDP-007.

---

## Rule: `shouldPreferMens` vs inline Skechers-only predicate

**Why:** `shouldPreferMens(site)` covers the two-brand predicate (Skechers + Vans NZ). PDP-005 uses a Skechers-only variant (`site.name.toLowerCase().includes('skechers')`) for a different semantic reason. These are not equivalent.

**How to apply:** Replace two-brand inline expressions with `shouldPreferMens(site)`. Leave PDP-005's skechers-only variant inline — do not replace it with `shouldPreferMens`.

---

## Rule: PDP-005 must re-check `isAddToCartEnabled()` after `selectFirstPurchasableSize`

**Why:** PDP-005 has a soft assertion `softAssert.toBe(atcEnabled, true, ...)` after the size selection loop. `selectFirstPurchasableSize` doesn't return `atcEnabled`, only `targetSize`. After null-guard, `targetSize !== null` proves ATC was enabled, but the assertion needs a boolean — so re-check the live ATC state.

**How to apply:**
```ts
const targetSize = await selectFirstPurchasableSize(ecommercePDPPage, availableSizes);
if (targetSize === null) { test.skip(...); return; }
const atcEnabled = await ecommercePDPPage.isAddToCartEnabled();
softAssert.toBe(atcEnabled, true, `...`);
```

See also: [[ecommerce-pdp-page-gotchas]]
