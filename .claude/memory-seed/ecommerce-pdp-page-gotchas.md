---
name: ecommerce-pdp-page-gotchas
description: Known DOM/selector bugs and patterns in EcommercePDPPage — avoids re-discovering root causes for Bloomreach popup, gallery selectors, dual-h1, swatch navigation, cart count, and nav-label selection
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6c04fe97-fef3-464e-b927-fb15d4c54bee
---

## 1. Vans AU — Bloomreach acquisition popup blocks swatch click

Vans AU injects a `.bloomreach-acquisition-popup-template.state-open` overlay that intercepts pointer events before any swatch interaction. Without dismissal the swatch `goto()` navigates but the overlay may still intercept earlier clicks in the flow.

**Fix applied in `pdp-page.ts`:**
- Private field: `acquisitionPopupSelector = '[class*="bloomreach-acquisition-popup"][class*="state-open"]'`
- Private method `dismissAcquisitionPopup()` — tries close button first, falls back to `Escape`, then `waits.sleep(400)`. Called at the top of `clickColourSwatch()`.
- Same overlay pattern exists in `plp-page.ts` `dismissOverlays()` — both handle the same Bloomreach component.

**Why:** `force: true` on the swatch click was not enough — the overlay's z-index still swallows pointer events on some pages.

**How to apply:** Any new PDP interaction method on Vans AU storefronts should call `dismissAcquisitionPopup()` first.

---

## 2. Dr. Martens AU — gallery images use `alt="image-product"`, not class-based selectors

Dr. Martens AU uses styled-components with hashed class names. Product gallery images have `alt="image-product"` and no recognisable class pattern (`gallery`, `product`, `swiper-slide`, etc.).

**Fix applied in `pdp-page.ts`:**
```ts
private readonly galleryImageSelector =
  '[class*="gallery"] img, .product-gallery img, .swiper-slide img, img[class*="product"], img[alt*="product"]';
```
The trailing `img[alt*="product"]` catches Dr. Martens AU/NZ images.

**Why:** `isImageGalleryVisible()` and `waitForVariantNavigation()` use `querySelectorAll(selector)` with `getBoundingClientRect()`. Without the alt-based fallback the selector returns an empty NodeList and the check returns false indefinitely.

**How to apply:** If a storefront's gallery images are not matched by the existing selectors, inspect the `alt` attribute — Dr. Martens uses `"image-product"` as a stable alt value.

---

## 3. Dr. Martens NZ — two `<h1>` elements on PDP triggers strict-mode violation

Dr. Martens NZ PDPs render two `<h1>` elements: the product name (e.g. "Jadon III Pisa") and a marketing section heading ("DM'S Technology"). Playwright's `getByRole('heading', { level: 1 })` without `.first()` throws a strict-mode violation in `waitFor()`.

**Fix applied in `pdp-page.ts`:**
```ts
private readonly productNameHeading = this.page.getByRole('heading', { level: 1 }).first();
```

**Why:** `locator.waitFor()` uses strict mode by default — it fails if the locator resolves to more than one element.

**How to apply:** Always add `.first()` to `getByRole('heading', { level: 1 })` locators on ecommerce PDPs. If the product name is unexpectedly returning a marketing heading, the DOM has multiple `<h1>` elements and `.first()` targets the correct one (product name always appears first in DOM order on all tested storefronts).

---

## 4. Swatch click navigation — use `page.goto()` not `click({ force: true })`

Clicking colour swatch anchors with `{ force: true }` dispatches the browser click event but does not reliably trigger React router navigation on all storefronts (confirmed failure on Vans NZ).

**Fix applied in `pdp-page.ts` `clickColourSwatch()`:**
```ts
await this.page.goto(absolute, {
  waitUntil: 'domcontentloaded',
  timeout: TIMEOUTS.PAGE_LOAD_SLOW,
});
```
Where `absolute` is the resolved href of the target swatch anchor.

**Why:** React router intercepts `<a>` clicks via a synthetic event listener. `force: true` bypasses actionability checks but the event may not propagate to the React handler in all environments. Direct `goto()` is deterministic and storefront-agnostic.

**How to apply:** For any swatch/variant navigation via `<a>` anchors in a React SPA, extract the `href` attribute and use `page.goto()` directly rather than clicking the element.

---

## 5. `waitForVariantNavigation` gallery check — make best-effort, not hard

The `waitForFunction` for gallery images inside `waitForVariantNavigation` must be wrapped in `.catch(() => {})`. Some storefronts (e.g. Dr. Martens with mega-nav open post-navigation) may not satisfy the gallery selector within `ELEMENT_VISIBLE` timeout. The real gate is the explicit `isImageGalleryVisible()` soft assertion in the spec.

**Fix applied:**
```ts
await this.page
  .waitForFunction(/* gallery check */, selector, { timeout: TIMEOUTS.ELEMENT_VISIBLE })
  .catch(() => { /* best-effort */ });
```

**How to apply:** Keep the `waitForFunction` as a fast-path sync signal, but always `.catch()` it. Let the downstream soft assertion be the source of truth.

---

## 6. Cart count — use `waitForMiniCartCountIncrement()`, assert delta not absolute

`getMiniCartCount()` reads the badge synchronously. After `addToCart()`, the badge updates asynchronously — always use `waitForMiniCartCountIncrement(initialCount)` to poll until the count exceeds `initialCount`.

**Method added in `pdp-page.ts` (2026-05-26):**
```ts
async waitForMiniCartCountIncrement(previousCount: number): Promise<number>
```
Uses `this.waits.waitForCustomCondition(...).catch(() => {})` with `TIMEOUTS.DIALOG_APPEAR` + `TIMEOUTS.POLL_INTERVAL_FAST`. Returns the last observed count (best-effort).

**Serial assertion rule:** assert delta (`initialCartCount + 1`), never absolute count (`1`). Serial tests in `pdp-smoke.spec.ts` share a browser context — the cart carries items from earlier loop iterations.

**Why:** E2E-PDP-007 confirmed the badge does not update synchronously after ATC click on any of the 8 storefronts.

**How to apply:** For any future ATC test, capture `initialCartCount` before clicking ATC, then call `waitForMiniCartCountIncrement(initialCartCount)` and soft-assert the delta.

---

## 7. PDP specs — prefer MENS nav for Skechers and Vans NZ

When a PDP test needs footwear with a size selector, Skechers and Vans NZ must enter via MENS PLP:
- **Skechers WOMENS PLP** — first products are non-footwear (no size selector)
- **Vans NZ WOMENS** — lands on a sub-category PLP (Classics), not individual PDPs

**Pattern established in E2E-PDP-005/006/007:**
```ts
const preferMens =
  site.name.toLowerCase().includes('skechers') || site.name.toLowerCase().includes('vans nz');
const navLabel = preferMens
  ? (site.mensNavLabel ?? site.womensNavLabel ?? site.saleNavLabel)
  : (site.womensNavLabel ?? site.mensNavLabel ?? site.saleNavLabel);
```

**Why:** Without this, both storefronts' tests skip on the "no size selector visible" guard or fail to reach a PDP at all.

**How to apply:** Copy this two-line pattern verbatim into any new PDP spec loop that requires footwear coverage across all 8 storefronts.
