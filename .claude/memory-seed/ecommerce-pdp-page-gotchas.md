---
name: ecommerce-pdp-page-gotchas
description: Known DOM/selector bugs and patterns in EcommercePDPPage — avoids re-discovering root causes for Bloomreach popup, gallery selectors, dual-h1, swatch navigation, cart count, nav-label selection, and storefront nav URLs
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6c04fe97-fef3-464e-b927-fb15d4c54bee
---

## 1. Vans AU — Bloomreach acquisition popup blocks swatch click

Vans AU injects a `.bloomreach-acquisition-popup-template.state-open` overlay that intercepts pointer events before any swatch interaction.

**Fix applied in `pdp-page.ts`:**
- Private method `dismissAcquisitionPopup()` — tries close button first, falls back to `Escape`. Called at the top of `clickColourSwatch()` and `ensureNoOverlay()`.

**Why:** `force: true` on the swatch click was not enough — the overlay's z-index still swallows pointer events.

**How to apply:** Any new PDP interaction method on Vans AU storefronts should call `ensureNoOverlay()` first.

---

## 2. Dr. Martens AU — gallery images use `alt="image-product"`, not class-based selectors

Dr. Martens AU uses styled-components with hashed class names. Gallery images have `alt="image-product"` and no recognisable class pattern.

**Fix applied in `pdp-page.ts`:**
```ts
private readonly galleryImageSelector =
  '[class*="gallery"] img, .product-gallery img, .swiper-slide img, img[class*="product"], img[alt*="product"]';
```

**How to apply:** If a storefront's gallery images are not matched, inspect the `alt` attribute — Dr. Martens uses `"image-product"` as a stable alt value.

---

## 3. Dr. Martens NZ — two `<h1>` elements on PDP triggers strict-mode violation

Dr. Martens NZ PDPs render two `<h1>` elements (product name + marketing heading). Always use `.first()` on `getByRole('heading', { level: 1 })` for ecommerce PDPs.

---

## 4. Swatch click navigation — use `page.goto()` not `click({ force: true })`

React router intercepts `<a>` clicks via synthetic event listeners. `force: true` bypasses actionability checks but may not propagate to the React handler (confirmed failure on Vans NZ).

**Fix:** Extract `href` and call `page.goto()` directly. `clickColourSwatch()` in `pdp-page.ts` implements this.

---

## 5. `waitForVariantNavigation` gallery check — make best-effort, not hard

The `waitForFunction` for gallery images inside `waitForVariantNavigation` must be wrapped in `.catch(() => {})`. Let the downstream soft assertion be the source of truth.

---

## 6. Cart count — use `waitForMiniCartCountIncrement()`, assert delta not absolute

`getMiniCartCount()` is a **global header read** — it works from any page (homepage, PLP, PDP). Confirmed in E2E-CART-001 (all 8 storefronts, called from homepage).

**Two read paths (updated 2026-05-31):**
1. **aria-label fast path**: parses `"You have N item(s)"` from the cart button's `aria-label` — updates with React state immediately. Critical for Vans AU where the aria-label updates seconds after ATC but the DOM badge child node may take much longer under batch load.
2. **DOM leaf node**: numeric child span added to the cart button subtree after ATC (works on Platypus AU, Dr. Martens, etc.).

**Current timeouts in `pdp-page.ts` (updated 2026-05-31):**
- `waitForMiniCartCountIncrement` → `TIMEOUTS.NETWORK_IDLE_SLOW` (45s fixed) — ATC triggers a Magento REST roundtrip, not a browser dialog; 45s survives serial-batch accumulated latency.
- `waitForSizeButtonsToRender` → `TIMEOUTS.ELEMENT_VISIBLE` (10s local / 20s CI) — sizes render asynchronously post-PDP load.
- `addToCart()` → `waitFor({ state: 'attached' })` before counting + `ELEMENT_VISIBLE` click timeout — React reconciliation transiently unmounts the ATC button after `selectSize()` under batch load.

**Serial assertion rule:** assert delta (`initialCartCount + 1`), never absolute count (`1`). Serial tests share browser context.

**How to apply:** Capture `initialCartCount` before ATC, call `waitForMiniCartCountIncrement(initialCartCount)`, soft-assert delta.

---

## 7. PDP specs — prefer MENS nav for Skechers and Vans NZ

When a PDP test needs footwear with a size selector, Skechers and Vans NZ must enter via MENS PLP:
- **Skechers WOMENS PLP** — first products are non-footwear (no size selector)
- **Vans NZ WOMENS** — lands on a sub-category PLP (Classics), not individual PDPs

**Canonical helper (smoke-helpers.ts):** `getPreferredNavLabel(site, preferMens)` in `tests/ecommerce/smoke/smoke-helpers.ts` encapsulates this logic — use it instead of inlining:

```ts
import { getPreferredNavLabel } from '../smoke-helpers';
const preferMens = site.name.toLowerCase().includes('skechers') || site.name.toLowerCase().includes('vans nz');
const navLabel = getPreferredNavLabel(site, preferMens);
```

---

## 8. Platypus AU — nav category inventory pitfalls

Discovered 2026-05-31 during E2E-CART-002 troubleshooting:

| Nav label | URL | First products | Safe for footwear test? |
|---|---|---|---|
| WOMENS | `/shop/womens` | Footwear (Converse, Skechers, Vans) — order varies | Yes, scan 3–5 products |
| MENS | `/shop/mens` | **Socks first** | **No** — not a reliable footwear fallback |
| ALL | `/shop/best-sellers` | **Socks first** | **No** |
| SALE | `/shop/sale` | Toddler shoes (T6/T7 sizes) | Marginal |
| PRESALE | `/shop/presale` | Real footwear (Dr. Martens, Converse) | Avoid — time-limited |

**Confirmed nav URLs per storefront (from live browser inspection 2026-05-31):**
- Platypus AU: WOMENS→`/shop/womens`, MENS→`/shop/mens`
- Skechers AU: WOMEN→`/shop/women`, MENS→`/shop/men` (note: different spelling)
- Vans AU: WOMEN→`/shop/womens`, MEN→`/shop/mens`, OUTLET→`/shop/sale`

**Cart button DOM:** Platypus AU uses a `<button>` (not `<a>`) with `aria-label="Toggle mini cart. You have N items in your cart."`. At 0 items: SVG only, no numeric child. After ATC: badge element appended. `getMiniCartCount()` detects this via `[aria-label*="cart" i]` + aria-label text parsing.

**E2E-CART-002 scan strategy:** Use WOMENS as primary, scan up to 5 products with quick `getAvailableSizes()` after each `waitForPdpLoad()`. Apply final `waitForSizeButtonsToRender()` on the last product if still empty. Do NOT use MENS as fallback — it starts with accessories, not footwear.

---

## 9. Mini cart overlay — Platypus AU renders as `aside` (complementary), not `dialog`

Discovered 2026-06-03 during E2E-CART-003 implementation.

The mini cart overlay on Platypus AU (and likely other storefronts) renders as a `<aside>` / `[role="complementary"]` panel, NOT as `role="dialog"` or `aria-modal="true"`. Detecting it with dialog/modal selectors only will always return `false`.

**`EcommerceCartOverlayPage` at `src/pages/ecommerce/cart-overlay-page.ts`:**
- `clickCartIcon()` — `page.evaluate()` to find/click first visible `a[href*="/cart"]` or `[aria-label*="cart/bag"]` (same pattern as `getMiniCartCount()`)
- `isOverlayVisible()` — three-part gate: (1) selector includes `aside, [role="complementary"]` alongside `role="dialog"`, `aria-modal`, `class*drawer/overlay/minicart`; (2) `position: fixed/absolute` (distinguishes overlay from persistent header chrome); (3) actionable CTA regex (`/checkout|view (cart|bag)|proceed|go to (cart|bag)/`)
- `waitForOverlayVisible()` — polls `isOverlayVisible()` with `TIMEOUTS.ELEMENT_VISIBLE`, `.catch(() => {})` best-effort

**Why three-part gate matters:** `[class*="cart"]` alone matches the persistent header cart icon (always in DOM), making the assertion vacuously true. The `position:fixed/absolute` + CTA gate prevents false-positives.

**E2E-CART-003 result:** 6/8 passed on first run (Platypus AU+NZ, Skechers AU+NZ, Vans AU+NZ, and 2 of the DM sites). Subsequent runs show staging flakiness: Vans AU fails intermittently (overlay not detected — likely Bloomreach popup blocking `clickCartIcon()` or Vans-specific DOM structure not matching our selector). Dr. Martens AU/NZ and Skechers AU sometimes skip (no purchasable sizes). Soft assertion prevents suite crash — Vans AU overlay issue should be investigated via live browser inspection if consistent.
