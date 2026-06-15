---
name: gra-storefront-tech-notes
description: "Deep tech investigation of all 8 GRA storefronts — framework, DOM, network, cart, third-party integrations, and automation gotchas"
type: project
tags: [memory, project]
last_verified: 2026-06-15
---

# GRA Storefront Tech Investigation Notes

Live browser investigation of all 8 staging storefronts conducted 2026-06-15.
Used Playwright MCP with JavaScript evaluation for in-page tech detection + network request analysis.

## 1. Per-Site Summary Table

| Brand | Platform Version | CSS Strategy | Cart Storage | Cookie Banner | h1 on Homepage |
|---|---|---|---|---|---|
| Platypus AU | Magento 2.4.6-p15 / PWA 9.0.1 / GRA 10.0.26.1 | styled-components (hashed `sc-*`) | `forterToken` + `attraqtsessionid` in localStorage | None (staging) | 0 |
| Platypus NZ | Same | Same | Same keys | None | 0 |
| Skechers AU | Same | Same | Same keys | None | 8–14 empty (PageBuilder bug) |
| Skechers NZ | Same | Same | Same keys | None | 9 (1 visible: "SPEND & SAVE") |
| Vans AU | Same | Same | Same keys | None | 0 |
| Vans NZ | Same | Same | Same keys | None | 0 |
| Dr. Martens AU | Same | Same | `forterToken` + `attraqtsessionid` (no `NRBA_SESSION` on initial load) | None | 0 |
| Dr. Martens NZ | Same | Same | Same as DRM AU | None | 0 |

## 2. Frontend Stack (shared across all 8 sites)

### SPA Framework
- **NOT Next.js** — `window.__NEXT_DATA__` is null on all 8 sites.
- **NOT classic React** — `window.__REACT_DEVTOOLS_GLOBAL_HOOK__` is absent (hook exists but no renderer attached). `document.querySelector('#__next')` returns null.
- **NOT Vue or Angular** detected.
- **Magento PWA Studio** (Peregrine/Venia) — confirmed by `dataLayer` version string: `pwa_9.0.1`.
- The SPA is a custom React build compiled without standard devtools hooks. This explains the `react: false` detection result — the code runs React internally but does NOT expose devtools.

### CSS Strategy
- **styled-components** — confirmed on all 8 sites via `[class*="sc-"]` selector matches.
- Class names are **doubly hashed**: a stable component hash (`sc-jKDlA-D`, `sc-bTMaZy`, `sc-bVDfoq`) PLUS a dynamic variant hash (`faTtFl`, `ftwPWp`, `hZznSc`).
- **The stable `sc-*` component hash differs per brand** even for the same semantic component:
  - Cart button (Platypus): `sc-jKDlA-D faTtFl`
  - Cart button (Skechers): `sc-bTMaZy ftwPWp`
  - Cart button (Vans / DRM): `sc-bVDfoq hZznSc`
- **Never target `sc-*` or dynamic-hash classes directly** in selectors. They will differ by brand and change on code deploy.

### Service Workers
- **Zero service workers registered** on all 8 sites.
- No PWA offline caching or push notification setup observed.
- Firefox teardown workaround (navigate to `about:blank`) was originally added for SPA WebSocket connections, not SW — but the `navigator.serviceWorker.getRegistrations()` count is 0, so SW is confirmed non-issue.

### Hydration / Lazy Loading
- Magento PWA Studio uses React client-side hydration. Pages boot as blank HTML shells and hydrate on load.
- Image loading is **mixed strategy**: ~half lazy (`loading="lazy"` + `srcset`), ~half eager (no attribute).
- On Skechers AU: 114 lazy images + 109 eager images observed on homepage.
- Images use `srcset` for responsive sizes — Playwright should wait for network idle before asserting image visibility.
- PageBuilder content (CMS blocks) is fetched via GraphQL AFTER initial hydration and injected asynchronously — this causes the h1/banner content lag observed on Skechers.

## 3. Network / Backend

### API Pattern
- **Pure GraphQL, GET method, same-origin** — all data fetched via `{storefront}/graphql?query=...&operationName=...&variables=...`.
- **No REST API calls** for storefront data. REST only appears for third-party services (Forter, Bazaarvoice, Attraqt, FullStory, Google Analytics).
- **GraphQL endpoint per brand**: `https://stag-{brand}-{country}.accentgra.com/graphql`
- **All operations use GET** not POST — makes network interception in Playwright simpler (`page.route('**/graphql**', ...)` works).

### Key GraphQL Operations on Homepage Load
1. `getStoreConfigData` — massive config query (Afterpay, Bazaarvoice, Fredhopper, Forter settings etc.)
2. `ResolveURL` — URL routing resolver (fires twice: legacy + new route resolver)
3. `cmsBlocks` — fetches CMS content blocks by identifier (header, nav, trust block, minicart empty message)
4. `menuItemsByCode` — fetches nav menus: `main_menu`, `mobile_menu`, `help_menu`
5. `GetCmsPage` — fetches homepage CMS content
6. `getAvailableStoresData` — store switcher data
7. `getCurrencyData` — currency info
8. `productOverlayById` — product badge/overlay data (fires after product tiles render)
9. `productOverlayById` / `getProductCategoriesForPDP` — fires for individual product cards on homepage carousel

### Fredhopper
- All 8 sites use Fredhopper for product recommendations: `{storefront}/fredhopper/query?fh_location=...`
- This is a proxied internal endpoint (not an external CDN call).
- Category codes differ: Platypus AU uses `catalog01_2`, DRM AU uses `catalog01_40001`.

### Third-Party Services (per brand)
| Service | Platypus | Skechers | Vans | Dr. Martens |
|---|---|---|---|---|
| Forter (fraud) | ✅ `cdn0.forter.com` | ✅ | ✅ | ✅ |
| Attraqt (search analytics) | ✅ `collect-ap2.attraqt.io` | ✅ | ✅ | ✅ |
| Bloomreach (A/B + campaigns) | ✅ `api-accent.bloomreach.co` | ✅ | ✅ | ✅ |
| FullStory (session recording) | ✅ `rs.fullstory.com` | ❌ (not observed) | ❌ (not observed) | ❌ (not observed) |
| Bazaarvoice (reviews) | ✅ `apps-stg.bazaarvoice.com` | ✅ | ✅ | ✅ |
| Google Analytics (GA4) | ✅ `analytics.google.com` | ✅ | ✅ | ✅ |
| TrueFit (size advisor) | ✅ `consumer-dev.truefitcorp.com` | ✅ | ✅ | ✅ (not confirmed) |
| Adobe Experience Cloud | ✅ `adobedc.demdex.net` | ✅ | ✅ | ✅ |
| Adobe Collect (smetrics) | ✅ `smetrics.platypusshoes.com.au` | brand-specific | brand-specific | brand-specific |

**TrueFit note**: `consumer-dev.truefitcorp.com/api/experiments` returns `net::ERR_FAILED` on Platypus AU staging — the request fires but fails. This causes a console error. Block this route in tests to avoid noise: `page.route('**/truefitcorp.com/**', r => r.abort())`.

### Auth / Session
- **No JWT visible in network headers** on public (guest) pages.
- Session tracked via: `forterToken` in localStorage (fraud fingerprint), `attraqtsessionid` in localStorage (search analytics), `NRBA_SESSION::*` in localStorage (New Relic Browser Agent).
- Cookies set: `FPID` (FullStory), `BVBRANDID`/`BVBRANDSID` (Bazaarvoice), `AMCV_*`/`AMCVS_*` (Adobe), `_ga`/`_ga_*` (Google), `forterToken`, `__exponea_etc__`/`__exponea_time2__` (Bloomreach), `fs_uid`/`fs_lua` (FullStory), TikTok pixel cookies.
- Cart state is stored **server-side** — a cart GUID is maintained in the GraphQL session via `customerCart` query. No `cartId` visible in localStorage on guest homepage.

### CDN / Caching
- All storefront requests go to `*.accentgra.com` (no CDN hostname like `cdn.` prefix observed at the network level).
- Bloomreach bundles come from `api-accent.bloomreach.co` — Bloomreach-hosted CDN.
- Static assets (JS/CSS) served from the same `stag-{brand}-{country}.accentgra.com` origin.

### Bloomreach A/B Testing
- Bloomreach fires `api-accent.bloomreach.co/webxp/projects/{project-id}/bundle` — **project ID differs per brand**.
  - Platypus AU project ID: `eb86d1aa-6e0b-11f0-a921-0a9ecf28d6c1`
  - Dr. Martens AU project ID: `9b76b50a-6e0f-11f0-8ce6-3abf387c99ab`
- A/B experiments are active in staging. Tests may receive different variant experiences on re-run. The `experience_name` seen in GA events: `"Experience A"`, `"Variant A"`.
- **Automation impact**: Bloomreach-driven UI variants can cause intermittent selector failures if an A/B test shows/hides elements. Block `api-accent.bloomreach.co/webxp` in tests requiring stable UI: `page.route('**/api-accent.bloomreach.co/webxp/**', r => r.fulfill({ body: '{}' }))`.

## 4. Cart / Session

### Cart Icon Selector (consistent across all 8 sites)
```
[aria-label*="cart" i]
```
Resolves to: `button[aria-label="Toggle mini cart. You have 0 items in your cart."]`

The aria-label includes item count — it changes dynamically. Never use the full string for assertions. Use partial match:
```ts
// CORRECT
page.locator('[aria-label*="cart" i]')
// or
page.getByRole('button', { name: /toggle mini cart/i })
```

### Cart icon class names by brand (for reference — do NOT use in selectors)
| Brand | Stable sc- hash | Dynamic hash |
|---|---|---|
| Platypus AU/NZ | `sc-jKDlA-D` | `faTtFl` |
| Skechers AU/NZ | `sc-bTMaZy` | `ftwPWp` |
| Vans AU/NZ | `sc-bVDfoq` | `hZznSc` |
| Dr. Martens AU/NZ | `sc-bVDfoq` | `hZznSc` |

Vans and DRM share the same cart button styled-component hash — they share that component implementation.

### Mini-Cart Overlay
- Mini cart renders as a `DIV` with CSS class containing "minicart" — confirmed on Vans AU via `[class*="minicart"]` matches a `DIV` with `display: block`.
- Existing documented pattern: `<aside>` / `[role="complementary"]` for the overlay panel. The `display: block` DIV observed may be a wrapper; the actual overlay container is `<aside>`.
- **Always use the three-part gate** in `EcommerceCartOverlayPage.isOverlayVisible()`: check fixed/absolute position + aside/complementary role + CTA button visibility. Do not rely on CSS class alone.

### Cart State Persistence
- LocalStorage keys: `forterToken` (fraud fingerprint), `attraqtsessionid` (analytics), `NRBA_SESSION::*` (New Relic).
- **No cartId in localStorage** on guest page load. Cart is managed server-side by Magento, accessed via `customerCart` GraphQL query after login or on first add-to-cart (creates a guest cart GUID stored server-side, linked to session cookie).
- Cookie `BVBRANDID`/`BVBRANDSID` are Bazaarvoice session IDs, not cart state.

## 5. Page Structure / DOM

### Semantic Landmarks
- **`<header>`** present on all sites (confirmed Platypus AU: `!!document.querySelector('header') === true`).
- **`<main>`** present on all sites.
- **`<footer>`** NOT rendered in the initial DOM snapshot — footer is lazy-rendered below the fold and may not be in the DOM on navigation. Use `waitForSelector('footer')` before asserting footer content.
- **`<nav>` count = 0** across all 8 sites — navigation is NOT implemented with `<nav>` elements. Menu markup uses `<div>` with ARIA roles. Never use `page.locator('nav')` to find the main menu.
- Neither `<header>` nor `<main>` have explicit `role` attributes — they rely on implicit landmark semantics.

### `data-testid` and `data-cy` attributes
- **Zero `data-testid` attributes** found on any storefront.
- **`data-cy` attributes ARE present** (Platypus AU had 10+ elements).
- `data-cy` values observed: `PageBuilder-Banner-root`, `PageBuilder-Image-root`.
- These are PageBuilder CMS component markers — useful for asserting that banner/image blocks rendered, NOT for specific content selectors.
- **No application-specific `data-cy` or `data-testid`** on interactive elements (buttons, form fields, nav items). All interactive element targeting must use ARIA attributes or semantic roles.

### Cookie Consent Banner
- **No cookie consent/GDPR banner** detected on any of the 8 sites.
- Neither class-based (`[class*="cookie"]`, `[class*="consent"]`) nor ID-based detection returned any element.
- Confirmed absence: no blocking cookie overlay to dismiss before interacting.

### h1 Elements — Per-Brand Gotchas

**Platypus AU / NZ, Vans AU / NZ, Dr. Martens AU / NZ:**
- **0 `<h1>` elements** on the homepage.
- These sites use heading levels starting at `<h2>` for content sections.
- Never assert `expect(page.locator('h1')).toBeVisible()` on these homepages — it will always fail.

**Skechers AU:**
- **8–14 `<h1>` elements** present, all inside `[data-cy="PageBuilder-Banner-root"]` elements.
- **All h1 text is empty** (`innerHTML: ""`) — these are CMS PageBuilder placeholders where the CMS author used h1 tags in a banner component but left the heading text blank.
- `document.querySelectorAll('h1').length` returns 8–14 depending on scroll/content load state — do not use h1 count as a page-ready signal on Skechers.
- Class on h1 parent: `sc-iNezeW hDSnBa banner-content` — styled-components class.

**Skechers NZ:**
- 9 `<h1>` elements, 8 empty + 1 with text `"SPEND & SAVE"` (a promo banner heading).
- Same PageBuilder-Banner-root pattern as Skechers AU.

**Rule:** Never use `page.getByRole('heading', { level: 1 })` on homepages — it is unreliable across all 8 sites (0 or multiple, often empty).

## 6. Vans-Specific: Bloomreach Acquisition Popup

**Critical automation blocker.** Vans AU (and potentially Vans NZ) renders a full-page acquisition popup immediately on homepage load.

Detection details:
- Selector: `#popup` with class `popup visible`
- Container parent: `DIV.bloomreach-acquisition-popup-template.state-open`
- CSS: `position: fixed; z-index: 200; display: block`
- Contains: close button `button.popup__close#popup-close[aria-label="Close popup"]`, email capture form panel, progress dots.

**Dismiss pattern:**
```ts
// Wait for and dismiss Vans popup before any interaction
async dismissAcquisitionPopup(): Promise<void> {
  const popup = this.page.locator('#popup.popup.visible');
  if (await popup.isVisible({ timeout: 3000 }).catch(() => false)) {
    await this.elements.clickElement('#popup-close');
    await popup.waitFor({ state: 'hidden', timeout: 5000 });
  }
}
```

- This popup intercepts clicks on the cart icon and swatch selections — call `dismissAcquisitionPopup()` before any Vans interaction.
- The popup is a Bloomreach-managed web layer (`bloomreach-acquisition-popup-template`). It may not appear every visit (session-based). Always defensive-check with `isVisible({ timeout: 3000 })` before clicking close.
- Vans NZ likely has the same popup (same Bloomreach project config) — verify empirically before writing tests.

## 7. DataLayer / Analytics — Automation Utility

The `window.dataLayer` is available on all 8 sites and populated with structured data immediately on page load. Useful for assertion without DOM dependency:

```ts
// Get site info from dataLayer
const siteInfo = await page.evaluate(() => 
  window.dataLayer?.find(e => e?.default?.site)?.default?.site
);
// Returns: { name: "platypus au", currency: "AUD", division: "platypus", env: "stg", version: "..." }

// Get page type
const pageType = await page.evaluate(() =>
  window.dataLayer?.find(e => e?.default?.page)?.default?.page?.type
);
// Returns: "home", "category", "product", etc.

// Get login status
const loginStatus = await page.evaluate(() =>
  window.dataLayer?.find(e => e?.default?.user)?.default?.user?.login_status
);
// Returns: "guest" or "logged_in"
```

The `window.dataLayer[0].default.site.version` string format: `"magento_2.4.6-p15 | pwa_9.0.1 | gra_10.0.26.1"` — all 8 sites are on identical platform versions.

### DataLayer site codes (for test assertions)
| site.name | site.division | currency |
|---|---|---|
| "platypus au" | "platypus" | "AUD" |
| "platypus nz" | "platypus" | "NZD" |
| "skechers au" | "skechers" | "AUD" |
| "skechers nz" | "skechers" | "NZD" |
| "vans au" | "vans" | "AUD" |
| "vans nz" | "vans" | "NZD" |
| "dr martens au" | "drmartens" | "AUD" |
| "dr martens nz" | "drmartens" | "NZD" |

## 8. Cross-Site Patterns (applies to all 8 storefronts)

1. **GraphQL-only data layer** — no REST calls for storefront content. All page data from `{origin}/graphql`.
2. **GET-based GraphQL** — all operations use HTTP GET with URL-encoded query params, not POST. Route interception: `page.route('**/graphql?**', handler)`.
3. **Styled-components CSS** — all classes are hashed and unstable. Never target `sc-*` or dynamic hash classes.
4. **No service workers** — no SW registration on any site.
5. **No `<nav>` landmark** — menu is `<div>`-based. Use ARIA role selectors or text labels.
6. **No cookie consent banner** on staging — no dismissal step needed.
7. **No `data-testid`** — all element targeting via `aria-label`, `role`, `getByText`, `getByRole`.
8. **`<footer>` is lazy-rendered** — not in initial DOM. Wait before asserting.
9. **Forter fraud token** in localStorage on every page load — this fires a `cdn0.forter.com` prop.json request. Normal.
10. **Attraqt analytics** fires on every page to `collect-ap2.attraqt.io` — normal, non-blocking.
11. **Bazaarvoice reviews** loaded from `apps-stg.bazaarvoice.com` — staging BV client names: `platypusshoes-anz`, `drmartens-anz` (shared across AU/NZ per brand).
12. **Adobe Experience Platform** (AEP/RTCDP) active on all sites via `adobedc.demdex.net` — identity stitching runs on load.
13. **New Relic Browser Agent** active on all sites — `NRBA_SESSION::*` in localStorage. Session key differs per Magento `website_id`.
14. **Bloomreach A/B testing active** — experiments may show different UI variants between test runs. If tests are flaky due to UI variants, block the Bloomreach webxp bundle.
15. **TrueFit widget** present on Platypus AU, Skechers AU (confirmed), likely all AU brands. On staging it calls `consumer-dev.truefitcorp.com` which returns ERR_FAILED — generates console errors but does not block the page.
16. **Afterpay widget** present on Skechers (confirmed) and likely all brands that have it configured in `storeConfig.afterpay.isEnabledForProductPage`.
17. **`window.dataLayer`** populated immediately — reliable signal for page type, site identity, and user login status.
18. **Dual URL resolver pattern**: `ResolveURL` fires TWICE on navigation — once with legacy `urlResolver` and once with new `route` resolver. Normal behavior, not a race condition.
19. **`experience` value in dataLayer** = `"tablet"` on all sites during automated runs (Playwright default viewport triggers tablet breakpoint). This affects which layout is served.

## 9. Per-Brand Unique Quirks

### Platypus AU
- **FullStory session recording** active (`rs.fullstory.com`) — only Platypus AU confirmed. Sends page recordings.
- **TrueFit fails on staging**: `consumer-dev.truefitcorp.com` → `ERR_FAILED`. Console errors appear but page loads.
- **MENS PLP starts with socks** (non-footwear) — known gotcha, documented in [[ecommerce-storefronts]].
- **Adobe collect endpoint**: `smetrics.platypusshoes.com.au` — brand-specific subdomain.
- **Bazaarvoice client**: `platypusshoes-anz` (shared with NZ).

### Platypus NZ
- Identical stack to AU, different currency (NZD).
- Bazaarvoice same client `platypusshoes-anz`.
- **No WOMENS nav link** — confirmed in [[ecommerce-storefronts]].

### Skechers AU / NZ
- **8–14 empty `<h1>` elements** on homepage from PageBuilder banners — all empty text. Do NOT assert h1 on Skechers homepages.
- Skechers NZ had 1 visible h1: "SPEND & SAVE" (promo banner).
- Cart button styled-component hash `sc-bTMaZy` (different from Vans/DRM).
- Bazaarvoice client name not confirmed (different from platypusshoes-anz / drmartens-anz).
- `preferMens: true` for test navigation — see [[ecommerce-storefronts]].

### Vans AU / NZ
- **Bloomreach acquisition popup** — `#popup.popup.visible` at `z-index: 200`, position fixed. **Must dismiss before any interaction.** See section 6.
- Cart button hash `sc-bVDfoq hZznSc` (shared with Dr. Martens).
- OUTLET nav label (not SALE) on Vans AU.
- Vans AU CLOTHING is a dropdown trigger, not a navigable link.
- `preferMens: false` for Vans AU; `preferMens: true` for Vans NZ.

### Dr. Martens AU / NZ
- Cart button hash `sc-bVDfoq hZznSc` (shared with Vans).
- **Gallery images**: `alt="image-product"` — see [[ecommerce-pdp-page-gotchas]].
- **Dual h1 on PDP** — see [[ecommerce-pdp-page-gotchas]].
- **`getTotalProductCount()` returns 0** on DRM AU — open investigation, `<p>` regex doesn't match DRM AU format.
- Bloomreach project ID different from Platypus AU: `9b76b50a-6e0f-11f0-8ce6-3abf387c99ab`.
- Bazaarvoice client: `drmartens-anz` (shared AU/NZ).
- `NRBA_SESSION` New Relic key: `NRBA_SESSION::cba16a23` (DRM-specific website_id hash).
- DRM AU/NZ do **not** have `com.adobe.reactor.core.visitorTracking.sessionCount` in localStorage (Platypus/Skechers/Vans do) — indicates DRM uses a different Adobe Launch configuration.

## 10. Recommended Automation Patterns

### Route blocking to reduce noise and flakiness
```ts
// In beforeEach or page object setup for cleaner runs:
await page.route('**/truefitcorp.com/**', r => r.abort());       // TrueFit fails on staging anyway
await page.route('**/fullstory.com/**', r => r.abort());         // Session recording
await page.route('**/analytics.google.com/**', r => r.abort());  // GA4
await page.route('**/googleadservices.com/**', r => r.abort());  // Google Ads
await page.route('**/demdex.net/**', r => r.abort());            // Adobe audience
await page.route('**/facebook.com/tr**', r => r.abort());        // Facebook Pixel
await page.route('**/taboola.com/**', r => r.abort());           // Taboola ads
await page.route('**/paypal.com/**', r => r.abort());            // PayPal widget (loads even before checkout)
```

These routes do not affect page content — blocking them speeds up load and prevents timing issues from slow third-party calls.

### GraphQL interception pattern
```ts
// Intercept a specific operation
await page.route('**/graphql?**operationName=getStoreConfigData**', async route => {
  const response = await route.fetch();
  await route.fulfill({ response });
});

// Mock a specific operation
await page.route('**/graphql?**operationName=customerCart**', async route => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: { customerCart: { id: 'mock-cart-id', items: [] } } }),
  });
});
```

### Waiting for GraphQL-hydrated content
```ts
// Wait for a specific GraphQL operation to complete before asserting
await page.waitForResponse(r => 
  r.url().includes('/graphql') && 
  r.url().includes('operationName=GetCmsPage') && 
  r.status() === 200
);
```

### Stable cart button selector (all 8 sites)
```ts
// In page object - class field
private readonly cartButton = this.page.locator('[aria-label*="cart" i]');
// or
private readonly cartButton = this.page.getByRole('button', { name: /toggle mini cart/i });
```

### Adobe Client Data Layer (ACDL) — preferred over raw dataLayer scan

The `window.dataLayer` is actually **Adobe Client Data Layer 2.0.2**. ACDL exposes a dedicated
`getState()` API that returns the current merged state — no array scanning needed:

```ts
// Preferred: ACDL getState() — merged current state, no array scan
const state = await this.page.evaluate(() => (window as any).adobeDataLayer?.getState?.());
// Returns: { default: { site: {...}, page: {...}, user: {...}, ... } }

// Fallback: array scan (still works if adobeDataLayer API unavailable)
const state = await this.page.evaluate(() =>
  (window as any).dataLayer?.find((e: any) => e?.default?.site)
);
```

### DataLayer assertion for page type validation
```ts
async assertPageType(expectedType: 'home' | 'category' | 'product' | 'cart'): Promise<void> {
  const pageType = await this.page.evaluate(() => {
    const state = (window as any).adobeDataLayer?.getState?.();
    return state?.default?.page?.type
      ?? (window as any).dataLayer?.find((e: any) => e?.default?.page)?.default?.page?.type;
  });
  expect(pageType).toBe(expectedType);
}
```

### Site identity assertion
```ts
async assertSiteIdentity(expectedDivision: string, expectedCurrency: string): Promise<void> {
  const site = await this.page.evaluate(() => {
    const state = (window as any).adobeDataLayer?.getState?.();
    return state?.default?.site
      ?? (window as any).dataLayer?.find((e: any) => e?.default?.site)?.default?.site;
  });
  expect(site?.division).toBe(expectedDivision);
  expect(site?.currency).toBe(expectedCurrency);
}
```

### Swiper carousel / gallery selectors (stable across all sites)

Carousels and PDP image galleries use **Swiper.js** — its class names are stable (not hashed):

```ts
// PDP gallery — stable Swiper selectors (supplement to alt-based DRM selectors)
private readonly gallerySlides = this.page.locator('.swiper-slide img[alt*="product" i], .swiper-slide img[alt*="image" i]');
private readonly galleryNextBtn = this.page.locator('.swiper-button-next');
private readonly galleryPrevBtn = this.page.locator('.swiper-button-prev');

// Wait for gallery to be ready
await page.waitForSelector('.swiper-slide:not(.swiper-slide-duplicate)', { state: 'visible' });

// Click next slide
await this.elements.clickElement('.swiper-button-next');
```

Swiper class reference:
| Class | Purpose |
|---|---|
| `.swiper-container` / `.swiper` | Root wrapper |
| `.swiper-wrapper` | Slide track |
| `.swiper-slide` | Individual slide |
| `.swiper-slide-active` | Currently visible slide |
| `.swiper-slide-duplicate` | Looped clone (exclude from count) |
| `.swiper-button-next` / `.swiper-button-prev` | Navigation arrows |
| `.swiper-pagination-bullet-active` | Active dot indicator |

### Skechers h1-safe heading assertion
```ts
// WRONG - will return empty string or unreliable on Skechers
await expect(page.locator('h1')).toBeVisible();

// CORRECT - check page title or section heading instead
await expect(page).toHaveTitle(/skechers/i);
// or use h2 for visible content headings
await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();
```

### Vans popup dismissal (required before any Vans interaction)
```ts
// Add to EcommerceHomePage or VansSpecificPage
async dismissAcquisitionPopupIfPresent(): Promise<void> {
  const popup = this.page.locator('#popup.popup.visible');
  try {
    await popup.waitFor({ state: 'visible', timeout: 3000 });
    await this.elements.clickElement('#popup-close');
    await popup.waitFor({ state: 'hidden', timeout: 5000 });
  } catch {
    // Popup not shown (e.g., already dismissed in this session)
  }
}
```

## 11. Console Error Baseline

On load, expect these console errors/warnings on ALL sites (do not fail tests on these):

| Error | Source | Notes |
|---|---|---|
| `net::ERR_FAILED` on `truefitcorp.com` | TrueFit staging not reachable | Block the route to suppress |
| CSP violations | Third-party scripts | Non-blocking, cosmetic |
| React `key` prop warnings | PageBuilder components | Known PWA Studio issue |

Error counts observed: Platypus (14 errors, 6 warnings after load), Skechers (4–6 errors), Vans (7–9 errors), DRM (6 errors). All are third-party / PWA warnings, not application logic errors.

---

*Supersedes any prior storefront tech notes. Cross-reference [[ecommerce-storefronts]] for nav labels and [[ecommerce-pdp-page-gotchas]] for PDP-specific patterns.*
