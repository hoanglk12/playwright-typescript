---
name: ecommerce-pdp-page-gotchas
description: Known DOM/selector bugs and patterns in EcommercePDPPage — avoids re-discovering root causes for Bloomreach popup, gallery selectors, dual-h1, swatch navigation, cart count, nav-label selection, and storefront nav URLs
type: feedback
tags: [memory, feedback]
source_session: 6c04fe97-fef3-464e-b927-fb15d4c54bee
last_verified: 2026-06-14
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

**Delta assertion rule:** assert delta (`initialCartCount + 1`), not absolute count (`1`). Read `getMiniCartCount()` before ATC, expect exactly one more after. Robust against any pre-existing items. (Note: smoke specs no longer use serial mode — each test gets a fresh browser context — but the delta pattern remains best practice.)

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

---

## 10. Dr. Martens NZ — L3L4Navigation container blocks size button at 1920×1080 (resolved)

Root cause identified 2026-06-14 for E2E-CART-005-008 ("Size was not chosen" after ATC).

**Scenario:** After WOMEN PLP → multi-card goBack() loop → all 10 cards return `[]` sizes immediately → `waitForSizeButtonsToRender()` on last card (1461 SP). By this point the WOMEN megamenu is still "open" in React state (JS-click card navigation never fired `click()` on the nav link itself, so the megamenu's close handler never ran).

**The covering element:** `DIV.sc-fnxdBY.kEwWPG.L3L4Navigation-root` — the WOMEN navigation megamenu content panel. At 1920×1080 viewport, this panel renders wide enough to cover the size button coordinates (`left=1203, top=527`). Its `position:relative, z-index:100, pointer-events:auto` persists in the DOM **even after the panel visually closes** — Escape closes the visible content but the container element stays in place intercepting pointer events.

**Why `force:true` fails:** Playwright's `force:true` dispatches `page.mouse.click(cx, cy)` — a coordinate-based synthetic click. If another element is topmost at those coordinates, the click goes to that element (the nav container), not the size button. React never receives the size selection.

**Why the fix works:** Use `elementFromPoint()` to detect coverage. If covered, use `el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true, view: window }))` directly on the button DOM element. This bypasses coordinates entirely — the event fires on the button and bubbles up through the DOM to React's root event listener. React processes it as a normal size selection click.

**Fix location:** `src/pages/ecommerce/pdp-page.ts` → `selectSize()`. The `dispatchEvent` branch fires only when `elementFromPoint()` returns a non-button element at the button's centre. For storefronts where the button is topmost (all others), the regular `force:true` path is used.

**Critical distinction:** `el.click()` (native method via `page.evaluate`) does NOT reliably reach React's event delegation. `dispatchEvent(new MouseEvent('click', {bubbles:true, composed:true}))` DOES — it explicitly bubbles through the DOM tree to React's root container listener.

**Diagnostic pitfalls that cost excessive time (2026-06-14 session):**

1. **Wrote simulation scripts at wrong viewport.** Built `inspect-dm-atc.mjs` running at 1280×720 — the script showed SUCCESS. The actual test runs at **1920×1080** (set in `playwright.config.ts`). Always verify actual viewport from config before writing any simulation. Add `page.setViewportSize()` matching the config in any diagnostic script.

2. **Didn't read `error-context.md` early enough.** The failing test already emits a page snapshot in `test-results/.../error-context.md`. That snapshot showed `generic: "Size was not chosen"` AND `button "Justify" [active]: Add to Cart` — proving size not registered AND ATC always-active. Reading this first would have revealed both facts in one step. **Always read the error-context.md page snapshot before writing diagnostic scripts.**

3. **Escape approach was a wrong turn.** Pressed Escape to close the megamenu, but the `L3L4Navigation-root` container stays in the DOM at the same position with `pointer-events:auto` after animation. The dropdown content disappears but the container intercepts coordinates. Escape only helps if the element physically leaves the coordinate space. Test with `elementFromPoint()` after Escape — don't assume it cleared coverage.

4. **`isAddToCartEnabled()` is vacuously true on DM NZ.** DM NZ keeps the ATC button in `[active]` state regardless of size selection. `isAddToCartEnabled()` returning `true` does NOT confirm size was registered — it just means the button text matches `/add to (cart|bag)/i` and isn't disabled. On DM NZ, "Add to Cart" is the default state before ANY size is chosen. Do not treat `isAddToCartEnabled()=true` as proof of size registration on this storefront.

5. **Ran multiple test cycles with diagnostic `console.log` instead of reading existing artifacts.** The test already captures a screenshot and page snapshot on failure. One test run + reading `error-context.md` + reading the screenshot would have revealed the root cause. Diagnostic `console.log` injected into production code requires multiple edit→run→read cycles.

**Faster approach for future "React click not registering" bugs:**
1. Run test once. Read `test-results/.../error-context.md` page snapshot immediately.
2. Check whether the page shows a validation error (confirms click fired but server/React rejected) vs no change at all (click missed entirely).
3. Check `elementFromPoint()` at the button's center in `page.evaluate()` — one line, one run.
4. If covered: use `dispatchEvent`. If not covered: look at timing (React handlers not yet attached).

---

## 11. Dr. Martens AU — `getTotalProductCount()` returns 0 on PLP (open investigation)

First observed: 2026-06-10 during E2E-PLP-004-007 and E2E-PLP-006-007.

`getTotalProductCount()` in `EcommercePLPPage` scans `<p>` elements for text matching `/^(\d+)\s+Products$/i`. It returns 0 for Dr. Martens AU, causing E2E-PLP-004 (category filter) and E2E-PLP-006 (size filter) to fail at the precondition guard (`expect(initialCount).toBeGreaterThan(0)`).

**Likely causes to investigate:**
1. Dr. Martens AU renders product count in a different element (e.g. `<span>`, `<div>`) or uses a different string format (e.g. `"N Results"`, `"Showing N products"`, or a number-only element with no trailing word)
2. Count element may not be present at all on Dr. Martens AU PLP (no result count displayed)
3. The count element may render asynchronously and not yet be in DOM when `getTotalProductCount()` runs

**Next step:** Open Dr. Martens AU PLP in a live browser, inspect the product count display, and update `getTotalProductCount()` to handle the site-specific format — or make the regex broader (e.g. `/(\d+)\s*(Products?|Results?|Items?)/i`) and scan more element types.
