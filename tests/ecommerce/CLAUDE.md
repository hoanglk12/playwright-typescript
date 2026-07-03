# Ecommerce Test Rules

Supplements the root `CLAUDE.md`. Rules here apply to everything under `tests/ecommerce/`.

## Storefront Configuration

`src/data/ecommerce/storefronts.ts` is the single source of truth for all tested storefronts. Each `Storefront` entry defines:

| Field | Purpose |
|---|---|
| `name`, `url`, `titleRegex` | Identity and page-load assertion |
| `hasQantasPoints` | AU earns points; NZ does not (E2E-HOME-003) |
| `navLinks`, `*NavLabel` | Expected nav link labels per area |
| `searchTerm`, `categoryFilterLabel` | Inputs for search/filter tests |
| `pdpPath` | Stable URL path for direct-navigation PDP tests |
| `pdpSizeToggleLabels` | Expected gender-toggle labels on size selector (best-effort) |
| `pdpExpectedSize` | A size label expected to appear in the size grid (best-effort) |

**Adding coverage for a new storefront = adding an entry to `storefronts.ts`.**

> **Note on `pdpSizeToggleLabels` / `pdpExpectedSize`:** These fields carry TODO markers in the source — actual labels have not been confirmed against a live staging product for all storefronts. Tests using them apply soft assertions; do not treat them as ground truth until verified.

## Page Object

All ecommerce specs use fixtures from `base-test.ts`:
`ecommerceHomePage`, `ecommerceNavPage`, `ecommerceSearchPage`, `ecommercePLPPage`, `ecommercePDPPage`, `ecommerceCartOverlayPage`, `ecommerceAccountModalPage`, `ecommerceErrorPage`, `ecommerceCheckoutPage`.

Never instantiate page objects directly in specs — always use the fixture.

## Firefox Teardown — Do Not Remove

All nine ecommerce fixtures navigate to `about:blank` before teardown on Firefox. This is intentional — Firefox's Juggler protocol hangs on `context.close()` when SPAs have active service workers or persistent WebSocket connections. Do not remove or refactor this workaround.

## EcommercePDPPage — Known Storefront Gotchas

### 1. Bloomreach popup (Vans AU) — must dismiss before swatch interactions

Vans AU injects a `.bloomreach-acquisition-popup-template.state-open` overlay that intercepts pointer events. Call `dismissAcquisitionPopup()` at the start of any new interaction method that touches swatches or variant selectors on Vans AU storefronts. `force: true` alone is not sufficient — the overlay's z-index still swallows events.

### 2. Dr. Martens AU/NZ — gallery images identified by `alt`, not class

Dr. Martens uses styled-components with hashed class names. Gallery images have `alt="image-product"` and no stable class pattern. The `galleryImageSelector` field already includes `img[alt*="product"]` as a fallback. If a new storefront gallery is not matched, inspect the `alt` attribute before adding a class-based selector.

### 3. Dr. Martens NZ — two `<h1>` on PDP triggers strict-mode violation

Dr. Martens NZ PDPs render two `<h1>` elements (product name + marketing heading). Always use `.first()` on `getByRole('heading', { level: 1 })` for ecommerce PDPs. The product name is always first in DOM order across all tested storefronts.

```ts
// Correct
private readonly productNameHeading = this.page.getByRole('heading', { level: 1 }).first();

// Wrong — strict mode violation on Dr. Martens NZ
private readonly productNameHeading = this.page.getByRole('heading', { level: 1 });
```

### 4. Swatch/variant navigation — use `page.goto()`, not `click({ force: true })`

React router intercepts `<a>` clicks via synthetic event listeners. `force: true` dispatches the browser event but does not reliably trigger React router navigation (confirmed failure on Vans NZ). Extract the `href` attribute and call `page.goto()` directly:

```ts
// Correct
const href = await swatchAnchor.getAttribute('href');
await this.page.goto(absoluteHref, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.PAGE_LOAD_SLOW });

// Wrong — unreliable on React SPAs
await swatchAnchor.click({ force: true });
```

### 5. `waitForVariantNavigation` gallery check — wrap in `.catch()`

The `waitForFunction` gallery check inside `waitForVariantNavigation` must be wrapped in `.catch(() => {})`. Some storefronts (Dr. Martens with mega-nav open post-navigation) may not satisfy the gallery selector within `ELEMENT_VISIBLE` timeout. The downstream soft assertion in the spec is the source of truth — the `waitForFunction` is a fast-path hint only.

```ts
await this.page
  .waitForFunction(/* gallery check */, selector, { timeout: TIMEOUTS.ELEMENT_VISIBLE })
  .catch(() => { /* best-effort */ });
```

## EcommercePDPPage — Cart Count Pattern

`getMiniCartCount()` is synchronous — call `waitForMiniCartCountIncrement(initialCount)` after
`addToCart()` to poll until the badge updates (best-effort, `.catch(() => {})` like other polling methods).

**Delta assertion rule:** assert delta (`initialCartCount + 1`), not absolute count (`1`) — read `getMiniCartCount()` before ATC and expect exactly one more after. This is robust against any pre-existing items in the cart.

## PDP Specs — Nav Label Selection for Footwear Coverage

Skechers WOMENS PLP leads to non-footwear first. Vans NZ WOMENS lands on a sub-category PLP
(Classics), not individual PDPs. Both need MENS nav to get footwear with size selectors:

```ts
const preferMens = site.name.toLowerCase().includes('skechers') || site.name.toLowerCase().includes('vans nz');
const navLabel = preferMens ? (site.mensNavLabel ?? site.womensNavLabel ?? site.saleNavLabel)
                            : (site.womensNavLabel ?? site.mensNavLabel ?? site.saleNavLabel);
```

This pattern is established in E2E-PDP-005/006/007 — reuse it for any new PDP test needing size selectors.

## EcommerceCartOverlayPage — Mini Cart Overlay Detection

`EcommerceCartOverlayPage` (`src/pages/ecommerce/cart-overlay-page.ts`) provides three methods for E2E-CART-003 and any future mini-cart overlay tests:

- `clickCartIcon()` — finds and clicks the first visible cart icon via `page.evaluate()` (same semantic-attribute pattern as `getMiniCartCount()`)
- `isOverlayVisible()` — three-part gate: (1) selector includes `aside, [role="complementary"]` alongside `role="dialog"` and class-substring patterns, (2) `position: fixed/absolute` to exclude persistent header chrome, (3) actionable CTA regex (`/checkout|view (cart|bag)|proceed|go to (cart|bag)/`)
- `waitForOverlayVisible()` — polls `isOverlayVisible()` best-effort with `.catch(() => {})`

**Key pattern — Platypus AU uses `aside`:** The mini cart overlay renders as `[role="complementary"]` (`<aside>`), not `role="dialog"`. Always include `aside, [role="complementary"]` in any overlay selector on these storefronts.

**Why the three-part gate:** `[class*="cart"]` alone matches the always-present header cart icon, making any assertion vacuously true. The `position:fixed/absolute` + CTA check is the guard against this false-positive.

**Vans AU known issue:** The Bloomreach popup may intercept `clickCartIcon()` after ATC, preventing the overlay from opening. Use soft assertions for overlay visibility so a Bloomreach-blocked Vans AU test records a failure without cascading to other storefronts.

## EcommerceWishlistPage — Known Storefront Gotchas

### 1. Header entry point is a real `<a href="/wishlist">` link, not a flyout trigger

Confirmed live (headless Chromium investigation against all 8 GRA storefronts): the header wishlist icon is a genuine `<a href="/wishlist">` anchor wrapping a `<button aria-label="Toggle Wishlist">`. Unlike the Help/Support trigger (a `<figure>` with no href — see the `EcommerceHelpSupportPage` docblock), clicking it navigates directly to a full `/wishlist` page on every storefront checked — no flyout/overlay panel is involved.

```ts
// Correct — target the inner button, which carries the accessible name
private readonly headerWishlistTrigger = this.page
  .getByRole('button', { name: 'Toggle Wishlist', exact: true })
  .first();

// Wrong — the wrapping <a> has no accessible name (empty text, no aria-label)
private readonly headerWishlistTrigger = this.page.getByRole('link', { name: 'Wishlist' });
```

### 2. Guest empty-state has two independently valid variants — do not hard-code one

All 8 storefronts render the "MY WISHLIST" heading and the empty-state message "You have no items in your list." for a guest. Most storefronts additionally render a "Please Sign in or Register…" prompt with SIGN IN / REGISTER controls above the empty-state message; this prompt was observed to be intermittently absent on one storefront during a fast-loading investigation pass (timing/hydration variance, not a confirmed per-brand difference). Treat both the empty-state message and the sign-in prompt as independently valid guest outcomes — soft-assert `isEmptyWishlistMessageVisible() || isLoginPromptVisible()`, never hard-assert one specific variant.
