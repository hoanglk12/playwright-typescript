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
`ecommerceHomePage`, `ecommerceNavPage`, `ecommerceSearchPage`, `ecommercePLPPage`, `ecommercePDPPage`.

Never instantiate page objects directly in specs — always use the fixture.

## Firefox Teardown — Do Not Remove

All five ecommerce fixtures navigate to `about:blank` before teardown on Firefox. This is intentional — Firefox's Juggler protocol hangs on `context.close()` when SPAs have active service workers or persistent WebSocket connections. Do not remove or refactor this workaround.

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
