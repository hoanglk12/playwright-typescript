# E2E flow discovery report: agent implementation brief

> Exported from: E2E-Discovery-Report.pdf (March 20, 2026); audited and reconciled against the live repo and a live read-only GraphQL `storeConfig` query on 2026-09-14.
> Re-assessed live against all 8 staging storefronts on 2026-09-25/26 with headless Chromium at 1920×1080. Probes ran as a guest unless noted, used a read-only login with the shared per-brand accounts for account rows, and used promo code `test` for promo rows. No orders were placed, no reviews or registrations were submitted, and no account data was changed.
> Purpose: full context for QA agents to plan, build, and verify automation across 8 e-commerce storefronts.
> Scenarios: 164 unique scenario IDs (151 active, 13 retired) across 17 feature areas.
> Sites: 8 storefronts (Platypus, Skechers, Vans, Dr. Martens; AU and NZ for each). Navigation and feature config for all 8 lives in `src/data/ecommerce/storefronts.ts`. Treat that file as the source of truth, not this document.

---

## Live re-assessment (2026-09-26)

**Method.** Two passes. The first re-ran the existing automated ecommerce specs on the `chromium` project: smoke, `checkout.spec.ts`, `search.spec.ts`, integration and accessibility. `paypal-checkout.spec.ts` and `creditcard-checkout.spec.ts` were left out because they place sandbox orders. The second used hand-written Playwright scripts to probe every Planned, Blocked and "Not confirmed"/"inferred" item on each of the 8 sites against one shared checklist. A single probe miss was recorded as Inconclusive. Absent needed a second, different method to agree.

**Automated suite result (477 tests):** 440 passed, 18 failed, 19 skipped.
- 17 failures were Platypus AU tests that depend on add to cart (`E2E-PDP-007`, `E2E-CART-002` to `008`, `E2E-CART-010`, `E2E-CHKOUT-001` to `004`/`006`/`008`, `E2E-ERR-006`, `E2E-INT-001`). The mini-cart count stayed at 0 for the product the helper picked, and a separate checkout probe hit the same failure three times in that window. Afterwards `E2E-PDP-007-001` and `E2E-INT-001-001` passed when re-run alone on 1 worker, and the Platypus probe script added a different product to cart without trouble. Treat it as a transient staging or load issue, not a regression.
- 1 failure reproduces in isolation: `E2E-SRCH-005-003` (Skechers AU). Typing "Go Walk" only opens the static "TRENDING SEARCHES" list, and no typed-term suggestions come back.
- Skips: Vans NZ add-to-cart tests (the first product's first 3 sizes were sold out) and Skechers NZ `E2E-PDP-002`/`003` (no product with 2+ swatches in the first 10 MEN PLP cards). Both come from data availability, not defects.
- This run did not change any status in §7. Automated means implemented, not passing.

**Status changes made from live evidence:** `E2E-PLP-013`, `E2E-ERR-008`, `E2E-WISH-006` and `E2E-REV-004` moved from Planned to Blocked, with the reason in each row. Site scope was corrected for `E2E-HOME-004`, `E2E-PLP-013`, `E2E-PDP-010`, `E2E-PDP-017`, `E2E-UTIL-003` and `E2E-UTIL-008`. `E2E-CHKOUT-013` was retitled from "($150)" to "(per-region value)". No IDs were retired or added. Two new possible duplicate pairs are flagged in §11 #10.

**`storefronts.ts` drift found live** (reported here only; the file itself was not edited):
- Platypus NZ: the live nav shows `WOMENS` as the 3rd label. It is a `<span>` with a hover mega-menu but no `<a>`, and `navLinks` omits it.
- Skechers NZ: a fifth visible nav item, `Desktop NZ` → `/shop/sale`, is missing from `navLinks`.
- Skechers AU/NZ: the comment saying Skechers Insider "is not present on staging" is wrong. Insider appears in the login panel, PDPs, cart and registration on both sites, and in the AU homepage body. `loyaltyProgramName` is unset.
- `pdpSizeToggleLabels` is wrong on every brand that sets it. No site has a gender toggle pair. Each PDP has one size-system dropdown whose default depends on the product (`US MENS`, `US WOMENS`, `US KIDS` or `UK`), with the other systems (EU / CM / UK / US) as options. The `pdpExpectedSize` values are present.
- `pdpPath` is still a placeholder everywhere. Working slugs: Platypus `/1461-smooth-11838002-bsm.html` (both), Skechers `/composite-toe-work-boot-888028-bol.html` and `/uno-stand-on-air-73690-bbk.html` (both), Vans `/old-skool-vn-0d3hy28-blk.html` (both), Dr. Martens `/1460-crazy-horse-11822203-gch.html` (both).
- Dr. Martens NZ: the homepage `document.title` was "Home page" on 3 loads, which does not match `titleRegex`. `E2E-HOME-001` and `E2E-LOC-007` still passed in the suite run.
- Smaller mismatches: Platypus AU `/shop/mens` has no "Footwear" category (`categoryFilterLabel`), though `/shop/sale` has one. Vans NZ facet groups are collapsed by default, including the one that holds `categoryFilterLabel` "Old Skool". The Skechers size group is labelled "Size US Womens" (AU) and "Size UK" (NZ). Skechers has no Help entry inside `<header>`: the top-bar "Help" is an inert element inside `<main>`, and only the footer link navigates.

---

## Sites under analysis

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

**Tech stack:** Adobe Commerce (Magento) with a custom PWA-style storefront, modal-based login and cart, Zendesk chat, and Adobe DTM analytics.

**Critical revenue path:** Homepage → PLP → PDP → Add to Cart → Mini Cart → Checkout → Order Confirmation

---

## 1. Key regional differences (critical for localization tests)

> Derived from `src/data/ecommerce/storefronts.ts` (`hasQantasPoints`, `navLinks`, `*NavLabel`, `loyaltyProgramName`) where the field exists. The framework does not track fields that `storefronts.ts` doesn't model (BNPL availability, payment methods, free-shipping threshold, Zendesk chat presence, Spend & Save); the values for those rows were observed live on 2026-09-26. When a scenario comes to depend on one of them, add the field to `storefronts.ts` instead of relying on this table.

| Feature | Platypus AU | Platypus NZ | Skechers AU | Skechers NZ | Vans AU | Vans NZ | Dr. Martens AU | Dr. Martens NZ |
|---|---|---|---|---|---|---|---|---|
| Currency | AUD | NZD | AUD | NZD | AUD | NZD | AUD | NZD |
| Qantas Points | Yes | No | Yes | No | Yes | No | Yes | No |
| Loyalty Program | Kicks Club | Kicks Club | Skechers Insider (present on staging) | Skechers Insider (present on staging) | None | None | None (top bar "JOIN NOW FOR 10% OFF" is a newsletter sign-up) | None (same newsletter sign-up) |
| WOMENS/WOMEN nav | Yes | Label present as a hover-only `<span>`, no `<a>` (drift, see Live re-assessment) | Yes | Yes | Yes | Yes | Yes | Yes |
| CLOTHING nav | No (group inside the WOMENS/MENS mega-menus) | No (same) | Yes. `/shop/clothing` redirects to an empty `/shop/women/clothing` PLP on staging | No | Dropdown trigger only, no `<a>`, so not testable as a nav link | No | No | No |
| PRESALE nav | Yes | Yes | No (`/shop/presale` reachable by direct URL only) | No (same) | No | No | No | No |
| BRANDS nav | Yes | Yes | No | No | No | No | No | No |
| Spend & Save promo | No | No | Yes, in the homepage body: "SPEND $110, SAVE $20 / SPEND $170, SAVE $30 / SPEND $200, SAVE $40" | Yes, same three tiers in the homepage body | No | No | No | No. A different promo runs: "$50 OFF WHEN YOU SPEND $250 \| CODE: TAKE50" |
| BNPL on PDP | Afterpay + PayPal Pay Later | Afterpay only | Afterpay + PayPal Pay in 4 | Afterpay only | Afterpay + PayPal Pay Later | Afterpay only | Afterpay + PayPal Pay Later | Afterpay only |
| Payment methods at checkout | Not reached by the checkout probe | Check / Money order, Afterpay, Credit or Debit Card, PayPal | Qantas Points Plus Pay, Afterpay, Credit or Debit Card, PayPal, PayPal Pay in 4 | Afterpay, Credit or Debit Card, PayPal | Qantas Points Plus Pay, Afterpay, Credit or Debit Card, PayPal, PayPal Pay in 4 | Not reached (no purchasable size) | Qantas Points Plus Pay, Afterpay, Credit or Debit Card, PayPal, PayPal Pay in 4 | Afterpay, Credit or Debit Card, PayPal |
| Free shipping threshold | Conflicting: top bar $150, USP strip $130, cart "$49.00 away" at $100 | $150 | Conflicting: top bar + cart $150, PDP/footer/delivery table $130 | $150 | $130 | Conflicting: top bar $130, PDP + cart $150 (cart is $150) | $200 | Conflicting: all copy $200, cart progress implies $250 ("$226.00 away" at $23.99) |
| Zendesk chat | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |

**Reading the threshold row:** where the copy conflicts, the cart's "You're $X away from Free Shipping" line is the value the basket logic actually uses, and it is computed against the *discounted* subtotal (confirmed on Vans NZ and Skechers AU/NZ after applying `test`). On Vans and Skechers AU the progress line appears only on `/cart`. Platypus, Skechers NZ and Dr. Martens also show it in the mini cart.

---

## 2. Consolidated feature inventory

> Merged from the earlier separate 4-site tables. Rows proven by an automated spec that loops over all 8 `storefronts.ts` entries are marked `Yes` for every site. Every cell that used to read `Not confirmed` or `inferred` now holds the value observed live on 2026-09-26.

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
| "What's My Size?" widget (TrueFit) | Iframe attached, renders 0px on 7 PDPs | Iframe attached, 0px on 8 PDPs | Visible on some PDPs only (e.g. composite-toe boot); 0px on others | Iframe attached, 0px on 3 PDPs | Iframe attached, 0px | Iframe attached, 0px | Iframe attached, 0px | Iframe attached, 0px |
| Find in Store | Yes (enabled after a size is picked) | Yes (after size) | Yes (after size) | Yes (after size) | Yes (after size) | Yes (after size) | Button present but stays disabled | Button present but stays disabled |
| Afterpay / BNPL messaging | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Track Order (guest) | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Stores locator | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Help center | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| PRESALE category | Yes | Yes | No | No | No | No | No | No |
| BRANDS directory | Yes | Yes | No | No | No | No | No | No |
| CLOTHING category | No | No | Yes (PLP empty on staging) | No | Dropdown only, not a confirmed distinct category page | No | No | No |
| Spend & Save promo | No | No | Yes | Yes | No | No | No | No |
| Vimeo product video | Yes (1 of 7 PDPs) | Not found on 8 PDPs | No (none on PDPs) | No (none on PDPs) | Yes (2 PDPs) | Yes (2 PDPs) | Yes (1 of 4 PDPs) | Yes (1 PDP) |
| Qantas landing page (`/qantas`) | Yes | N/A (HTTP 200, empty body) | Yes | N/A (soft 404) | Yes | N/A (soft 404) | Broken: the body is the literal text `<script>alert('xss')</script>` | N/A (soft 404) |
| Product ratings/reviews (Bazaarvoice) | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Bazaarvoice Q&A section | No | No | No | No | No | No | No | No |
| 404 error page | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |

**Bazaarvoice note:** a read-only GraphQL `storeConfig` query against all 8 storefronts confirmed that `bazaarvoice_enabled`, `ratings_and_reviews_enabled`, `submission_container_page_enabled`, and `questions_and_answers_enabled` are all `true`, environment `staging`. Reviews are product-level (`filter_reviews_on_configurable_product_selection: false`), not per color variant. Bazaarvoice renders client-side after hydration, so any review scenario must poll or wait instead of asserting on initial page load (see §7.26). The live check on 2026-09-26 found ratings, the review list and the write-a-review form on all 8 sites, but no Q&A container (`data-bv-show="questions"`) on any PDP, despite `questions_and_answers_enabled: true`. All Bazaarvoice UI sits in open shadow DOM.

---

## 3. Test constraints agents must know

1. **Checkout flow** requires items in the cart first. With an empty cart, `/checkout` silently lands on `/` with no message (confirmed on all 8). For a guest, checkout opens as an auth modal over the current page, not at a standalone URL. Cart operations use GraphQL (`GraphQLClient` with the `createEmptyCart` and `addProductsToCart` mutations), not the Magento REST cart API. `tests/api/gra-cart-minicart.spec.ts` has the confirmed pattern for seeding a cart before checkout tests.
2. **Authentication** uses a modal overlay. The Magento URL `/customer/account/login` returns a 404, so every login test must open the modal from the header account icon instead of navigating to a URL.
3. **Loyalty programs** may require dedicated test accounts and promo sandbox data. Kicks Club (Platypus) and Skechers Insider (Skechers) are both live on staging; Vans and Dr. Martens have none.
4. **Qantas Points** is AU-only, confirmed per storefront via `hasQantasPoints` in `storefronts.ts`.
5. **Payment flow.** Guest checkout via PayPal (Braintree sandbox) and Credit Card (Braintree sandbox Visa) is automated end to end today (`E2E-PLAORD-001`, `E2E-PLAORD-003`), as is logged-in PayPal (`E2E-PLAORD-002`). Logged-in Credit Card (`E2E-PLAORD-004`) and Afterpay guest/logged-in (`E2E-PLAORD-005`/`006`) are not automated yet. Sandbox credentials come from `src/data/ecommerce/payment-accounts.ts` and `.env.staging`; never hardcode them in this document or in specs. `payment-accounts.ts` has no Afterpay sandbox data yet. The Afterpay radio is present at the payment step on every site the probe reached (see §1). Platypus NZ also lists "Check / Money order", so a spec that picks the first payment method there would place an offline order.
6. **"What's My Size?" and BNPL widgets** are not all iframes. Afterpay messaging is an inline `<square-placement>` web component with an open shadow root. Read it with a shadow-piercing locator (Playwright CSS pierces open shadow DOM), not with `innerText` or `FrameHelper`. The PayPal Pay Later / Pay in 4 message is a cross-origin iframe (`title="PayPal Message 1"`, sandbox.paypal.com), so assert its presence via `this.frames`. TrueFit ("What's My Size?") is an iframe that is attached on every PDP but usually renders at 0px height, so assert that it is attached, not that it is visible.
7. **Presale products** are data-driven and time-limited. Keep them out of stable regression tests and use standard in-stock products.
8. **Spend & Save** (Skechers NZ; the same block is also live on Skechers AU) triggers on basket thresholds ($110/$170/$200). Whether the discount applies at cart or order level is still an open product-team question: see Open Question #3 and `E2E-CHKOUT-010` (Blocked).
9. **Find in Store** depends on geo data and the store inventory API, so assert button visibility only. On 6 sites the button is disabled until a size is selected. On Dr. Martens AU/NZ it stays disabled even after a size is selected.
10. **ServiceWorker registration failures** have shown up in the browser console on some storefronts. `serviceWorkers` is not configured in `playwright.config.ts`; disabling it is a suggestion for future hardening, not something in place today. The current mitigation is `consoleHelper` (auto-fixture, `src/pages/helpers/console-helper.ts`), which captures console errors, page errors and failed requests and attaches them when a UI test fails.
11. **Vimeo video embeds** are third-party iframes. Assert that the iframe is present, and don't try to automate playback.
12. **StarTrack tracking** in Track Order is third-party, so only the form submission step can be automated. On staging, every lookup (valid or not) currently returns "Order Tracking is unavailable temporarily, please try again later".
13. **Locator and rendering hazards confirmed live on 2026-09-26.** These apply to all 8 sites unless a brand is named.
    - Wishlist hearts on PLP cards and several icon buttons, including the Dr. Martens PDP add-to-cart, carry `aria-label="Justify"`, so role/name locators for "wishlist" or "add to cart" miss them. Dr. Martens also renders two add-to-cart buttons in the same spot, and only the visible one takes the click.
    - The Bazaarvoice "Write a review" button sits under an `aria-hidden="true"` ancestor, so `getByRole` finds nothing. Target it with CSS (`button.bv_war_button` or `[data-bv-show="rating_summary"] button`).
    - The sale strikethrough is a 1px `::after` line, and the computed `text-decoration` is `none`. Assert on the two-price pair or the price colours instead.
    - Missing pages often return HTTP 200 with the 404 template (title `404|page-does-not-exist`), for example NZ `/qantas`, `/brands` on Skechers, and several Vans NZ homepage tiles. Assert on title or text, never on status.
    - Search is fuzzy. Gibberish terms return products on Platypus AU/NZ and Skechers NZ, so a no-results assertion needs a per-site term proven to return zero.
    - PLP facet accordions are collapsed by default on Platypus, Vans NZ and Dr. Martens, and a click on an option in a collapsed group lands on whatever sits underneath. Expand the group header first. Filters are encoded in the URL path (for example `/shop/mens/low-top/black`), which is steadier to assert on than checkbox state.
    - Homepage product carousels are auto-moving swipers with off-screen clones, and `locator.click()` fails actionability on them. Pick a slide inside the viewport. Some Platypus AU tiles are also covered by a banner overlay.
    - CSS `text-transform` uppercases several labels, so exact-text matches copied from the screen fail against the DOM text (seen on Skechers).
    - The Dr. Martens top bar rotates three messages on a 24s CSS loop. Read the DOM instead of asserting that one message is visible.
    - The Bloomreach acquisition popup on Vans AU did not appear in any headless run during this pass, although its scripts still loaded. Keep `dismissAcquisitionPopup()` defensive and never assert that the popup appears.
14. **Staging placeholder content** that will trip exact-text assertions: Lorem Ipsum in the Vans size chart and stores page, "SAVE 0%" / "SAVE $0" badges, "UAT MAY" / "UAT TEST 76 2" labels, the Skechers AU homepage tiles "CATE 2" / "C4", a Platypus AU hero slide reading "A/B Test", the Dr. Martens promo rule label "LongDescription LongDescription…", and test-review text in shared Bazaarvoice data.

---

## 4. Framework architecture (see root `CLAUDE.md`)

The folder structure and page-object list proposed in the original PDF export did not match the implemented framework. The file and class names were wrong, it assumed a REST-first API layer, and it listed mobile/webkit projects that don't exist. Rather than describe the architecture again here and risk it going stale, this document defers to root `CLAUDE.md` for:

- Composition-based Page Object Model (`BasePage` plus 11 helper instances: `this.waits`, `this.elements`, `this.style`, `this.frames`, `this.files`, `this.storage`, `this.network`, `this.tables`, `this.tabs`, `this.dom`, `this.overlays`)
- Fixture registration in `src/config/base-test.ts`
- Path aliases (`@pages/*`, `@tests/*`, `@utils/*`, `@config/*`, `@data/*`)

Folder layout for ecommerce coverage, for orientation only (`CLAUDE.md` holds the authoritative rules):

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

The page-object classes are `Ecommerce*Page` (for example `EcommerceWishlistPage`, `EcommerceMyDetailsPage`, `EcommerceAccountModalPage`), and all of them extend `BasePage`. Classes named `BaseCommercePage`, `AccountModal` or `PLPPage` do not exist, despite appearing in earlier versions of this report.

---

## 5. Page object methods (see root `CLAUDE.md`)

Earlier versions of this report had a "Required Core API" table listing classes and methods that do not exist (`BaseCommercePage`, `AccountModal`, `PLPPage`, `PDPPage`, `CartOverlay`, `CheckoutPage`, with invented method names). The real methods live on the `Ecommerce*Page` classes registered as fixtures in `base-test.ts` (see the fixture table in `CLAUDE.md`). They are built on the 11 `BasePage` helpers and never call `page.locator()`/`page.click()` directly. The selector strategy still holds:

1. `getByRole()`: first choice
2. `getByLabel()`, `getByPlaceholder()`, `getByText()`
3. `getByTestId()` (data-testid)
4. CSS selector: last resort only, or when a `this.style.*` computed-style read needs it

---

## 6. Multi-site execution: the real pattern

There is no per-site Playwright project (`platypus-au`, `skechers-nz`, etc.). `playwright.config.ts` defines only two UI projects, `chromium` and `firefox`; the mobile/webkit projects are present but commented out. Multi-site coverage comes from each spec looping over `storefronts` from `src/data/ecommerce/storefronts.ts`:

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

Per-brand parallelism does exist, but only for the API suite: `api.config.ts` defines 8 GRA brand+region projects (`pla-au`, `skx-au`, `drm-au`, `van-au`, `pla-nz`, `skx-nz`, `drm-nz`, `van-nz`), run via `npm run test:api:gra`. Adding a new storefront to UI coverage means adding one entry to `storefronts.ts`, not a new Playwright project or `.env` URL pair.

---

## 7. Recommended automation scope

### Priority legend
- **P1** = Critical revenue/business flow
- **P2** = Important regression
- **P3** = Nice-to-have

### Automation legend
- **A1** = Automate immediately (Phase 1)
- **A2** = Automate later (Phase 2)
- **M** = Keep manual

### Automation status legend
- **Automated** = implemented and running today (verified by grepping `tests/` for `test(...)`/`tcId`)
- **Planned** = approved for automation, not implemented yet
- **Blocked** = cannot proceed yet; the row states the blocker
- **Retired** = superseded (duplicate) or a reserved numbering gap. The row stays for traceability, and the ID must not be reused.

---

## Phase 1: automate immediately (smoke and critical path)

~42 scenarios × 8 sites = ~336 test executions

### 7.1 Homepage

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-HOME-001 | Homepage loads with correct title and hero banner | P1 | All | Automated |
| E2E-HOME-002 | Top bar promotional message is visible | P2 | All | Automated |
| E2E-HOME-003 | Qantas Points link is visible on AU sites only (absent on NZ) | P2 | All | Automated |

**Sample: E2E-HOME-001**
- Preconditions: staging env accessible, no auth required
- Steps: navigate to site root `/` → wait for page title → assert hero banner visible above the fold
- Expected: page title includes the brand name; hero banner visible

**Sample: E2E-HOME-003 (localization check)**
- Steps: navigate to an AU site root and assert the Qantas link is visible. Navigate to an NZ site root and assert the Qantas link is absent.
- Data note: `hasQantasPoints` in `storefronts.ts` drives the expected outcome per site.

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

**Implementation note:** `navigation-smoke.spec.ts` implements NAV-002/003/004/005 as per-category, site-indexed IDs (`E2E-NAV-W*`, `E2E-NAV-M*`, `E2E-NAV-K*`, `E2E-NAV-S*`) instead of the flat IDs above. The flat ID names the scenario; you won't find it as a literal string in a test title.

---

### 7.3 Search

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-SRCH-001 | Search returns results for a known product | P1 | All | Automated |
| E2E-SRCH-006 | Clicking search icon or pressing Enter submits search | P1 | All | Automated |

**Data note:** `searchTerm` in `storefronts.ts` gives each site a term confirmed to return results (e.g. `'Nike'` for Platypus, `'Go Walk'` for Skechers).

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

**Agent note on E2E-PDP-006:** the button may be disabled or may show an error toast. Confirm the behaviour per site before asserting specific message text.

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
| E2E-CART-009 | *(reserved, never assigned)* | n/a | n/a | Retired: ID gap, not reused |
| E2E-CART-011 | Empty cart state renders "Your Shopping Cart is empty" | P2 | All | Automated |

---

### 7.7 Authentication

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-AUTH-001 | Login modal opens via account icon in header | P1 | All | Automated |
| E2E-AUTH-002 | Successful login with valid credentials | P1 | All | Automated |
| E2E-AUTH-003 | Failed login with invalid password shows error | P1 | All | Automated |
| E2E-AUTH-004 | Failed login with non-existent email shows error | P1 | All | Automated |
| E2E-AUTH-006 | *(reserved, never assigned)* | n/a | n/a | Retired: ID gap, not reused |
| E2E-AUTH-010 | Logout clears session and redirects | P1 | All | Automated |
| E2E-AUTH-011 | Login modal title matches brand | P2 | All | Automated |

**Constraint:** open the login modal with the header account icon. Navigating to `/customer/account/login` returns 404.

**Data note:** `test-accounts.ts` exports one stable account per brand (`testAccounts`, all 8 sites) via `GRA_TEST_PASSWORD`, plus `invalidCredentials` and `nonExistentCredentials` maps, loaded from `.env.staging`.

---

### 7.8 Localization

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-LOC-001 | AU site displays AUD prices | P1 | Platypus AU, Skechers AU | Automated |
| E2E-LOC-002 | NZ site displays NZD prices | P1 | Platypus NZ, Skechers NZ | Automated |
| E2E-LOC-003 | AU sites show Qantas Points; NZ sites do not | P2 | All | Retired: duplicate of E2E-HOME-003 |
| E2E-LOC-004 | Skechers AU has CLOTHING nav; Skechers NZ does not | P2 | Skechers AU, Skechers NZ | Retired: duplicate of E2E-NAV-007 |
| E2E-LOC-007 | Correct brand name / loyalty program name per site | P2 | All | Automated |

> **Discrepancy flagged during this audit (not resolved here):** E2E-LOC-004 has a real, passing automated test (`localization-smoke.spec.ts`) that checks CLOTHING nav presence per region. E2E-NAV-007, the scenario the approved plan retires it in favor of, has no automated test yet. (Live on 2026-09-26, the Skechers AU CLOTHING link exists and resolves, but to an empty PLP; see §7.12.) The retirement direction above follows the approved research exactly. Before anyone touches a spec file, confirm with the team whether `E2E-NAV-007` should absorb the existing coverage in `localization-smoke.spec.ts` or whether the two IDs should stay separate. E2E-LOC-003 has the same duplicate-test situation relative to E2E-HOME-003 without the ambiguity: both check the identical condition, so consolidating them is safe.

---

### 7.9 Error handling

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-ERR-001 | 404 page shows correct brand error UI with "Back to Home" | P1 | All | Automated |
| E2E-ERR-003 | Add to Cart without size selection shows validation | P1 | All | Retired: duplicate of E2E-PDP-006 |
| E2E-ERR-005 | Login with wrong password shows error | P1 | All | Retired: duplicate of E2E-AUTH-003 |
| E2E-ERR-006 | Checkout required fields blank shows validation | P1 | All | Retired: duplicate of E2E-CHKOUT-003 |

---

### 7.10 Utilities

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-UTIL-001 | Track Order page loads and form is present | P1 | All | Automated |
| E2E-UTIL-002 | *(reserved, never assigned)* | n/a | n/a | Retired: ID gap, not reused |
| E2E-UTIL-005 | Help/Support page accessible via header link | P2 | All | Automated |
| E2E-UTIL-007 | Wishlist page renders (empty state for guest) | P2 | All | Automated. Also aliased as `E2E-WISH-001` (§7.25). This stays the canonical ID; do not rename the underlying test |

---

## Phase 2: automate later (high-value regression)

This phase needs extra setup: GraphQL cart seeding and test account credentials per site.

### 7.11 Homepage (Phase 2)

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-HOME-004 | Carousel navigates forward/backward with dot pagination | P2 | Platypus AU, Skechers AU, Skechers NZ, Vans AU, Vans NZ | Planned. Live: the Platypus NZ and Dr. Martens AU heroes are a single slide with no controls, and Dr. Martens NZ has no hero. Skechers autoplays and Platypus AU loads on its last slide (non-infinite), so assert relative to a captured slide index |
| E2E-HOME-005 | Quick-link category tiles navigate to correct PLP | P2 | All | Planned. Live: only the Vans AU and Dr. Martens NZ tiles all link to the matching PLP. Dr. Martens AU has no tiles. Platypus AU tiles are mislinked (SANDALS → `/adidas.html`) and Platypus NZ tiles point at the AU domain. Vans NZ tiles are mislinked (WOMENS → `/shop/mens/`, one → `/null`). Skechers tiles are CMS placeholders with a single link (a soft 404 on NZ) |
| E2E-HOME-006 | Homepage product tiles link to correct PDPs | P2 | All | Planned. Live: works on 7 sites; the Skechers NZ product carousels render empty on staging |
| E2E-HOME-007 | Free shipping threshold banner is displayed correctly | P3 | All | Planned. Live: the threshold differs per site and the copy conflicts on 4 sites (see §1) |

---

### 7.12 Navigation (Phase 2)

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-NAV-006 | BRANDS link navigates to brands page (Platypus only) | P2 | Platypus AU, Platypus NZ | Planned. Live: `/brands` renders "FEATURED BRANDS" and an A to Z "ALL BRANDS" list on both |
| E2E-NAV-007 | CLOTHING link navigates to clothing PLP (Skechers AU only) | P2 | Skechers AU | Planned. See the discrepancy note under §7.8. Live: the link works, but `/shop/clothing` redirects to `/shop/women/clothing`, which shows 0 products and a raw category-ID breadcrumb on staging |
| E2E-NAV-008 | PRESALE link navigates to presale PLP (Platypus only) | P2 | Platypus AU, Platypus NZ | Planned. Live: `/shop/presale` lists 3 products on both (time-limited data, see §3 #7) |
| E2E-NAV-010 | Breadcrumbs on PDP are correct and navigable | P2 | All | Planned. Live: present on all 8. The trail depends on the entry path (direct URL vs PLP click), and crumb hrefs are relative with no leading slash. Possible duplicate of `E2E-PDP-018`, flagged for the team but not retired |

---

### 7.13 Search (Phase 2)

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-SRCH-002 | Search input placeholder text is correct per brand | P2 | All | Automated |
| E2E-SRCH-003 | Search with empty term shows appropriate feedback | P2 | All | Automated |
| E2E-SRCH-004 | Search for non-existent term shows no-results state | P2 | All | Planned. Live: the no-results copy ("We couldn't find what you were looking for…") renders on Skechers AU, Vans AU/NZ and Dr. Martens AU/NZ. Fuzzy search returns products for gibberish on Platypus NZ (5/5 runs), Platypus AU (5 of 6 runs) and Skechers NZ, so each site needs a verified zero-result term |
| E2E-SRCH-005 | Search autocomplete/suggestions appear while typing | P2 | All | Automated. Last run: Skechers AU fails reproducibly (only the static "TRENDING SEARCHES" list opens) |

**Data note:** `searchPlaceholder` in `storefronts.ts` holds the per-brand placeholder text (e.g. Platypus = `"Find products, colours, fits..."`, Skechers/Vans/Dr. Martens = `"What are you looking for?"`).

---

### 7.14 PLP (Phase 2)

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-PLP-002 | Product card shows brand, name, price, colour swatches | P2 | All | Planned. Live: only Platypus (multi-brand) shows a brand line. Skechers shows a gender label instead, and Vans and Dr. Martens show neither. Swatches are unlabelled SVG circles |
| E2E-PLP-003 | Sale badge renders correctly on qualifying products | P2 | All | Planned. Live: badges on all 8 ("SAVE 23%", "SAVE 37% RRP", "45% OFF RRP", "SAVE $16"). The strikethrough is a `::after` line (§3 #13) |
| E2E-PLP-005 | Filter by Silhouette/Style reduces product count | P2 | All | Planned. Live: the group is "SILHOUETTE" on Platypus AU, "STYLE" on Skechers, Dr. Martens and Vans AU, and "SHOE STYLE" on Vans (both). Platypus NZ has no such group |
| E2E-PLP-007 | Filter by Colour reduces product count | P2 | All | Planned. Live: "COLOUR" group on all 8 (collapsed by default on Platypus, Vans NZ, Dr. Martens) |
| E2E-PLP-008 | Multiple filters can be applied simultaneously | P2 | All | Planned. Live: confirmed on Skechers, Vans and Dr. Martens (e.g. 86 → 46 → 14 products). On Platypus AU/NZ the second facet click timed out in 3 attempts (Inconclusive) |
| E2E-PLP-009 | Sort options work (Most popular default) | P2 | All | Planned. Live: "Most popular" is the default only on Platypus (options: Most popular, Product Name). Skechers, Vans and Dr. Martens default to "Best Sellers", with Price High→Low, Low→High and Name A to Z. Custom dropdown, not a `<select>` |
| E2E-PLP-010 | Wishlist heart icon toggles on product card | P2 | All | Planned. See also E2E-WISH-003 (§7.25). Live: present on all 8; the accessible name is "Justify" (§3 #13) |
| E2E-PLP-013 | Gender sub-tabs on Sale page filter correctly (Skechers) | P2 | Skechers AU | Blocked: the Skechers AU `/shop/sale` Women's / Men's / Girls / Boys buttons render but do nothing (URL and "81 PRODUCTS" unchanged). That is a staging defect worth a ticket. Skechers NZ has no such tabs |
| E2E-PLP-014 | Product count reflects applied filters | P2 | All | Planned. Live: the "N PRODUCTS" count updates on filter; on Skechers it lags the URL change by one network round trip |
| E2E-PLP-015 | Clearing all filters restores full product count | P2 | All | Planned. Live: "Clear All" restores the count on 7 sites (Platypus NZ Inconclusive, because no filter could be applied) |

---

### 7.15 PDP (Phase 2)

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-PDP-003 | Colour swatch links navigate to correct variant URL | P2 | All | Automated |
| E2E-PDP-008 | Afterpay split payment message shows correct instalment | P2 | All | Planned. Live: "or 4 payments of $X with afterpay" on all 8, where X is the price ÷ 4 rounded to the cent (e.g. $35.00 at $139.99). It is a shadow-DOM web component, not an iframe (§3 #6) |
| E2E-PDP-009 | Qantas Points earn message shows on AU sites | P2 | AU sites only | Planned. Live: "Earn N Qantas Points with this purchase" (2 points per $1) on all 4 AU sites, absent on NZ. Skechers AU runs a Double Points promo that strikes through the base value, so assert on the non-struck number |
| E2E-PDP-010 | Kicks Club / Skechers Insider CTA is visible | P2 | Platypus AU, Platypus NZ, Skechers AU, Skechers NZ | Planned. Live: Kicks Club voucher CTA on Platypus and "Earn N Skechers Insider points" on Skechers. Vans and Dr. Martens have no loyalty program |
| E2E-PDP-011 | Star rating and review count are displayed | P3 | All | Planned. See also E2E-REV-001 (§7.26). Live: a "4.4 (12)"-style summary sits beside the title on all 8 |
| E2E-PDP-012 | *(reserved, never assigned)* | n/a | n/a | Retired: ID gap, not reused |
| E2E-PDP-013 | Size Chart link opens size guide | P2 | All | Planned. Live: "Size Chart" / "Size Guide" opens an in-page panel or drawer on all 8, and the panel blocks other clicks until it is closed |
| E2E-PDP-014 | "What's My Size?" widget loads (iframe present) | P3 | All | Planned. Live: the TrueFit iframe is attached on every PDP checked but renders at 0px everywhere except some Skechers AU PDPs, so only "iframe attached" can be asserted |
| E2E-PDP-015 | *(reserved, never assigned)* | n/a | n/a | Retired: ID gap, not reused |
| E2E-PDP-016 | Wishlist toggle works on PDP | P2 | All | Planned. See also E2E-WISH-002 (§7.25). Live: "ADD TO WISHLIST" works for guests on all 8 (header badge "" → "1", no modal) |
| E2E-PDP-017 | Product video (Vimeo iframe) loads on applicable PDPs | P3 | Platypus AU, Vans AU, Vans NZ, Dr. Martens AU, Dr. Martens NZ | Planned. Live: the Vimeo iframe appears on specific PDPs only (Platypus AU `/mens-court-vision-low-next-nature-dh2987-100-wht.html`, Vans `/old-skool-vn-0d3hy28-blk.html`, Dr. Martens `/1460-smooth-11822006-bsm.html`). None was found on Skechers or Platypus NZ PDPs |
| E2E-PDP-018 | Breadcrumb trail is correct (Home / Brand / Category) | P2 | All | Planned. Live: "Home / Brand / …" only on Platypus; other brands show "Home / Gender or Collection / Category". Possible duplicate of `E2E-NAV-010`, flagged for the team but not retired |
| E2E-PDP-019 | BUY 2 GET 20% OFF badge visible on qualifying products | P2 | All | Planned. Live: no "BUY 2 GET 20% OFF" copy on any of the 8. Other promo badges exist ("2 FOR $30", "3 FOR $99.99", "20% OFF AT CART", "DMS EXCLUSIVE"), so assert badge presence structurally, not this text |

---

### 7.16 Cart (Phase 2)

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-CART-006 | "Continue Shopping" button closes cart overlay | P2 | All | Automated |
| E2E-CART-007 | Adding same product in different size creates separate line item | P2 | All | Automated |
| E2E-CART-010 | Promo/discount code field is visible at cart page | P1 | All | Automated |

---

### 7.17 Checkout (Phase 2, requires cart seeding via GraphQL)

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-CHKOUT-001 | Checkout page loads after items added to cart | P1 | All | Automated |
| E2E-CHKOUT-002 | Guest checkout: email entry step is presented | P1 | All | Automated |
| E2E-CHKOUT-003 | Shipping address form: all required fields validated | P1 | All | Automated |
| E2E-CHKOUT-004 | Shipping method selection updates order total | P1 | All | Automated |
| E2E-CHKOUT-005 | *(reserved, never assigned)* | n/a | n/a | Retired: ID gap, not reused |
| E2E-CHKOUT-006 | Order review step shows correct items, quantities, total | P1 | All | Automated |
| E2E-CHKOUT-007 | Promo code accepted reduces order total | P1 | All | Planned. Live: code `test` is accepted on all 8 sites (see the result table below) |
| E2E-CHKOUT-008 | Invalid promo code shows error message | P2 | All | Automated |
| E2E-CHKOUT-009 | Logged-in checkout pre-fills saved address | P2 | All | Automated (spec exists), but excluded from CI: the `playwright.config.ts` chromium project `testIgnore`s `checkout-address-prefill.spec.ts` (region-combobox selector unconfirmed on 3/6 storefronts) |
| E2E-CHKOUT-010 | Spend & Save discount applies at threshold (Skechers NZ only) | P1 | Skechers NZ | Blocked: pending product-team confirmation of whether the threshold applies at cart or order level (Open Question #3) |
| E2E-CHKOUT-011 | Order confirmation page shows order number | P1 | All | Planned. Not probed, because it needs a placed order. The order-number check already runs as a step inside `E2E-PLAORD-001`/`002`/`003` (`getOrderConfirmationNumber()`) |
| E2E-CHKOUT-012 | Empty cart redirects away from checkout | P2 | All | Planned. Live: `/checkout` with an empty cart lands on `/` on all 8, with no message |
| E2E-CHKOUT-013 | Free shipping threshold (per-region value) applied correctly | P2 | All | Planned. Live: the threshold is not a flat $150. It ranges from $130 (Vans AU) to $200 (Dr. Martens), and 4 sites show conflicting copy (§1). Needs a per-site threshold field in `storefronts.ts` |
| E2E-CHKOUT-014 | Required field validation on shipping form | P2 | All | Planned |
| E2E-CHKOUT-015 | Cross-site currency: AUD on AU, NZD on NZ | P2 | All | Planned. Live: the `dataLayer` site currency at checkout reads AUD/NZD correctly on the 6 sites the probe reached |

**E2E-CHKOUT-007 live result (promo code `test`, guest cart, 2026-09-26):** applying `test` on `/cart` shows the banner `"test" successfully applied.` and adds a "Promotion Discount" line worth 10% of the subtotal. The discount carries into the checkout order summary (checked on the 6 sites the checkout probe reached).

| Site | Subtotal | Discount line | Result |
|---|---|---|---|
| Platypus AU | $100.00 | "test rule" -$10.00 | Total $112.99 → $90.00 (delivery $12.99 → Free) |
| Platypus NZ | $99.99 | "test rule" -$10.00 | Total $89.99 (delivery → Free) |
| Skechers AU | $159.99 | "test rule" -$16.00 | Total $158.99 (delivery $15.00 re-applied once the subtotal fell below the threshold) |
| Skechers NZ | $159.99 | "test rule" -$16.00 | Total $143.99 before delivery |
| Vans AU | $139.99 | "test rule, 10%" -$10.50, stacked after a running "Singles Day 25% Off Full Price" -$35.00 | Total $94.49 |
| Vans NZ | $110.99 | "test rule, 10%" -$11.10 | Total $123.99 → $112.89 |
| Dr. Martens AU | $319.99 | Placeholder label "LongDescription LongDescription…" -$32.00 | Total $287.99 |
| Dr. Martens NZ | $419.99 | Placeholder label "LongDescription…" -$42.00 | Total $377.99 |

Automation notes:
- Assert the total in the checkout summary. `EcommerceCheckoutPage.getOrderSummaryTotals()` parses `total`/`discount` there but returns `null` for both on `/cart`.
- Assert the amount, not the rule label, because Dr. Martens shows a placeholder label.
- After applying, APPLY becomes REMOVE. On Vans NZ the collapsed "Enter promo code" input reports as visible but won't accept clicks until the accordion is expanded.
- `test` can move free-shipping state either way. On Skechers AU the discounted subtotal dropped below the threshold ("You've scored Free Express Shipping" → "$6.00 away"). On both Platypus sites, delivery went to Free even though the discounted total ($90.00 / $89.99) is under the $150 threshold.
- The Platypus AU row comes from the probe agent's run. The checkout probe could not reach Platypus AU during the transient add-to-cart failure described in the Live re-assessment section.

> **Follow-up (not resolved here):** `E2E-CHKOUT-003` ("Shipping address form: all required fields validated") and `E2E-CHKOUT-014` ("Required field validation on shipping form") read as the same scenario. The approved research plan did not include this pair in its duplicate list, so neither is retired here. The team should decide in a future pass; an agent should not retire `E2E-CHKOUT-014` on its own authority.

**Cart seeding pattern (GraphQL, not the Magento REST cart API):**
```ts
// See tests/api/gra-cart-minicart.spec.ts for the full pattern
const { data } = await graphqlClient.mutateWrapped(CREATE_EMPTY_CART_MUTATION); // createEmptyCart
const cartId = data.createEmptyCart;
await graphqlClient.mutateWrapped(ADD_PRODUCTS_TO_CART_MUTATION, { cartId, sku: TestProducts.stableSkuPlatypusAU, quantity: 1 }); // addProductsToCart
```

---

### 7.18 Place order

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-PLAORD-001 | Place order via Paypal using guest user | P1 | All | Automated |
| E2E-PLAORD-002 | Place order via Paypal using logged-in user | P1 | All | Automated |
| E2E-PLAORD-003 | Place order via Credit Card using guest user | P1 | All | Automated |
| E2E-PLAORD-004 | Place order via Credit Card using logged-in user | P1 | All | Planned. Live: "Credit or Debit Card" is offered at the payment step on all 6 sites the checkout probe reached |
| E2E-PLAORD-005 | Place order via Afterpay using guest user | P1 | All | Planned. Live: the Afterpay radio is present at the payment step on all 6 sites the checkout probe reached, and `/cart` also has a "PAY WITH afterpay" express button. `payment-accounts.ts` has no Afterpay sandbox account yet |
| E2E-PLAORD-006 | Place order via Afterpay using logged-in user | P1 | All | Planned. Same notes as `E2E-PLAORD-005` |

**Sandbox payment credentials** come from `src/data/ecommerce/payment-accounts.ts` (PayPal, via `PAYPAL_SANDBOX_PASSWORD`), `src/data/api/gra-braintree-payment-data.ts` (`generateSandboxVisa()` for card numbers) and `.env.staging`. Never hardcode them in this document. A PayPal sandbox password used to sit in this document as plaintext. It has been removed, but it is still in git history, so whoever owns the sandbox account should rotate it.

---

### 7.19 Authentication (Phase 2)

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-AUTH-005 | "Forgot your password?" link is accessible | P2 | All | Planned. Live: present in the login modal on all 8. It swaps the panel to "FORGOT YOUR PASSWORD?" with Email Address / SEND / CANCEL |
| E2E-AUTH-007 | "Remember me" checkbox is checked by default | P3 | All | Planned. Live: checked by default on all 8 |
| E2E-AUTH-008 | Register new account via "JOIN NOW" | P1 | All | Planned. Live: "JOIN NOW" opens the registration panel on all 8 (First/Last Name, Email, optional Phone, Password). AU adds an optional Qantas section, and Skechers and Platypus add a loyalty opt-in. The Platypus "T&Cs Apply." link points at a Dr. Martens AU PDP |
| E2E-AUTH-009 | Duplicate email registration shows error | P2 | All | Planned. Live: no inline "already exists" check fires on blur on any site, so this needs a real submit with an existing email |

**Data note:** use `createFreshAccountCredentials(brandCode)` from `test-accounts.ts` for registration tests. Each call generates a unique `qa.{brand}.e2e{timestamp}{rand}@mailinator.com`.

---

### 7.20 Account (Phase 2, requires logged-in state)

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-ACCT-001 | Account dashboard is accessible after login | P1 | All | Planned. Live: the `/my-account` dashboard renders on all 8 |
| E2E-ACCT-002 | Order history shows past orders | P2 | All | Planned. Live: `/my-orders` renders, but every shared account shows "You have placed no orders", so this needs an account with order history |
| E2E-ACCT-003 | Address book: add new address | P2 | All | Planned. Live: the address book lives inside `/my-details` on all 8 ("+ ADD NEW ADDRESS"). Vans `/address-book` crashes with "Sorry! An unexpected error occurred" |
| E2E-ACCT-004 | Address book: edit existing address | P2 | All | Planned. Live: the "Edit" drawer is present wherever the account has a saved address (the Platypus AU account has none) |
| E2E-ACCT-005 | Profile update: change name/email | P2 | All | Blocked: the staging store password policy rejects `updateCustomerV2` firstname/lastname/DOB/phone updates (see `gra-customer-profile.spec.ts` TC_05 to TC_08) |
| E2E-ACCT-006 | Wishlist saved items persist after login | P2 | All | Planned. GraphQL-layer coverage already exists in `gra-wishlist.spec.ts`; this ID is the UI-surface equivalent |
| E2E-ACCT-007 | Account panel shows nav items after login | P2 | All | Planned. Live: panel items vary by brand. My Orders, My Details, Returns, MY ACCOUNT and Logout/Sign Out appear everywhere, "My Rewards" on Platypus and Skechers, and "Qantas Frequent Flyer" on AU sites |
| E2E-ACCT-008 | `/my-details` renders saved profile info for a logged-in customer | P2 | All | Planned. Live: renders on all 8 |
| E2E-ACCT-009 | Guest hitting `/my-details` is redirected or prompted to sign in | P2 | All | Planned. Live: redirects to `/` and opens the login panel automatically on all 8 |
| E2E-ACCT-010 | Edit an existing saved address and confirm persistence | P2 | All | Planned |
| E2E-ACCT-011 | Delete a saved address | P2 | All | Planned. Live: no Delete control shows when the only address is the default one (seen on Vans, Skechers, Dr. Martens, Platypus NZ). Assessing it needs a fresh account with 2+ addresses |
| E2E-ACCT-012 | Set an address as default and see it reflected | P2 | All | Planned. Live: the "Make this my default address" checkbox is in the add/edit drawer on Platypus, Vans and Dr. Martens. Skechers does not show it when editing its single default address |
| E2E-ACCT-013 | Newsletter toggle persists across reload | P3 | All | Planned. Live: the marketing checkboxes sit in the COMMUNICATIONS section of `/my-details`. Vans AU/NZ and Skechers AU show "Unable to retrieve marketing preferences." for the shared accounts |
| E2E-ACCT-014 | Change password via the UI, then re-login | P2 | All | Planned. Must use a freshly generated account (`createFreshAccountCredentials`), never the shared per-brand account. Live: "Change Password" sits in the EDIT drawer on `/my-details` on all 8 |
| E2E-ACCT-015 | Order history page renders for a fresh account | P2 | All | Planned. Live: the empty state "You have placed no orders" renders on all 8 |

**Feasibility note:** `EcommerceMyDetailsPage` currently implements only the "Add New Address" drawer flow (built for `E2E-CHKOUT-009`), so `E2E-ACCT-007` to `E2E-ACCT-015` need new methods on `EcommerceMyDetailsPage`/`EcommerceAccountModalPage`. GraphQL-layer coverage for account, wishlist and order history already exists in `gra-wishlist.spec.ts`, `gra-my-details.spec.ts`, `gra-customer-profile.spec.ts`, and `gra-order-history.spec.ts`. New UI scenarios here must stay specific to the UI surface so they don't duplicate that coverage. Do not add a new UI scenario that duplicates the already-Blocked `E2E-ACCT-005`.

---

### 7.21 Localization (Phase 2)

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-LOC-005 | Skechers NZ Spend & Save displayed with correct thresholds ($110/$170/$200) | P2 | Skechers NZ | Planned. Live: "SPEND $110, SAVE $20 / SPEND $170, SAVE $30 / SPEND $200, SAVE $40" in the homepage body, not the top bar. Skechers AU shows the same block, so the scope could widen to both |
| E2E-LOC-006 | Free shipping threshold reads correctly per region | P2 | All | Planned. Live values and conflicts are in §1 |

> `E2E-LOC-005` (display of thresholds) does not depend on the open Spend & Save cart-vs-order question that blocks `E2E-CHKOUT-010`. It only asserts that the numbers are shown, so it stays Planned rather than Blocked.

---

### 7.22 Mobile / responsive (Phase 2)

All mobile tests use a 375px viewport.

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-MOB-001 | Homepage renders correctly on 375px viewport | P2 | All | Blocked: the mobile Playwright projects are commented out in `playwright.config.ts` |
| E2E-MOB-002 | Mobile nav hamburger menu works | P2 | All | Blocked: the mobile Playwright projects are commented out in `playwright.config.ts` |
| E2E-MOB-003 | PLP product grid adapts on mobile | P2 | All | Blocked: the mobile Playwright projects are commented out in `playwright.config.ts` |
| E2E-MOB-004 | PDP add to cart is accessible on mobile | P1 | All | Blocked: the mobile Playwright projects are commented out in `playwright.config.ts` |
| E2E-MOB-005 | Mini cart overlay is usable on mobile | P2 | All | Blocked: the mobile Playwright projects are commented out in `playwright.config.ts` |
| E2E-MOB-006 | Login modal is usable on mobile | P2 | All | Blocked: the mobile Playwright projects are commented out in `playwright.config.ts` |
| E2E-MOB-007 | Checkout form is navigable on mobile | P2 | All | Blocked: the mobile Playwright projects are commented out in `playwright.config.ts` |

---

### 7.23 Error handling (Phase 2)

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-ERR-002 | Search with invalid term shows empty results gracefully | P2 | All | Planned. Same live result as `E2E-SRCH-004` (fuzzy search on 3 sites). Possible duplicate of `E2E-SRCH-004`, flagged for the team but not retired |
| E2E-ERR-004 | Invalid promo code shows error | P2 | All | Retired: duplicate of E2E-CHKOUT-008. `checkout.spec.ts` already notes this in a comment: the E2E-CHKOUT-008 test also covers E2E-ERR-004 because the underlying behaviour is the same, so there is no separate spec |
| E2E-ERR-007 | Invalid email format at checkout triggers validation | P2 | All | Planned. Live: entering `qa.not-an-email` at the guest email step shows "Please enter a valid email address (Ex: johndoe@domain.com)." and keeps the modal open on the 6 sites reached (Platypus AU and Vans NZ not reached) |
| E2E-ERR-008 | Track Order with invalid order number shows error | P2 | All | Blocked: every Track Order lookup on all 8 staging sites returns "Order Tracking is unavailable temporarily, please try again later", so an order-not-found error cannot be told apart from a service outage |
| E2E-ERR-009 | Empty cart state is visible with correct messaging | P2 | All | Retired: duplicate of E2E-CART-011 |

---

### 7.24 Utilities (Phase 2)

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-UTIL-003 | Track Order FAQ accordion opens/closes correctly | P3 | Platypus AU, Platypus NZ, Skechers AU, Skechers NZ, Dr. Martens AU, Dr. Martens NZ | Planned. Live: the "ORDER DELIVERY FAQS" accordion expands and collapses on these 6. On Vans AU/NZ the FAQ is a static list with no accordion. Platypus keeps answer text in `innerText` even when collapsed, so assert on the answer's rendered height, not its text |
| E2E-UTIL-004 | Stores locator page loads | P2 | All | Planned. Live: `/stores` renders a postcode search on all 8 (a map on Vans and Dr. Martens, a results list on Platypus and Skechers) |
| E2E-UTIL-006 | Qantas landing page (/qantas) loads (AU only) | P3 | AU sites only | Planned. Live: a real landing page on Platypus AU, Skechers AU and Vans AU. On Dr. Martens AU the page body is the literal text `<script>alert('xss')</script>` (CMS test content), so the test fails there until that is fixed |
| E2E-UTIL-008 | Chat widget (Zendesk) is present and opens | P3 | All | Planned. Live: Zendesk Messaging (`iframe#launcher`, `window.zE`) is on all 8, and the launcher opens a "Messaging window" iframe. Opening it starts a conversation, so avoid sending messages |

---

### 7.25 Wishlist

`EcommerceWishlistPage` is guest-only today (no logged-in methods), and `EcommercePDPPage`/`EcommercePLPPage` have no heart-toggle methods yet. Any scenario below that requires login must use a freshly generated test account (`createFreshAccountCredentials()` in `test-accounts.ts`), never the shared per-brand account, so other specs don't break. On Vans AU, dismiss the Bloomreach acquisition popup (`dismissAcquisitionPopup()`) before interacting with PDP controls.

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-WISH-001 | Guest wishlist empty state | P2 | All | Automated. Alias of `E2E-UTIL-007` (`tests/ecommerce/smoke/utilities-smoke.spec.ts`); the underlying test ID/title is not renamed |
| E2E-WISH-002 | PDP heart-toggle add (logged in) | P2 | All | Planned. Needs a new `EcommercePDPPage` method |
| E2E-WISH-003 | PLP card heart-toggle add (logged in) | P2 | All | Planned. Needs a new `EcommercePLPPage` method. The PLP heart's accessible name is "Justify" (§3 #13) |
| E2E-WISH-004 | Wishlist page lists added item | P2 | All | Planned. Needs a new `EcommerceWishlistPage` method |
| E2E-WISH-005 | Remove item returns wishlist to empty state | P2 | All | Planned. Needs a new `EcommerceWishlistPage` method. Live: only a page-level "Delete All Items" control was seen, with no per-item "Remove" label (Platypus AU list with 1 item) |
| E2E-WISH-006 | Guest heart-click prompts sign-in | P2 | All | Blocked: live behaviour contradicts the premise. On all 8, a guest heart-click (PLP or PDP) silently saves to a guest wishlist (header badge "" → "1", no modal or toast), and the guest `/wishlist` lists the item with a "Please Sign in or Register" prompt. Needs a team decision to rewrite or retire; see Open Question #8 |
| E2E-WISH-007 | Persistence across logout/login | P2 | All | Planned |
| E2E-WISH-008 | Header badge count reflects items (assert delta, not absolute count) | P2 | All | Planned. Live: the `Toggle Wishlist` header badge increments for guests as well as logged-in users |
| E2E-WISH-009 | Move-to-bag from wishlist updates mini cart | P2 | All | Planned. Live: no "Move to bag" label was seen; wishlist cards carry "+ Quick Add" / "+ Add To Cart" instead |

---

### 7.26 Add review

Ratings, the review list and the write-a-review form are confirmed live on all 8 brands via Bazaarvoice (§2). The Q&A section does not render anywhere (see `E2E-REV-004`). Bazaarvoice renders client-side after hydration, so every scenario in this section must poll or wait instead of asserting immediately on page load. All Bazaarvoice UI sits in open shadow DOM: Playwright CSS locators pierce it, but `innerText` scans do not.

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-REV-001 | Star rating displays on PLP cards | P2 | All | Planned. Live: inline ratings (`data-bv-show="inline_rating"`) on rated cards on all 8; unrated products show none |
| E2E-REV-002 | Review section renders on PDP | P2 | All | Planned. Live: a "Rating Snapshot … Overall Rating" section on all 8 |
| E2E-REV-003 | "Write a Review" CTA is present | P2 | All | Planned. Live: present on all 8, but under an `aria-hidden` ancestor (§3 #13). On Vans the "Write a review" text is inert, and the form opens from the "Review this Product" star buttons |
| E2E-REV-004 | Q&A section is present | P2 | All | Blocked: no Q&A container (`data-bv-show="questions"`) renders on any PDP on any of the 8 sites, despite `questions_and_answers_enabled: true` in `storeConfig` |
| E2E-REV-005 | Reaching the review submission surface, without submitting | P2 | All | Planned. The live recon settled the open question: the form is a same-origin in-page modal (`role="dialog"`) inside Bazaarvoice's open shadow DOM on all 8, with no iframe and no new tab, so `FrameHelper` is not needed |
| E2E-REV-006 | Review form field validation | P2 | All | Planned. Live: an empty SUBMIT shows "Required: Overall Rating.", "Required: Nickname.", "Required: Email.", "Required: Agreements." on Platypus, Skechers and Dr. Martens. On Vans the only entry point (the star buttons) pre-fills the rating, so the empty-form check cannot run as written there |
| E2E-REV-007 | Review list pagination/sort | P3 | All | Planned. Data-dependent, later phase. Live: "Sort by" and Rating/Gender/Locale filters on all 8; "LOAD MORE" only where a product has more than 8 reviews (Vans `/old-skool-vn-0d3hy28-blk.html` 34, Skechers `/uno-stand-on-air-73690-bbk.html` 15, Dr. Martens `/1460-crazy-horse-11822203-gch.html` 12). No Platypus PDP had more than 5 |
| E2E-REV-008 | Full review submission | P1 | All | Manual, not to be automated: it writes into the real third-party Bazaarvoice instance under moderation, with no way to clean up and no deterministic pass/fail condition achievable within a test |

By default, Bazaarvoice accepts a review without a prior purchase or login, so any note claiming "write a review" needs either one is wrong (see the Phase 3 entry below).

---

### 7.27 Integration

| ID | Title | Priority | Sites | Automation Status |
|---|---|---|---|---|
| E2E-INT-001 | Add to Cart GraphQL mutation propagates to UI and analytics (datalayer) | P1 | All | Automated |

Implemented in `tests/ecommerce/integration/add-to-cart-integration.spec.ts` as site-indexed IDs (`E2E-INT-001-001` … `E2E-INT-001-008`), tagged `@ecommerce @integration @regression`.

---

## Phase 3: keep manual (no automation)

| Scenario | Reason |
|---|---|
| Track Order with real order number | Requires live order IDs |
| Qantas Points / Loyalty balance verification | Requires a live account with earned points |
| Find in Store | Requires geo data / store inventory API |
| Password reset email | Requires email interception setup |
| "Write a review" (E2E-REV-008) | Writes into the real third-party Bazaarvoice instance under moderation, with no way to clean up and no deterministic pass/fail condition. The reason is not a purchase or login requirement: Bazaarvoice accepts submissions without either by default, and an earlier version of this row said otherwise |

---

## 8. Test data plan

| Data Need | Strategy |
|---|---|
| Stable test products (in-stock) | Seed list of SKUs per site, confirmed in stock, exported from `test-products.ts`. `pdpPath` in `storefronts.ts` is still a placeholder on all 8; working slugs confirmed live on 2026-09-26 are listed in the Live re-assessment section |
| Guest checkout email | Dynamic: `createGuestCheckoutEmail()` in `test-accounts.ts` |
| Registered test accounts | One static account per brand in `test-accounts.ts`, password via `GRA_TEST_PASSWORD` (`.env.staging`, never committed) |
| Fresh, disposable accounts | `createFreshAccountCredentials(brandCode)` in `test-accounts.ts`. Required for any scenario that logs in and changes account state (password change, wishlist, address book), so the shared per-brand account is never left dirty for other specs |
| Promo codes | Valid: `test`, a live 10% "test rule" on the staging storefronts (see the `E2E-CHKOUT-007` result under §7.17). Invalid: `PromoCodes.invalidCode` (`QA-NOPE-99999`) in `src/data/ecommerce/promo-codes.ts`. Follow-up: add a typed `validCode` entry to `promo-codes.ts` before automating `E2E-CHKOUT-007` |
| Free shipping threshold | Per-site value needed (live values in §1). Follow-up: add a threshold field to `storefronts.ts` instead of hardcoding $150 |
| Zero-result search term | A per-site term proven to return 0 products. The gibberish term `zzqxnomatch9731` still returns products on Platypus AU/NZ and Skechers NZ |
| Order numbers (Track Order) | Maintain a list of placed test orders per region |
| Skechers NZ Spend & Save | Cart seeded with $110 / $170 / $200 worth of items |
| Currency assertions | Use a regex: `/\$[\d,]+\.\d{2}/`. Do not assert exact prices |
| Brand/loyalty name | `storefronts.ts` exports `brandName`, `loyaltyProgramName` per site |

---

## 9. CI/CD execution plan

| Trigger | Suite | Scope | Parallelism |
|---|---|---|---|
| PR / Push | Smoke | `@smoke`; each spec loops over all 8 storefronts internally | `chromium` project only in CI (firefox skips `ecommerce/smoke`, `regression`, `integration`, `accessibility` in CI per `playwright.config.ts` `testIgnore`); the `WORKERS` env var controls concurrency |
| Nightly | Full regression | `@regression` + `@smoke` | 50% workers (`npm test` default) |
| Pre-release | Full | All tags | Full parallelism |

Run commands (the full list is in `package.json`):
```bash
npm run test:simple                # chromium only, 1 worker — fast smoke, all 8 storefronts via the loop inside each spec
npm test                           # chromium + firefox, 50% workers
npx playwright test tests/ecommerce/smoke --grep @smoke
npx playwright test --grep "E2E-HOME-001"

# Per-brand API projects (api.config.ts) — the only place per-site "projects" actually exist
npm run test:api:gra               # pla-au, skx-au, drm-au, van-au, pla-nz, skx-nz, drm-nz, van-nz
```

**Flaky test strategy:**
- Tag unstable tests `@quarantine` and run them separately, non-blocking on PR
- Retry 2× on CI (existing config in `playwright.config.ts`)
- Use the `monocart-reporter` trend/history and the GitHub Actions step summary to detect flakiness (not Allure; this repo has no Allure dependency)

---

## 10. Risks and mitigations

| # | Risk | Mitigation |
|---|---|---|
| 1 | Cart/checkout requires seeded items | Seed the cart via GraphQL (`createEmptyCart` / `addProductsToCart`); see `tests/api/gra-cart-minicart.spec.ts` |
| 2 | ServiceWorker errors cause test flakiness | `serviceWorkers` is not configured in `playwright.config.ts`. The `consoleHelper` auto-fixture captures console and page errors and attaches them when a UI test fails. Treat an explicit `serviceWorkers: 'block'` as a future hardening option, not an existing safeguard |
| 3 | Third-party widgets (Afterpay, PayPal messaging, TrueFit, Vimeo, Zendesk) | Cross-origin iframes (PayPal message, TrueFit, Vimeo, Zendesk): assert presence only, via `this.frames` (`FrameHelper`). Afterpay is not an iframe but an inline shadow-DOM web component; read it with a piercing locator (§3 #6) |
| 4 | Promotion banners are data-driven text | Use structural assertions (element visible), not exact text matching |
| 5 | AU/NZ data divergence on loyalty | Test the loyalty join flow per region independently using `storefronts.ts` |
| 6 | Presale products are time-limited | Keep presale SKUs out of regression; use standard in-stock products |
| 7 | Staging CMS content is broken or placeholder on several pages (mislinked tiles, soft 404s returning HTTP 200, Lorem Ipsum, "SAVE 0%") | Assert on structure, title or text instead of status codes and exact copy, and pick in-viewport, correctly linked elements by `href` (§3 #13 and #14) |

---

## 11. Open questions

| # | Question | Status / Recommendation |
|---|---|---|
| 1 | Are there stable test accounts for all 8 sites? | Resolved. `test-accounts.ts` defines one stable account per brand via `GRA_TEST_PASSWORD`; use `createFreshAccountCredentials()` for scenarios that change account state |
| 2 | Is there an API to seed cart items? | Resolved. GraphQL (`GraphQLClient`), not Magento REST; see `gra-cart-minicart.spec.ts` |
| 3 | Does Skechers NZ Spend & Save apply at cart or order level? | Still open. Confirm with the product team (blocks `E2E-CHKOUT-010`) |
| 4 | Are presale products automatable (stable SKUs)? | Avoid them; use standard in-stock products |
| 5 | Is accessibility scanning expected? | Resolved. Already implemented: the `makeAxeBuilder` fixture plus `tests/ecommerce/accessibility/accessibility-smoke.spec.ts`, tagged `@accessibility` |
| 6 | Which free-shipping threshold is authoritative where the copy conflicts (Platypus AU, Skechers AU, Vans NZ, Dr. Martens NZ)? | Open, raised 2026-09-26. Until it is answered, assert against the cart's "You're $X away" line, which reflects the basket logic |
| 7 | Is Bazaarvoice Q&A intentionally switched off on the storefront despite `questions_and_answers_enabled: true`? | Open. Blocks `E2E-REV-004` |
| 8 | Guests can save to a wishlist without signing in. Should `E2E-WISH-006` ("Guest heart-click prompts sign-in") be rewritten to assert the guest wishlist, or retired? | Open. Blocks `E2E-WISH-006` |
| 9 | When will Track Order return real results on staging? Every lookup currently returns "Order Tracking is unavailable temporarily" | Open. Blocks `E2E-ERR-008` |
| 10 | Duplicate pairs found during the live pass: `E2E-ERR-002` / `E2E-SRCH-004` and `E2E-NAV-010` / `E2E-PDP-018` | Open. Same handling as the `E2E-CHKOUT-003` / `E2E-CHKOUT-014` pair: flagged, not retired |

---

## 12. Automation prioritization matrix

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
| Add / view review | Medium | Medium | Medium | Phase 2 (display only; submission stays manual) |
| Forgot password | Medium | Low | Medium | Phase 2 or manual |
| Payment failure | High | Low | Medium | Partial, up to method selection |
| Visual merchandising | Low | High | Low | Manual or visual regression |
