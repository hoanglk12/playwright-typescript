# E2E Flow Discovery Report — Agent Implementation Brief

> Exported from: E2E-Discovery-Report.pdf (March 20, 2026); audited and reconciled against the live repo and a live read-only GraphQL `storeConfig` query on 2026-09-14.
> Purpose: Full context for QA agents to plan, build, and verify automation across 8 e-commerce storefronts.
> Total scenarios documented: 164 unique scenario IDs (151 active, 13 retired) across 17 feature areas.
> Sites covered: 8 storefronts (Platypus, Skechers, Vans, Dr. Martens — AU + NZ each). Navigation and feature config for all 8 is defined in `src/data/ecommerce/storefronts.ts` — treat it as the source of truth rather than this document.

---

## Sites Under Analysis

| # | Site | URL | Brand | Market |
|---|---|---|---|---|
| 1 | Platypus AU | https://stag-platypus-au.accentgra.com | Platypus Shoes | Australia (AUD) |
| 2 | Platypus NZ | https://stag-platypus-nz.accentgra.com | Platypus Shoes | New Zealand (NZD) |
| 3 | Skechers AU | https://stag-skechers-au.accentgra.com | Skechers | Australia (AUD) |
| 4 | Skechers NZ | https://stag-skechers-nz.accentgra.com | Skechers | New Zealand (NZD) |
| 5 | Vans AU | https://stag-vans-au.accentgra.com | Vans | Australia (AUD) |
| 6 | Vans NZ | https://stag-vans-nz.accentgra.com | Vans | New Zealand (NZD) |
| 7 | Dr. Martens AU | https://stag-drmartens-au.accentgra.com | Dr. Martens | Australia (AUD) |
| 8 | Dr. Martens NZ | https://stag-drmartens-nz.accentgra.com | Dr. Martens | New Zealand (NZD) |

**Tech stack:** Adobe Commerce (Magento) with a custom PWA-style storefront. Modal-based login/cart. Zendesk chat. Adobe DTM analytics.

**Critical revenue path:** Homepage → PLP → PDP → Add to Cart → Mini Cart → Checkout → Order Confirmation

---

## 1. Key Regional Differences (Critical for Localization Tests)

> Derived from `src/data/ecommerce/storefronts.ts` (`hasQantasPoints`, `navLinks`, `*NavLabel`, `loyaltyProgramName`) where the field exists. Fields not modeled in `storefronts.ts` (BNPL availability, free-shipping threshold, Zendesk chat presence, Spend & Save) are not tracked per-storefront in the framework — verify directly against the live site if a scenario depends on them, then add the field to `storefronts.ts` rather than re-documenting it here.

| Feature | Platypus AU | Platypus NZ | Skechers AU | Skechers NZ | Vans AU | Vans NZ | Dr. Martens AU | Dr. Martens NZ |
|---|---|---|---|---|---|---|---|---|
| Currency | AUD | NZD | AUD | NZD | AUD | NZD | AUD | NZD |
| Qantas Points | Yes | No | Yes | No | Yes | No | Yes | No |
| Loyalty Program | Kicks Club | Kicks Club | Not present on staging | Not present on staging | Not configured on staging | Not configured on staging | Not configured on staging | Not configured on staging |
| WOMENS/WOMEN nav | Yes | No (excluded — no women's link) | Yes | Yes | Yes | Yes | Yes | Yes |
| CLOTHING nav | No | No | Yes | No | Dropdown trigger only, no `<a>` — not testable as a nav link | Dropdown trigger only, no `<a>` — not testable as a nav link | No | No |
| PRESALE nav | Yes | Yes | No | No | No | No | No | No |
| BRANDS nav | Yes | Yes | No | No | No | No | No | No |
| Spend & Save promo | No | No | No | Yes | Not confirmed | Not confirmed | Not confirmed | Not confirmed |
| BNPL (Afterpay/PayPal) | Yes | Yes | Yes | Yes | Not confirmed | Not confirmed | Not confirmed | Not confirmed |
| Free shipping threshold | $150 | $150 | $150 | $150 | Not confirmed | Not confirmed | Not confirmed | Not confirmed |
| Zendesk chat | inferred | inferred | Yes | Yes | Not confirmed | Not confirmed | Not confirmed | Not confirmed |

---

## 2. Consolidated Feature Inventory

> Merged from the previously separate 4-site tables. Rows proven by an automated spec that loops over all 8 `storefronts.ts` entries are marked `Yes` for every site; rows without such coverage keep the original per-brand knowledge and mark `Not confirmed` where no source exists.

| Module | Platypus AU | Platypus NZ | Skechers AU | Skechers NZ | Vans AU | Vans NZ | Dr. Martens AU | Dr. Martens NZ |
|---|---|---|---|---|---|---|---|---|
| Homepage hero + banners | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Top bar with promos | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Qantas Points integration | Yes | No | Yes | No | Yes | No | Yes | No |
| Navigation menu | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Search (inline) | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Wishlist page | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Account modal (login/register) | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Mini cart overlay | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| PLP with filters + sort | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| PLP Quick Add | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| PDP with variants | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Size selector + size chart | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| "What's My Size?" widget | Yes | inferred | inferred | inferred | Not confirmed | Not confirmed | Not confirmed | Not confirmed |
| Find in Store | Yes | Yes | inferred | inferred | Not confirmed | Not confirmed | Not confirmed | Not confirmed |
| Afterpay / BNPL messaging | Yes | Yes | Yes | Yes | Not confirmed | Not confirmed | Not confirmed | Not confirmed |
| Track Order (guest) | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Stores locator | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Help center | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| PRESALE category | Yes | Yes | No | No | No | No | No | No |
| BRANDS directory | Yes | Yes | No | No | No | No | No | No |
| CLOTHING category | No | No | Yes | No | Dropdown only — not a confirmed distinct category page | Dropdown only — not a confirmed distinct category page | No | No |
| Spend & Save promo | No | No | No | Yes | Not confirmed | Not confirmed | Not confirmed | Not confirmed |
| Vimeo product video | Yes | inferred | inferred | inferred | Not confirmed | Not confirmed | Not confirmed | Not confirmed |
| Product ratings/reviews (**Bazaarvoice**) | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| 404 error page | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |

**Bazaarvoice note:** confirmed live via a read-only GraphQL `storeConfig` query against all 8 storefronts — `bazaarvoice_enabled`, `ratings_and_reviews_enabled`, `submission_container_page_enabled`, and `questions_and_answers_enabled` are all `true`, environment `staging`. Reviews are product-level (`filter_reviews_on_configurable_product_selection: false`), not per color-variant. Because Bazaarvoice renders client-side after hydration, any review/Q&A scenario must poll/wait rather than assert on initial page load — see §7.26 below.

---

## 3. Test Constraints — Agents Must Know These

1. **Checkout flow** requires items in cart first; empty cart redirects to homepage. Cart operations use **GraphQL** (`GraphQLClient` — `createEmptyCart`, `addProductsToCart` mutations), not the Magento REST cart API — see `tests/api/gra-cart-minicart.spec.ts` for the confirmed pattern to seed a cart before checkout tests.
2. **Authentication** uses a modal overlay. The Magento URL `/customer/account/login` returns a 404. All login tests must trigger the **header account icon**, not navigate directly to a URL.
3. **Loyalty programs** (Kicks Club / Skechers Insider) may require dedicated test accounts and promo sandbox data.
4. **Qantas Points** is AU-only — confirmed per-storefront via `hasQantasPoints` in `storefronts.ts`.
5. **Payment flow** — guest checkout via PayPal (Braintree sandbox) and Credit Card (Braintree sandbox Visa) is automated end-to-end today (`E2E-PLAORD-001`, `E2E-PLAORD-003`; logged-in PayPal via `E2E-PLAORD-002`). Logged-in Credit Card (`E2E-PLAORD-004`) and Afterpay guest/logged-in (`E2E-PLAORD-005`/`006`) are not yet automated. Sandbox credentials are sourced from `src/data/ecommerce/payment-accounts.ts` / `.env.staging` — never hardcode them in this document or in specs.
6. **"What's My Size?" and BNPL widgets** are third-party iframes — cross-origin restrictions limit automation. Assert presence of the iframe (via `this.frames` / `FrameHelper`), not content inside.
7. **Presale products** are data-driven and time-limited — avoid using them in stable regression tests. Use standard in-stock products.
8. **Spend & Save** (Skechers NZ) is basket-threshold triggered ($110/$170/$200). Whether the discount applies at cart or order level is still an open product-team question — see Open Question #3 and `E2E-CHKOUT-010` (Blocked).
9. **Find in Store** requires geo data / store inventory API — assert button visibility only.
10. **ServiceWorker registration failures** have been observed in the browser console on some storefronts. `serviceWorkers` is **not currently configured** in `playwright.config.ts` — disabling it is a recommendation for future hardening, not something already in place. Today's actual mitigation is `consoleHelper` (auto-fixture, `src/pages/helpers/console-helper.ts`), which captures console errors/page errors/failed requests and attaches them on UI test failure.
11. **Vimeo video embeds** are third-party iframes — assert the iframe is present, do not attempt playback automation.
12. **StarTrack tracking** in Track Order is third-party — only the form submission step is automatable.

---

## 4. Framework Architecture — See Root `CLAUDE.md`

The proposed folder structure and page-object list from the original PDF export did not match the implemented framework (wrong file names, wrong class names, an assumed REST-first API layer, mobile/webkit projects that don't exist). Rather than re-describing architecture here and risking it going stale again, **root `CLAUDE.md` is the authority** for:

- Composition-based Page Object Model (`BasePage` + 11 helper instances — `this.waits`, `this.elements`, `this.style`, `this.frames`, `this.files`, `this.storage`, `this.network`, `this.tables`, `this.tabs`, `this.dom`, `this.overlays`)
- Fixture registration in `src/config/base-test.ts`
- Path aliases (`@pages/*`, `@tests/*`, `@utils/*`, `@config/*`, `@data/*`)

**Real folder layout for ecommerce coverage** (for orientation only — see `CLAUDE.md` for the authoritative rules):

```
tests/ecommerce/
  smoke/          homepage-smoke.spec.ts, navigation-smoke.spec.ts, search-smoke.spec.ts,
                  plp-smoke.spec.ts, pdp-smoke.spec.ts, cart-smoke.spec.ts, auth.spec.ts,
                  localization-smoke.spec.ts, error-handling-smoke.spec.ts, utilities-smoke.spec.ts,
                  checkout-address-prefill.spec.ts
  regression/     checkout.spec.ts, search.spec.ts, paypal-checkout.spec.ts, creditcard-checkout.spec.ts,
                  checkout-helpers.ts
  integration/    add-to-cart-integration.spec.ts, integration-helpers.ts
  accessibility/  accessibility-smoke.spec.ts

src/pages/ecommerce/
  home-page.ts, navigation-page.ts, search-page.ts, plp-page.ts, pdp-page.ts,
  cart-overlay-page.ts, account-modal.ts, error-page.ts, checkout-page.ts,
  track-order-page.ts, help-support-page.ts, wishlist-page.ts, my-details-page.ts

src/data/ecommerce/
  storefronts.ts (single source of truth for site config), test-accounts.ts,
  payment-accounts.ts, card-payment-data.ts
```

Real page-object classes are `Ecommerce*Page` (e.g. `EcommerceWishlistPage`, `EcommerceMyDetailsPage`, `EcommerceAccountModalPage`), all extending `BasePage` — **not** `BaseCommercePage`/`AccountModal`/`PLPPage` as previously documented.

---

## 5. Page Object Methods — See Root `CLAUDE.md`

The prior "Required Core API" table listed a plausible-looking but non-existent API (`BaseCommercePage`, `AccountModal`, `PLPPage`, `PDPPage`, `CartOverlay`, `CheckoutPage` with invented method names). The real methods live on the `Ecommerce*Page` classes registered as fixtures in `base-test.ts` (see `CLAUDE.md`'s fixture table) and are implemented using the 11 `BasePage` helpers — never `page.locator()`/`page.click()` directly. Selector strategy is unchanged and still correct:

1. `getByRole()` — first choice
2. `getByLabel()`, `getByPlaceholder()`, `getByText()`
3. `getByTestId()` (data-testid)
4. CSS selector — last resort only (or when required for `this.style.*` computed-style reads)

---

## 6. Multi-Site Execution — Real Pattern

There is **no per-site Playwright project** (`platypus-au`, `skechers-nz`, etc.) — `playwright.config.ts` defines only two UI projects, `chromium` and `firefox` (mobile/webkit projects are present but commented out). Multi-site coverage instead comes from each spec looping over `storefronts` from `src/data/ecommerce/storefronts.ts`:

```ts
import { storefronts } from '@data/ecommerce/storefronts';

for (const [index, site] of storefronts.entries()) {
  const tcId = `E2E-HOME-001-${String(index + 1).padStart(3, '0')}`;
  test(`${tcId} - ${site.name} ...`, async ({ ecommerceHomePage }) => {
    await ecommerceHomePage.navigate(site.url);
    // ...
  });
}
```

Per-brand parallelism does exist, but only for the **API** suite: `api.config.ts` defines 8 GRA brand+region projects (`pla-au`, `skx-au`, `drm-au`, `van-au`, `pla-nz`, `skx-nz`, `drm-nz`, `van-nz`), run via `npm run test:api:gra`. Adding a new storefront to UI coverage means adding one entry to `storefronts.ts`, not a new Playwright project or `.env` URL pair.

---

## 7. Recommended Automation Scope

### Priority Legend
- **P1** = Critical revenue/business flow
- **P2** = Important regression
- **P3** = Nice-to-have

### Automation Legend
- **A1** = Automate immediately (Phase 1)
- **A2** = Automate later (Phase 2)
- **M** = Keep manual

### Automation Status Legend
- **Automated** = implemented and running today (verified via `test(...)`/`tcId` grep against `tests/`)
- **Planned** = approved for automation, not yet implemented
- **Blocked** = cannot proceed yet; the blocker is stated inline
- **Retired** = superseded (duplicate) or a reserved numbering gap; row is kept for traceability and must not be reused

---

## Phase 1 — Automate Immediately (Smoke + Critical Path)

~42 scenarios × 8 sites = **~336 test executions**

### 7.1 Homepage

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-HOME-001 | Homepage loads with correct title and hero banner | P1 | All | Automated |
| E2E-HOME-002 | Top bar promotional message is visible | P2 | All | Automated |
| E2E-HOME-003 | Qantas Points link is visible on AU sites only (absent on NZ) | P2 | All | Automated |

**Sample — E2E-HOME-001:**
- Preconditions: Staging env accessible, no auth required
- Steps: Navigate to site root `/` → wait for page title → assert hero banner visible above fold
- Expected: Page title includes brand name; hero banner visible

**Sample — E2E-HOME-003 (localization check):**
- Steps: Navigate to AU site root → assert Qantas link visible. Navigate to NZ site root → assert Qantas link absent.
- Data note: `storefronts.ts` `hasQantasPoints` drives the expected outcome per site.

---

### 7.2 Navigation

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-NAV-001 | All top-nav links render and are clickable | P1 | All | Automated |
| E2E-NAV-002 | WOMENS/WOMEN link navigates to womens PLP | P1 | All | Automated |
| E2E-NAV-003 | MENS link navigates to mens PLP | P1 | All | Automated |
| E2E-NAV-004 | KIDS link navigates to kids PLP | P1 | All | Automated |
| E2E-NAV-005 | SALE link navigates to sale PLP | P1 | All | Automated |
| E2E-NAV-009 | Logo click returns to homepage from any page | P1 | All | Automated |

**Implementation note:** `navigation-smoke.spec.ts` implements NAV-002/003/004/005 as per-category, site-indexed IDs (`E2E-NAV-W*`, `E2E-NAV-M*`, `E2E-NAV-K*`, `E2E-NAV-S*`) rather than the flat IDs above — the flat ID here denotes the scenario, not a literal string you'll find in a test title.

---

### 7.3 Search

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-SRCH-001 | Search returns results for a known product | P1 | All | Automated |
| E2E-SRCH-006 | Clicking search icon or pressing Enter submits search | P1 | All | Automated |

**Data note:** `storefronts.ts` `searchTerm` provides a per-site term confirmed to return results (e.g. `'Nike'` for Platypus, `'Go Walk'` for Skechers).

---

### 7.4 Product Listing Page (PLP)

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-PLP-001 | PLP loads with product grid visible | P1 | All | Automated |
| E2E-PLP-004 | Filter by Category reduces product count | P1 | All | Automated |
| E2E-PLP-006 | Filter by Size reduces product count | P1 | All | Automated |
| E2E-PLP-011 | Quick Add button opens size selector or adds item | P1 | All | Automated |
| E2E-PLP-012 | Clicking product card image navigates to PDP | P1 | All | Automated |

---

### 7.5 Product Detail Page (PDP)

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-PDP-001 | PDP loads with product name, price, and image gallery | P1 | All | Automated |
| E2E-PDP-002 | Colour swatch selection updates product images | P1 | All | Automated |
| E2E-PDP-004 | Size selector shows correct sizes (US MENS/WOMENS toggle) | P1 | All | Automated |
| E2E-PDP-005 | Selecting a size enables Add to Cart button | P1 | All | Automated |
| E2E-PDP-006 | Add to Cart without selecting size shows validation message | P1 | All | Automated |
| E2E-PDP-007 | Add to Cart adds item and updates mini cart count | P1 | All | Automated |

**Agent note on E2E-PDP-006:** Button may be disabled OR may show an error toast — confirm behaviour per site before asserting specific message text.

---

### 7.6 Cart

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-CART-001 | Mini cart shows 0 items when empty | P1 | All | Automated |
| E2E-CART-002 | Mini cart shows item count after Add to Cart | P1 | All | Automated |
| E2E-CART-003 | Mini cart overlay opens on cart icon click | P1 | All | Automated |
| E2E-CART-004 | Mini cart shows product name, size, price | P1 | All | Automated |
| E2E-CART-005 | Removing item from mini cart decrements count | P1 | All | Automated |
| E2E-CART-008 | Cart total updates correctly | P1 | All | Automated |
| E2E-CART-009 | *(reserved — never assigned)* | — | — | Retired — ID gap, not reused |
| E2E-CART-011 | Empty cart state renders "Your Shopping Cart is empty" | P2 | All | Automated |

---

### 7.7 Authentication

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-AUTH-001 | Login modal opens via account icon in header | P1 | All | Automated |
| E2E-AUTH-002 | Successful login with valid credentials | P1 | All | Automated |
| E2E-AUTH-003 | Failed login with invalid password shows error | P1 | All | Automated |
| E2E-AUTH-004 | Failed login with non-existent email shows error | P1 | All | Automated |
| E2E-AUTH-006 | *(reserved — never assigned)* | — | — | Retired — ID gap, not reused |
| E2E-AUTH-010 | Logout clears session and redirects | P1 | All | Automated |
| E2E-AUTH-011 | Login modal title matches brand | P2 | All | Automated |

**Constraint:** Login modal is triggered by the header account icon, NOT by navigating to `/customer/account/login` (returns 404).

**Data note:** `test-accounts.ts` exports one stable account per brand (`testAccounts`, all 8 sites) via `GRA_TEST_PASSWORD`, plus `invalidCredentials` and `nonExistentCredentials` maps. Loaded from `.env.staging`.

---

### 7.8 Localization

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-LOC-001 | AU site displays AUD prices | P1 | Platypus AU, Skechers AU | Automated |
| E2E-LOC-002 | NZ site displays NZD prices | P1 | Platypus NZ, Skechers NZ | Automated |
| E2E-LOC-003 | AU sites show Qantas Points; NZ sites do not | P2 | All | Retired — duplicate of E2E-HOME-003 |
| E2E-LOC-004 | Skechers AU has CLOTHING nav; Skechers NZ does not | P2 | Skechers AU, Skechers NZ | Retired — duplicate of E2E-NAV-007 |
| E2E-LOC-007 | Correct brand name / loyalty program name per site | P2 | All | Automated |

> **Discrepancy flagged during this audit (not resolved here):** E2E-LOC-004 has a real, passing automated test (`localization-smoke.spec.ts`) checking CLOTHING nav presence per region; E2E-NAV-007, the scenario it's retired in favor of per the approved plan, has **no** automated test yet. The retirement direction above follows the approved research exactly, but before any spec file is touched, confirm with the team whether `E2E-NAV-007` should absorb `localization-smoke.spec.ts`'s existing coverage or whether the two IDs should stay separate. E2E-LOC-003 has the same duplicate-automated-test situation relative to E2E-HOME-003, with no such ambiguity — both check the identical condition, so consolidating is unambiguously safe.

---

### 7.9 Error Handling

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-ERR-001 | 404 page shows correct brand error UI with "Back to Home" | P1 | All | Automated |
| E2E-ERR-003 | Add to Cart without size selection shows validation | P1 | All | Retired — duplicate of E2E-PDP-006 |
| E2E-ERR-005 | Login with wrong password shows error | P1 | All | Retired — duplicate of E2E-AUTH-003 |
| E2E-ERR-006 | Checkout required fields blank shows validation | P1 | All | Retired — duplicate of E2E-CHKOUT-003 |

---

### 7.10 Utilities

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-UTIL-001 | Track Order page loads and form is present | P1 | All | Automated |
| E2E-UTIL-002 | *(reserved — never assigned)* | — | — | Retired — ID gap, not reused |
| E2E-UTIL-005 | Help/Support page accessible via header link | P2 | All | Automated |
| E2E-UTIL-007 | Wishlist page renders (empty state for guest) | P2 | All | Automated — also aliased as `E2E-WISH-001` (§7.25); this remains the canonical ID, do not rename the underlying test |

---

## Phase 2 — Automate Later (High-Value Regression)

Requires additional setup: GraphQL cart seeding, test account credentials per site.

### 7.11 Homepage (Phase 2)

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-HOME-004 | Carousel navigates forward/backward with dot pagination | P2 | All | Planned |
| E2E-HOME-005 | Quick-link category tiles navigate to correct PLP | P2 | All | Planned |
| E2E-HOME-006 | Homepage product tiles link to correct PDPs | P2 | All | Planned |
| E2E-HOME-007 | Free shipping threshold banner is displayed correctly | P3 | All | Planned |

---

### 7.12 Navigation (Phase 2)

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-NAV-006 | BRANDS link navigates to brands page (Platypus only) | P2 | Platypus AU, Platypus NZ | Planned |
| E2E-NAV-007 | CLOTHING link navigates to clothing PLP (Skechers AU only) | P2 | Skechers AU | Planned — see discrepancy note under §7.8 |
| E2E-NAV-008 | PRESALE link navigates to presale PLP (Platypus only) | P2 | Platypus AU, Platypus NZ | Planned |
| E2E-NAV-010 | Breadcrumbs on PDP are correct and navigable | P2 | All | Planned |

---

### 7.13 Search (Phase 2)

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-SRCH-002 | Search input placeholder text is correct per brand | P2 | All | Automated |
| E2E-SRCH-003 | Search with empty term shows appropriate feedback | P2 | All | Automated |
| E2E-SRCH-004 | Search for non-existent term shows no-results state | P2 | All | Planned |
| E2E-SRCH-005 | Search autocomplete/suggestions appear while typing | P2 | All | Automated |

**Data note:** `storefronts.ts` `searchPlaceholder` carries the per-brand placeholder text (e.g. Platypus = `"Find products, colours, fits..."`, Skechers/Vans/Dr. Martens = `"What are you looking for?"`).

---

### 7.14 PLP (Phase 2)

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-PLP-002 | Product card shows brand, name, price, colour swatches | P2 | All | Planned |
| E2E-PLP-003 | Sale badge renders correctly on qualifying products | P2 | All | Planned |
| E2E-PLP-005 | Filter by Silhouette/Style reduces product count | P2 | All | Planned |
| E2E-PLP-007 | Filter by Colour reduces product count | P2 | All | Planned |
| E2E-PLP-008 | Multiple filters can be applied simultaneously | P2 | All | Planned |
| E2E-PLP-009 | Sort options work (Most popular default) | P2 | All | Planned |
| E2E-PLP-010 | Wishlist heart icon toggles on product card | P2 | All | Planned — see also E2E-WISH-003 (§7.25) |
| E2E-PLP-013 | Gender sub-tabs on Sale page filter correctly (Skechers) | P2 | Skechers AU, Skechers NZ | Planned |
| E2E-PLP-014 | Product count reflects applied filters | P2 | All | Planned |
| E2E-PLP-015 | Clearing all filters restores full product count | P2 | All | Planned |

---

### 7.15 PDP (Phase 2)

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-PDP-003 | Colour swatch links navigate to correct variant URL | P2 | All | Automated |
| E2E-PDP-008 | Afterpay split payment message shows correct instalment | P2 | All | Planned |
| E2E-PDP-009 | Qantas Points earn message shows on AU sites | P2 | AU sites only | Planned |
| E2E-PDP-010 | Kicks Club / Skechers Insider CTA is visible | P2 | All | Planned |
| E2E-PDP-011 | Star rating and review count are displayed | P3 | All | Planned — see also E2E-REV-001 (§7.26) |
| E2E-PDP-012 | *(reserved — never assigned)* | — | — | Retired — ID gap, not reused |
| E2E-PDP-013 | Size Chart link opens size guide | P2 | All | Planned |
| E2E-PDP-014 | "What's My Size?" widget loads (iframe present) | P3 | All | Planned |
| E2E-PDP-015 | *(reserved — never assigned)* | — | — | Retired — ID gap, not reused |
| E2E-PDP-016 | Wishlist toggle works on PDP | P2 | All | Planned — see also E2E-WISH-002 (§7.25) |
| E2E-PDP-017 | Product video (Vimeo iframe) loads on applicable PDPs | P3 | Platypus AU | Planned |
| E2E-PDP-018 | Breadcrumb trail is correct (Home / Brand / Category) | P2 | All | Planned |
| E2E-PDP-019 | BUY 2 GET 20% OFF badge visible on qualifying products | P2 | All | Planned |

---

### 7.16 Cart (Phase 2)

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-CART-006 | "Continue Shopping" button closes cart overlay | P2 | All | Automated |
| E2E-CART-007 | Adding same product in different size creates separate line item | P2 | All | Automated |
| E2E-CART-010 | Promo/discount code field is visible at cart page | P1 | All | Automated |

---

### 7.17 Checkout (Phase 2 — requires cart seeding via GraphQL)

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-CHKOUT-001 | Checkout page loads after items added to cart | P1 | All | Automated |
| E2E-CHKOUT-002 | Guest checkout: email entry step is presented | P1 | All | Automated |
| E2E-CHKOUT-003 | Shipping address form: all required fields validated | P1 | All | Automated |
| E2E-CHKOUT-004 | Shipping method selection updates order total | P1 | All | Automated |
| E2E-CHKOUT-005 | *(reserved — never assigned)* | — | — | Retired — ID gap, not reused |
| E2E-CHKOUT-006 | Order review step shows correct items, quantities, total | P1 | All | Automated |
| E2E-CHKOUT-007 | Promo code accepted reduces order total | P1 | All | Planned |
| E2E-CHKOUT-008 | Invalid promo code shows error message | P2 | All | Automated |
| E2E-CHKOUT-009 | Logged-in checkout pre-fills saved address | P2 | All | Automated (spec exists) — excluded from CI: `playwright.config.ts` chromium project `testIgnore`s `checkout-address-prefill.spec.ts` (region-combobox selector unconfirmed on 3/6 storefronts) |
| E2E-CHKOUT-010 | Spend & Save discount applies at threshold (Skechers NZ only) | P1 | Skechers NZ | Blocked — pending product-team confirmation of whether the threshold applies at cart or order level (Open Question #3) |
| E2E-CHKOUT-011 | Order confirmation page shows order number | P1 | All | Planned |
| E2E-CHKOUT-012 | Empty cart redirects away from checkout | P2 | All | Planned |
| E2E-CHKOUT-013 | Free shipping threshold ($150) applied correctly | P2 | All | Planned |
| E2E-CHKOUT-014 | Required field validation on shipping form | P2 | All | Planned |
| E2E-CHKOUT-015 | Cross-site currency: AUD on AU, NZD on NZ | P2 | All | Planned |

> **Follow-up (not resolved here):** `E2E-CHKOUT-003` ("Shipping address form: all required fields validated") and `E2E-CHKOUT-014` ("Required field validation on shipping form") read as the same scenario. The approved research plan did not include this pair in its duplicate list, so neither is retired here — flagging it for the team to decide in a future pass rather than retiring `E2E-CHKOUT-014` on this agent's own authority.

**Cart seeding pattern (GraphQL, replaces the previous REST snippet):**
```ts
// See tests/api/gra-cart-minicart.spec.ts for the full pattern
const { data } = await graphqlClient.mutateWrapped(CREATE_EMPTY_CART_MUTATION); // createEmptyCart
const cartId = data.createEmptyCart;
await graphqlClient.mutateWrapped(ADD_PRODUCTS_TO_CART_MUTATION, { cartId, sku: TestProducts.stableSkuPlatypusAU, quantity: 1 }); // addProductsToCart
```

---

### 7.18 Place Order

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-PLAORD-001 | Place order via Paypal using guest user | P1 | All | Automated |
| E2E-PLAORD-002 | Place order via Paypal using logged-in user | P1 | All | Automated |
| E2E-PLAORD-003 | Place order via Credit Card using guest user | P1 | All | Automated |
| E2E-PLAORD-004 | Place order via Credit Card using logged-in user | P1 | All | Planned |
| E2E-PLAORD-005 | Place order via Afterpay using guest user | P1 | All | Planned |
| E2E-PLAORD-006 | Place order via Afterpay using logged-in user | P1 | All | Planned |

**Sandbox payment credentials** are sourced from `src/data/ecommerce/payment-accounts.ts` (PayPal, via `PAYPAL_SANDBOX_PASSWORD`) and `src/data/api/gra-braintree-payment-data.ts` (`generateSandboxVisa()` for card numbers) / `.env.staging` — **never hardcode them in this document**. A PayPal sandbox password previously lived in this document as plaintext; it has been removed and should be rotated by whoever owns the sandbox account, since it was exposed in git history.

---

### 7.19 Authentication (Phase 2)

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-AUTH-005 | "Forgot your password?" link is accessible | P2 | All | Planned |
| E2E-AUTH-007 | "Remember me" checkbox is checked by default | P3 | All | Planned |
| E2E-AUTH-008 | Register new account via "JOIN NOW" | P1 | All | Planned |
| E2E-AUTH-009 | Duplicate email registration shows error | P2 | All | Planned |

**Data note:** Use `createFreshAccountCredentials(brandCode)` from `test-accounts.ts` for registration tests — it generates a unique `qa.{brand}.e2e{timestamp}{rand}@mailinator.com` per call.

---

### 7.20 Account (Phase 2 — requires logged-in state)

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-ACCT-001 | Account dashboard is accessible after login | P1 | All | Planned |
| E2E-ACCT-002 | Order history shows past orders | P2 | All | Planned |
| E2E-ACCT-003 | Address book: add new address | P2 | All | Planned |
| E2E-ACCT-004 | Address book: edit existing address | P2 | All | Planned |
| E2E-ACCT-005 | Profile update: change name/email | P2 | All | Blocked — staging store password policy rejects `updateCustomerV2` firstname/lastname/DOB/phone updates (see `gra-customer-profile.spec.ts` TC_05–TC_08) |
| E2E-ACCT-006 | Wishlist saved items persist after login | P2 | All | Planned — GraphQL-layer coverage already exists in `gra-wishlist.spec.ts`; this ID is the UI-surface equivalent |
| E2E-ACCT-007 | Account panel shows nav items after login | P2 | All | Planned |
| E2E-ACCT-008 | `/my-details` renders saved profile info for a logged-in customer | P2 | All | Planned |
| E2E-ACCT-009 | Guest hitting `/my-details` is redirected or prompted to sign in | P2 | All | Planned |
| E2E-ACCT-010 | Edit an existing saved address and confirm persistence | P2 | All | Planned |
| E2E-ACCT-011 | Delete a saved address | P2 | All | Planned |
| E2E-ACCT-012 | Set an address as default and see it reflected | P2 | All | Planned |
| E2E-ACCT-013 | Newsletter toggle persists across reload | P3 | All | Planned |
| E2E-ACCT-014 | Change password via the UI, then re-login | P2 | All | Planned — must use a freshly generated account (`createFreshAccountCredentials`), never the shared per-brand account |
| E2E-ACCT-015 | Order history page renders for a fresh account | P2 | All | Planned |

**Feasibility note:** `EcommerceMyDetailsPage` today only implements the "Add New Address" drawer flow (built for `E2E-CHKOUT-009`); `E2E-ACCT-007`–`E2E-ACCT-015` will need new methods added to `EcommerceMyDetailsPage`/`EcommerceAccountModalPage`. GraphQL-layer coverage for account/wishlist/order-history already exists in `gra-wishlist.spec.ts`, `gra-my-details.spec.ts`, `gra-customer-profile.spec.ts`, and `gra-order-history.spec.ts` — new UI scenarios here must stay UI-surface-specific to avoid duplicating that coverage. Do not add a new UI scenario duplicating the already-Blocked `E2E-ACCT-005`.

---

### 7.21 Localization (Phase 2)

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-LOC-005 | Skechers NZ Spend & Save displayed with correct thresholds ($110/$170/$200) | P2 | Skechers NZ | Planned |
| E2E-LOC-006 | Free shipping threshold reads correctly per region | P2 | All | Planned |

> `E2E-LOC-005` (display of thresholds) is independent of the open Spend & Save cart-vs-order question that blocks `E2E-CHKOUT-010` — it only asserts the numbers are shown, so it stays Planned rather than Blocked.

---

### 7.22 Mobile / Responsive (Phase 2)

All mobile tests use 375px viewport.

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-MOB-001 | Homepage renders correctly on 375px viewport | P2 | All | Blocked — mobile Playwright projects are commented out in `playwright.config.ts` |
| E2E-MOB-002 | Mobile nav hamburger menu works | P2 | All | Blocked — mobile Playwright projects are commented out in `playwright.config.ts` |
| E2E-MOB-003 | PLP product grid adapts on mobile | P2 | All | Blocked — mobile Playwright projects are commented out in `playwright.config.ts` |
| E2E-MOB-004 | PDP add to cart is accessible on mobile | P1 | All | Blocked — mobile Playwright projects are commented out in `playwright.config.ts` |
| E2E-MOB-005 | Mini cart overlay is usable on mobile | P2 | All | Blocked — mobile Playwright projects are commented out in `playwright.config.ts` |
| E2E-MOB-006 | Login modal is usable on mobile | P2 | All | Blocked — mobile Playwright projects are commented out in `playwright.config.ts` |
| E2E-MOB-007 | Checkout form is navigable on mobile | P2 | All | Blocked — mobile Playwright projects are commented out in `playwright.config.ts` |

---

### 7.23 Error Handling (Phase 2)

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-ERR-002 | Search with invalid term shows empty results gracefully | P2 | All | Planned |
| E2E-ERR-004 | Invalid promo code shows error | P2 | All | Retired — duplicate of E2E-CHKOUT-008 (already noted in-code: `checkout.spec.ts` comments that it "covers E2E-ERR-004 — same underlying behaviour, no separate spec") |
| E2E-ERR-007 | Invalid email format at checkout triggers validation | P2 | All | Planned |
| E2E-ERR-008 | Track Order with invalid order number shows error | P2 | All | Planned |
| E2E-ERR-009 | Empty cart state is visible with correct messaging | P2 | All | Retired — duplicate of E2E-CART-011 |

---

### 7.24 Utilities (Phase 2)

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-UTIL-003 | Track Order FAQ accordion opens/closes correctly | P3 | All | Planned |
| E2E-UTIL-004 | Stores locator page loads | P2 | All | Planned |
| E2E-UTIL-006 | Qantas landing page (/qantas) loads (AU only) | P3 | AU sites only | Planned |
| E2E-UTIL-008 | Chat widget (Zendesk) is present and opens | P3 | Skechers AU, Skechers NZ | Planned |

---

### 7.25 Wishlist

`EcommerceWishlistPage` is guest-only today (no logged-in methods); `EcommercePDPPage`/`EcommercePLPPage` have no heart-toggle methods yet. Any scenario below requiring login must use a freshly generated test account (`createFreshAccountCredentials()` in `test-accounts.ts`), never the shared per-brand account, to avoid breaking other specs. **Vans AU** needs its Bloomreach acquisition popup dismissed (`dismissAcquisitionPopup()`) before interacting with PDP controls.

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-WISH-001 | Guest wishlist empty state | P2 | All | Automated — alias of `E2E-UTIL-007` (`tests/ecommerce/smoke/utilities-smoke.spec.ts`); the underlying test ID/title is not renamed |
| E2E-WISH-002 | PDP heart-toggle add (logged in) | P2 | All | Planned — needs new `EcommercePDPPage` method |
| E2E-WISH-003 | PLP card heart-toggle add (logged in) | P2 | All | Planned — needs new `EcommercePLPPage` method |
| E2E-WISH-004 | Wishlist page lists added item | P2 | All | Planned — needs new `EcommerceWishlistPage` method |
| E2E-WISH-005 | Remove item returns wishlist to empty state | P2 | All | Planned — needs new `EcommerceWishlistPage` method |
| E2E-WISH-006 | Guest heart-click prompts sign-in | P2 | All | Planned |
| E2E-WISH-007 | Persistence across logout/login | P2 | All | Planned |
| E2E-WISH-008 | Header badge count reflects items (assert delta, not absolute count) | P2 | All | Planned |
| E2E-WISH-009 | Move-to-bag from wishlist updates mini cart | P2 | All | Planned |

---

### 7.26 Add Review

All read-only display scenarios are confirmed live on all 8 brands via Bazaarvoice (§2). Because Bazaarvoice renders client-side after hydration, every scenario in this section must poll/wait rather than assert immediately on page load.

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-REV-001 | Star rating displays on PLP cards | P2 | All | Planned |
| E2E-REV-002 | Review section renders on PDP | P2 | All | Planned |
| E2E-REV-003 | "Write a Review" CTA is present | P2 | All | Planned |
| E2E-REV-004 | Q&A section is present | P2 | All | Planned |
| E2E-REV-005 | Reaching the review submission surface, without submitting | P2 | All | Planned — recon-gated: contingent on whether the form is same-origin or a cross-origin iframe; if iframe, needs `this.frames` (`FrameHelper`) |
| E2E-REV-006 | Review form field validation | P2 | All | Planned — recon-gated; skip if the form is a cross-origin iframe |
| E2E-REV-007 | Review list pagination/sort | P3 | All | Planned — data-dependent, later phase |
| E2E-REV-008 | Full review submission | P1 | All | **Manual, not to be automated** — writes into the real third-party Bazaarvoice instance under moderation, with no way to clean up and no deterministic pass/fail condition achievable within a test |

**Correction:** Bazaarvoice supports review submission without a prior purchase or prior login by default — any existing note claiming "write a review" requires either was incorrect (see the corrected Phase 3 entry below).

---

### 7.27 Integration

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-INT-001 | Add to Cart GraphQL mutation propagates to UI and analytics (datalayer) | P1 | All | Automated |

Implemented in `tests/ecommerce/integration/add-to-cart-integration.spec.ts` as site-indexed IDs (`E2E-INT-001-001` … `E2E-INT-001-008`), tagged `@ecommerce @integration @regression`.

---

## Phase 3 — Keep Manual (No Automation)

| Scenario | Reason |
|---|---|
| Track Order with real order number | Requires live order IDs |
| Qantas Points / Loyalty balance verification | Requires live account with earned points |
| Find in Store | Requires geo data / store inventory API |
| Password reset email | Requires email interception setup |
| "Write a review" (E2E-REV-008) | Writes into the real third-party Bazaarvoice instance under moderation, with no way to clean up and no deterministic pass/fail condition — **not** because it requires a prior purchase or prior login (Bazaarvoice supports submission without either by default; this corrects the prior version of this row) |

---

## 8. Test Data Plan

| Data Need | Strategy |
|---|---|
| Stable test products (in-stock) | Seed list of SKUs per site, confirmed in-stock. Export from `test-products.ts` |
| Guest checkout email | Dynamic: `createGuestCheckoutEmail()` in `test-accounts.ts` |
| Registered test accounts | One static account per brand in `test-accounts.ts`, password via `GRA_TEST_PASSWORD` (`.env.staging`, never committed) |
| Fresh, disposable accounts | `createFreshAccountCredentials(brandCode)` in `test-accounts.ts` — required for any scenario that logs in and mutates account state (password change, wishlist, address book), so the shared per-brand account is never left dirty for other specs |
| Promo codes | Request from merchandising team; store in `.env.staging` |
| Order numbers (Track Order) | Maintain list of placed test orders per region |
| Skechers NZ Spend & Save | Cart seeded with $110 / $170 / $200 worth of items |
| Currency assertions | Use regex: `/\$[\d,]+\.\d{2}/` — do not assert exact prices |
| Brand/loyalty name | `storefronts.ts` exports `brandName`, `loyaltyProgramName` per site |

---

## 9. CI/CD Execution Plan

| Trigger | Suite | Scope | Parallelism |
|---|---|---|---|
| PR / Push | Smoke | `@smoke` — each spec loops all 8 storefronts internally | `chromium` project only in CI (firefox skips `ecommerce/smoke`, `regression`, `integration`, `accessibility` in CI per `playwright.config.ts` `testIgnore`); `WORKERS` env var controls concurrency |
| Nightly | Full regression | `@regression` + `@smoke` | 50% workers (`npm test` default) |
| Pre-release | Full | All tags | Full parallelism |

**Real run commands** (see `package.json` for the full list):
```bash
npm run test:simple                # chromium only, 1 worker — fast smoke, all 8 storefronts via the loop inside each spec
npm test                           # chromium + firefox, 50% workers
npx playwright test tests/ecommerce/smoke --grep @smoke
npx playwright test --grep "E2E-HOME-001"

# Per-brand API projects (api.config.ts) — the only place per-site "projects" actually exist
npm run test:api:gra               # pla-au, skx-au, drm-au, van-au, pla-nz, skx-nz, drm-nz, van-nz
```

**Flaky test strategy:**
- Tag unstable tests `@quarantine` — run separately, non-blocking on PR
- Retry 2× on CI (existing config in `playwright.config.ts`)
- `monocart-reporter` trend/history + GitHub Actions step summary for flakiness detection (not Allure — this repo has no Allure dependency)

---

## 10. Risks and Mitigations

| # | Risk | Mitigation |
|---|---|---|
| 1 | Cart/checkout requires seeded items | Seed cart via GraphQL (`createEmptyCart` / `addProductsToCart`) — see `tests/api/gra-cart-minicart.spec.ts` |
| 2 | ServiceWorker errors cause test flakiness | `serviceWorkers` is not currently configured in `playwright.config.ts`; `consoleHelper` auto-fixture captures and attaches console/page errors on UI test failure today — treat explicit `serviceWorkers: 'block'` as a future hardening option, not an existing safeguard |
| 3 | Third-party iframes (Afterpay, Vimeo, Zendesk) | Assert iframe presence only, via `this.frames` (`FrameHelper`) — no deep interaction inside cross-origin iframes |
| 4 | Promotion banners are data-driven text | Use structural assertions (element visible), not exact text matching |
| 5 | AU/NZ data divergence on loyalty | Test loyalty join flow per region independently using `storefronts.ts` |
| 6 | Presale products are time-limited | Avoid presale SKUs in regression; use standard in-stock products |

---

## 11. Open Questions

| # | Question | Status / Recommendation |
|---|---|---|
| 1 | Are there stable test accounts for all 8 sites? | **Resolved** — `test-accounts.ts` defines one stable account per brand via `GRA_TEST_PASSWORD`; use `createFreshAccountCredentials()` for scenarios that mutate account state |
| 2 | Is there an API to seed cart items? | **Resolved** — GraphQL (`GraphQLClient`), not Magento REST; see `gra-cart-minicart.spec.ts` |
| 3 | Does Skechers NZ Spend & Save apply at cart or order level? | Still open — confirm with product team (blocks `E2E-CHKOUT-010`) |
| 4 | Are presale products automatable (stable SKUs)? | Avoid; use standard in-stock products |
| 5 | Is accessibility scanning expected? | **Resolved** — already implemented: `makeAxeBuilder` fixture + `tests/ecommerce/accessibility/accessibility-smoke.spec.ts`, tagged `@accessibility` |

---

## 12. Automation Prioritization Matrix

| Scenario Type | Business Risk | Frequency | Automation Value | Priority |
|---|---|---|---|---|
| Homepage smoke | High | High | High | Phase 1 |
| Search | High | High | High | Phase 1 |
| Add to cart | Critical | High | Very High | Phase 1 |
| Guest checkout | Critical | High | Very High | Phase 1 |
| Login / logout | Medium | High | High | Phase 1 |
| Localization checks | Medium | Medium | High | Phase 1 |
| Filters / sorting | Medium | Medium | High | Phase 2 |
| Wishlist | Medium | Medium | Medium | Phase 2 |
| Add / view review | Medium | Medium | Medium | Phase 2 (display only — submission stays manual) |
| Forgot password | Medium | Low | Medium | Phase 2 or manual |
| Payment failure | High | Low | Medium | Partial — up to method selection |
| Visual merchandising | Low | High | Low | Manual or visual regression |
