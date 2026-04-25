# E2E Flow Discovery Report — Agent Implementation Brief

> Exported from: E2E-Discovery-Report.pdf (March 20, 2026)
> Purpose: Full context for QA agents to plan, build, and verify automation across 4 e-commerce storefronts.
> Total scenarios documented: 108 across 13 feature areas.
> Sites covered: 8 storefronts (Platypus, Skechers, Vans, Dr. Martens — AU + NZ each). Vans and Dr. Martens nav links pending staging configuration.

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

| Feature | Platypus AU | Platypus NZ | Skechers AU | Skechers NZ |
|---|---|---|---|---|
| Currency | AUD | NZD | AUD | NZD |
| Qantas Points | Yes | **No** | Yes | **No** |
| Loyalty Program | Kicks Club | Kicks Club | Skechers Insider | Skechers Insider |
| CLOTHING nav | No | No | Yes | **No** |
| PRESALE nav | Yes | Yes | **No** | **No** |
| BRANDS nav | Yes | Yes | **No** | **No** |
| Spend & Save promo | No | No | No | **Yes** |
| BNPL (Afterpay/PayPal) | Yes | Yes | Yes | Yes |
| Free shipping threshold | $150 | $150 | $150 | $150 |
| Zendesk chat | inferred | inferred | Yes | Yes |

### Vans & Dr. Martens — Regional Differences

> Nav links are pending staging configuration for all four sites (`navLinks: []` in `storefronts.ts`). Features marked **TBD** require site profiling once staging is configured.

| Feature | Vans AU | Vans NZ | Dr. Martens AU | Dr. Martens NZ |
|---|---|---|---|---|
| Currency | AUD | NZD | AUD | NZD |
| Qantas Points | Yes | **No** | Yes | **No** |
| Loyalty Program | TBD | TBD | TBD | TBD |
| Nav links configured | **No (pending)** | **No (pending)** | **No (pending)** | **No (pending)** |
| WOMENS nav | TBD | TBD | TBD | TBD |
| CLOTHING nav | TBD | TBD | TBD | TBD |
| PRESALE nav | TBD | TBD | TBD | TBD |
| BRANDS nav | TBD | TBD | TBD | TBD |
| Spend & Save promo | TBD | TBD | TBD | TBD |
| BNPL (Afterpay/PayPal) | TBD | TBD | TBD | TBD |
| Free shipping threshold | TBD | TBD | TBD | TBD |
| Zendesk chat | TBD | TBD | TBD | TBD |

---

## 2. Consolidated Feature Inventory

| Module | Platypus AU | Platypus NZ | Skechers AU | Skechers NZ |
|---|---|---|---|---|
| Homepage hero + banners | Yes | Yes | Yes | Yes |
| Top bar with promos | Yes | Yes | Yes | Yes |
| Qantas Points integration | Yes | No | Yes | No |
| Navigation menu | Yes | Yes | Yes | Yes |
| Search (inline) | Yes | Yes | Yes | Yes |
| Wishlist page | Yes | Yes | Yes | Yes |
| Account modal (login/register) | Yes | Yes | Yes | Yes |
| Mini cart overlay | Yes | Yes | Yes | Yes |
| PLP with filters + sort | Yes | Yes | Yes | Yes |
| PLP Quick Add | Yes | Yes | Yes | Yes |
| PDP with variants | Yes | Yes | Yes | Yes |
| Size selector + size chart | Yes | Yes | Yes | Yes |
| "What's My Size?" widget | Yes | Yes | inferred | inferred |
| Find in Store | Yes | Yes | inferred | inferred |
| Afterpay / BNPL messaging | Yes | Yes | Yes | Yes |
| Track Order (guest) | Yes | Yes | Yes | Yes |
| Stores locator | Yes | Yes | Yes | Yes |
| Help center | Yes | Yes | Yes | Yes |
| PRESALE category | Yes | Yes | No | No |
| BRANDS directory | Yes | Yes | No | No |
| CLOTHING category | No | No | Yes | No |
| Spend & Save promo | No | No | No | Yes |
| Vimeo product video | Yes | inferred | inferred | inferred |
| Product ratings/reviews | Yes | Yes | Yes | Yes |
| 404 error page | Yes | Yes | Yes | Yes |

### Vans & Dr. Martens — Feature Coverage

> Vans and Dr. Martens share the same Adobe Commerce / PWA-style stack. Features below reflect what is confirmed from staging access. Items marked **TBD** require profiling after nav staging config is complete.

| Module | Vans AU | Vans NZ | Dr. Martens AU | Dr. Martens NZ |
|---|---|---|---|---|
| Homepage hero + banners | Yes | Yes | Yes | Yes |
| Top bar with promos | Yes | Yes | Yes | Yes |
| Qantas Points integration | Yes | No | Yes | No |
| Navigation menu | **TBD (pending nav config)** | **TBD (pending nav config)** | **TBD (pending nav config)** | **TBD (pending nav config)** |
| Search (inline) | TBD | TBD | TBD | TBD |
| Wishlist page | TBD | TBD | TBD | TBD |
| Account modal (login/register) | TBD | TBD | TBD | TBD |
| Mini cart overlay | TBD | TBD | TBD | TBD |
| PLP with filters + sort | TBD | TBD | TBD | TBD |
| PDP with variants | TBD | TBD | TBD | TBD |
| Afterpay / BNPL messaging | TBD | TBD | TBD | TBD |
| 404 error page | TBD | TBD | TBD | TBD |

---

## 3. Test Constraints — Agents Must Know These

1. **Checkout flow** requires items in cart first; empty cart redirects to homepage. Use Magento REST API `POST /rest/V1/carts` to seed cart before checkout tests.
2. **Authentication** uses a modal overlay. The Magento URL `/customer/account/login` returns a 404. All login tests must trigger the **header account icon**, not navigate directly to a URL.
3. **Loyalty programs** (Kicks Club / Skechers Insider) may require dedicated test accounts and promo sandbox data.
4. **Qantas Points** is AU-only — requires AU-specific test account configuration.
5. **Payment flow** (Afterpay, PayPal, card) cannot be fully automated end-to-end without sandbox credentials. Test up to payment method selection step only.
6. **"What's My Size?" and BNPL widgets** are third-party iframes — cross-origin restrictions limit automation. Assert presence of the iframe, not content inside.
7. **Presale products** are data-driven and time-limited — avoid using them in stable regression tests. Use standard in-stock products.
8. **Spend & Save** (Skechers NZ) is basket-threshold triggered ($110/$170/$200). Seed cart to exact threshold amount to test.
9. **Find in Store** requires geo data / store inventory API — assert button visibility only.
10. **ServiceWorker** registration failures observed in browser console — disable service workers in Playwright browser context to avoid flakiness.
11. **Vimeo video embeds** are third-party iframes — assert the iframe is present, do not attempt playback automation.
12. **StarTrack tracking** in Track Order is third-party — only the form submission step is automatable.

---

## 4. Proposed Folder Structure (Framework Mapping)

```
tests/
  ecommerce/
    smoke/
      homepage.spec.ts          @smoke @ecommerce
      navigation.spec.ts        @smoke @ecommerce
      search.spec.ts            @smoke @ecommerce
      pdp.spec.ts               @smoke @ecommerce
      cart.spec.ts              @smoke @ecommerce
      auth.spec.ts              @smoke @ecommerce
      localization.spec.ts      @smoke @ecommerce
      error-handling.spec.ts    @smoke @ecommerce
    regression/
      plp-filters.spec.ts       @regression @ecommerce
      checkout.spec.ts          @regression @ecommerce
      localization.spec.ts      @regression @ecommerce
      account.spec.ts           @regression @ecommerce
      mobile.spec.ts            @regression @mobile @ecommerce

src/
  pages/
    ecommerce/
      base-commerce-page.ts     (header, footer, nav, search, cart icon, account modal trigger)
      home-page.ts
      plp-page.ts
      pdp-page.ts
      cart-overlay.ts
      checkout-page.ts
      account-modal.ts
      login-modal.ts
      track-order-page.ts

  data/
    ecommerce/
      platypus-au-data.ts       (site-specific URLs, expected strings, AUD prices)
      platypus-nz-data.ts       (NZD prices, no Qantas)
      skechers-au-data.ts       (CLOTHING nav, Skechers Insider)
      skechers-nz-data.ts       (Spend & Save thresholds, NZD)
      test-products.ts          (stable in-stock SKUs per site)
      test-accounts.ts          (login credentials from .env.staging)
```

---

## 5. Key Page Object Methods (Required Core API)

| Page Object | Methods to Implement |
|---|---|
| `BaseCommercePage` | `openNav()`, `search(term)`, `openMiniCart()`, `openAccountModal()`, `clickLogo()` |
| `AccountModal` | `login(email, pass)`, `openRegister()`, `forgotPassword()`, `getErrorMessage()` |
| `PLPPage` | `applyFilter(type, value)`, `clearAllFilters()`, `getProductCount()`, `clickProduct(index)`, `quickAdd(index)` |
| `PDPPage` | `selectSize(size)`, `selectColour(colour)`, `addToCart()`, `getPrice()`, `getProductName()`, `isAddToCartEnabled()` |
| `CartOverlay` | `getItemCount()`, `removeItem(index)`, `getTotal()`, `proceedToCheckout()`, `isEmpty()` |
| `CheckoutPage` | `fillShipping(data)`, `selectShippingMethod()`, `applyPromo(code)`, `getPromoError()`, `getOrderTotal()`, `getOrderNumber()` |

**Selector strategy (in priority order):**
1. `getByRole()` — first choice
2. `getByLabel()`, `getByPlaceholder()`, `getByText()`
3. `getByTestId()` (data-testid)
4. CSS selector — last resort only

---

## 6. Playwright Multi-Site Project Config

```ts
// playwright.config.ts — add these projects for all 8 sites
{ name: 'platypus-au',  use: { baseURL: process.env.PLATYPUS_AU_URL } },
{ name: 'platypus-nz',  use: { baseURL: process.env.PLATYPUS_NZ_URL } },
{ name: 'skechers-au',  use: { baseURL: process.env.SKECHERS_AU_URL } },
{ name: 'skechers-nz',  use: { baseURL: process.env.SKECHERS_NZ_URL } },
{ name: 'vans-au',      use: { baseURL: process.env.VANS_AU_URL } },
{ name: 'vans-nz',      use: { baseURL: process.env.VANS_NZ_URL } },
{ name: 'drmartens-au', use: { baseURL: process.env.DRMARTENS_AU_URL } },
{ name: 'drmartens-nz', use: { baseURL: process.env.DRMARTENS_NZ_URL } },
```

```bash
# .env.staging entries required
PLATYPUS_AU_URL=https://stag-platypus-au.accentgra.com
PLATYPUS_NZ_URL=https://stag-platypus-nz.accentgra.com
SKECHERS_AU_URL=https://stag-skechers-au.accentgra.com
SKECHERS_NZ_URL=https://stag-skechers-nz.accentgra.com
VANS_AU_URL=https://stag-vans-au.accentgra.com
VANS_NZ_URL=https://stag-vans-nz.accentgra.com
DRMARTENS_AU_URL=https://stag-drmartens-au.accentgra.com
DRMARTENS_NZ_URL=https://stag-drmartens-nz.accentgra.com
```

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

---

## Phase 1 — Automate Immediately (Smoke + Critical Path)

~42 scenarios × 4 sites = **~168 test executions**

### 7.1 Homepage

| ID | Title | Priority | Sites |
|---|---|---|---|
| E2E-HOME-001 | Homepage loads with correct title and hero banner | P1 | All |
| E2E-HOME-002 | Top bar promotional message is visible | P2 | All |
| E2E-HOME-003 | Qantas Points link is visible on AU sites only (absent on NZ) | P2 | All |

**Sample — E2E-HOME-001:**
- Preconditions: Staging env accessible, no auth required
- Steps: Navigate to site root `/` → wait for page title → assert hero banner visible above fold
- Expected: Page title includes brand name; hero banner visible

**Sample — E2E-HOME-003 (localization check):**
- Steps: Navigate to AU site root → assert Qantas link visible. Navigate to NZ site root → assert Qantas link absent.
- Data note: `platypus-au-data.ts` should export `qantasLinkText = 'Earn 2 Qantas Points'`

---

### 7.2 Navigation

| ID | Title | Priority | Sites |
|---|---|---|---|
| E2E-NAV-001 | All top-nav links render and are clickable | P1 | All |
| E2E-NAV-002 | WOMENS/WOMEN link navigates to womens PLP | P1 | All |
| E2E-NAV-003 | MENS link navigates to mens PLP | P1 | All |
| E2E-NAV-004 | KIDS link navigates to kids PLP | P1 | All |
| E2E-NAV-005 | SALE link navigates to sale PLP | P1 | All |
| E2E-NAV-009 | Logo click returns to homepage from any page | P1 | All |

---

### 7.3 Search

| ID | Title | Priority | Sites |
|---|---|---|---|
| E2E-SRCH-001 | Search returns results for a known product | P1 | All |
| E2E-SRCH-006 | Clicking search icon or pressing Enter submits search | P1 | All |

**Data note:** `test-products.ts` must export a `searchTerm` per site that is confirmed to return results (e.g. `'Nike'` for Platypus, `'Go Walk'` for Skechers).

---

### 7.4 Product Listing Page (PLP)

| ID | Title | Priority | Sites |
|---|---|---|---|
| E2E-PLP-001 | PLP loads with product grid visible | P1 | All |
| E2E-PLP-004 | Filter by Category reduces product count | P1 | All |
| E2E-PLP-006 | Filter by Size reduces product count | P1 | All |
| E2E-PLP-011 | Quick Add button opens size selector or adds item | P1 | All |
| E2E-PLP-012 | Clicking product card image navigates to PDP | P1 | All |

---

### 7.5 Product Detail Page (PDP)

| ID | Title | Priority | Sites |
|---|---|---|---|
| E2E-PDP-001 | PDP loads with product name, price, and image gallery | P1 | All |
| E2E-PDP-002 | Colour swatch selection updates product images | P1 | All |
| E2E-PDP-004 | Size selector shows correct sizes (US MENS/WOMENS toggle) | P1 | All |
| E2E-PDP-005 | Selecting a size enables Add to Cart button | P1 | All |
| E2E-PDP-006 | Add to Cart without selecting size shows validation message | P1 | All |
| E2E-PDP-007 | Add to Cart adds item and updates mini cart count | P1 | All |

**Agent note on E2E-PDP-006:** Button may be disabled OR may show an error toast — confirm behaviour per site before asserting specific message text.

---

### 7.6 Cart

| ID | Title | Priority | Sites |
|---|---|---|---|
| E2E-CART-001 | Mini cart shows 0 items when empty | P1 | All |
| E2E-CART-002 | Mini cart shows item count after Add to Cart | P1 | All |
| E2E-CART-003 | Mini cart overlay opens on cart icon click | P1 | All |
| E2E-CART-004 | Mini cart shows product name, size, price | P1 | All |
| E2E-CART-005 | Removing item from mini cart decrements count | P1 | All |
| E2E-CART-008 | Cart total updates correctly | P1 | All |
| E2E-CART-011 | Empty cart state renders "Your Shopping Cart is empty" | P2 | All |

---

### 7.7 Authentication

| ID | Title | Priority | Sites |
|---|---|---|---|
| E2E-AUTH-001 | Login modal opens via account icon in header | P1 | All |
| E2E-AUTH-002 | Successful login with valid credentials | P1 | All |
| E2E-AUTH-003 | Failed login with invalid password shows error | P1 | All |
| E2E-AUTH-004 | Failed login with non-existent email shows error | P1 | All |
| E2E-AUTH-010 | Logout clears session and redirects | P1 | All |
| E2E-AUTH-011 | Login modal title matches brand | P2 | All |

**Constraint:** Login modal is triggered by the header account icon, NOT by navigating to `/customer/account/login` (returns 404).

**Data note:** `test-accounts.ts` must export `validUser: { email, password }` and `invalidUser: { email, password }` per site. Load from `.env.staging`.

---

### 7.8 Localization

| ID | Title | Priority | Sites |
|---|---|---|---|
| E2E-LOC-001 | AU site displays AUD prices | P1 | Platypus AU, Skechers AU |
| E2E-LOC-002 | NZ site displays NZD prices | P1 | Platypus NZ, Skechers NZ |
| E2E-LOC-003 | AU sites show Qantas Points; NZ sites do not | P2 | All |
| E2E-LOC-004 | Skechers AU has CLOTHING nav; Skechers NZ does not | P2 | Skechers AU, Skechers NZ |
| E2E-LOC-007 | Correct brand name / loyalty program name per site | P2 | All |

---

### 7.9 Error Handling

| ID | Title | Priority | Sites |
|---|---|---|---|
| E2E-ERR-001 | 404 page shows correct brand error UI with "Back to Home" | P1 | All |
| E2E-ERR-003 | Add to Cart without size selection shows validation | P1 | All |
| E2E-ERR-005 | Login with wrong password shows error | P1 | All |
| E2E-ERR-006 | Checkout required fields blank shows validation | P1 | All |

---

### 7.10 Utilities

| ID | Title | Priority | Sites |
|---|---|---|---|
| E2E-UTIL-001 | Track Order page loads and form is present | P1 | All |
| E2E-UTIL-005 | Help/Support page accessible via header link | P2 | All |
| E2E-UTIL-007 | Wishlist page renders (empty state for guest) | P2 | All |

---

## Phase 2 — Automate Later (High-Value Regression)

Requires additional setup: cart fixtures via Magento REST API, test account credentials per site.

### 7.11 Homepage (Phase 2)

| ID | Title | Priority | Sites |
|---|---|---|---|
| E2E-HOME-004 | Carousel navigates forward/backward with dot pagination | P2 | All |
| E2E-HOME-005 | Quick-link category tiles navigate to correct PLP | P2 | All |
| E2E-HOME-006 | Homepage product tiles link to correct PDPs | P2 | All |
| E2E-HOME-007 | Free shipping threshold banner is displayed correctly | P3 | All |

---

### 7.12 Navigation (Phase 2)

| ID | Title | Priority | Sites |
|---|---|---|---|
| E2E-NAV-006 | BRANDS link navigates to brands page (Platypus only) | P2 | Platypus AU, Platypus NZ |
| E2E-NAV-007 | CLOTHING link navigates to clothing PLP (Skechers AU only) | P2 | Skechers AU |
| E2E-NAV-008 | PRESALE link navigates to presale PLP (Platypus only) | P2 | Platypus AU, Platypus NZ |
| E2E-NAV-010 | Breadcrumbs on PDP are correct and navigable | P2 | All |

---

### 7.13 Search (Phase 2)

| ID | Title | Priority | Sites |
|---|---|---|---|
| E2E-SRCH-002 | Search input placeholder text is correct per brand | P2 | All |
| E2E-SRCH-003 | Search with empty term shows appropriate feedback | P2 | All |
| E2E-SRCH-004 | Search for non-existent term shows no-results state | P2 | All |
| E2E-SRCH-005 | Search autocomplete/suggestions appear while typing | P2 | All |

**Data note:** Platypus placeholder = `"Find products, colours, fits..."`. Skechers placeholder = `"What are you looking for?"`. Store per-site in data modules.

---

### 7.14 PLP (Phase 2)

| ID | Title | Priority | Sites |
|---|---|---|---|
| E2E-PLP-002 | Product card shows brand, name, price, colour swatches | P2 | All |
| E2E-PLP-003 | Sale badge renders correctly on qualifying products | P2 | All |
| E2E-PLP-005 | Filter by Silhouette/Style reduces product count | P2 | All |
| E2E-PLP-007 | Filter by Colour reduces product count | P2 | All |
| E2E-PLP-008 | Multiple filters can be applied simultaneously | P2 | All |
| E2E-PLP-009 | Sort options work (Most popular default) | P2 | All |
| E2E-PLP-010 | Wishlist heart icon toggles on product card | P2 | All |
| E2E-PLP-013 | Gender sub-tabs on Sale page filter correctly (Skechers) | P2 | Skechers AU, Skechers NZ |
| E2E-PLP-014 | Product count reflects applied filters | P2 | All |
| E2E-PLP-015 | Clearing all filters restores full product count | P2 | All |

---

### 7.15 PDP (Phase 2)

| ID | Title | Priority | Sites |
|---|---|---|---|
| E2E-PDP-003 | Colour swatch links navigate to correct variant URL | P2 | All |
| E2E-PDP-008 | Afterpay split payment message shows correct instalment | P2 | All |
| E2E-PDP-009 | Qantas Points earn message shows on AU sites | P2 | AU sites only |
| E2E-PDP-010 | Kicks Club / Skechers Insider CTA is visible | P2 | All |
| E2E-PDP-011 | Star rating and review count are displayed | P3 | All |
| E2E-PDP-013 | Size Chart link opens size guide | P2 | All |
| E2E-PDP-014 | "What's My Size?" widget loads (iframe present) | P3 | All |
| E2E-PDP-016 | Wishlist toggle works on PDP | P2 | All |
| E2E-PDP-017 | Product video (Vimeo iframe) loads on applicable PDPs | P3 | Platypus AU |
| E2E-PDP-018 | Breadcrumb trail is correct (Home / Brand / Category) | P2 | All |
| E2E-PDP-019 | BUY 2 GET 20% OFF badge visible on qualifying products | P2 | All |

---

### 7.16 Cart (Phase 2)

| ID | Title | Priority | Sites |
|---|---|---|---|
| E2E-CART-006 | "Continue Shopping" button closes cart overlay | P2 | All |
| E2E-CART-007 | Adding same product in different size creates separate line item | P2 | All |
| E2E-CART-009 | "BUY 2 GET 20% OFF" discount applies with 2 qualifying items | P1 | All |
| E2E-CART-010 | Promo/discount code field is visible at checkout entry | P1 | All |

---

### 7.17 Checkout (Phase 2 — requires cart fixture)

| ID | Title | Priority | Sites |
|---|---|---|---|
| E2E-CHKOUT-001 | Checkout page loads after items added to cart | P1 | All |
| E2E-CHKOUT-002 | Guest checkout: email entry step is presented | P1 | All |
| E2E-CHKOUT-003 | Shipping address form: all required fields validated | P1 | All |
| E2E-CHKOUT-004 | Shipping method selection updates order total | P1 | All |
| E2E-CHKOUT-006 | Order review step shows correct items, quantities, total | P1 | All |
| E2E-CHKOUT-007 | Promo code accepted reduces order total | P1 | All |
| E2E-CHKOUT-008 | Invalid promo code shows error message | P2 | All |
| E2E-CHKOUT-009 | Logged-in checkout pre-fills saved address | P2 | All |
| E2E-CHKOUT-010 | Spend & Save discount applies at threshold (Skechers NZ only) | P1 | Skechers NZ |
| E2E-CHKOUT-011 | Order confirmation page shows order number | P1 | All |
| E2E-CHKOUT-012 | Empty cart redirects away from checkout | P2 | All |
| E2E-CHKOUT-013 | Free shipping threshold ($150) applied correctly | P2 | All |
| E2E-CHKOUT-014 | Required field validation on shipping form | P2 | All |
| E2E-CHKOUT-015 | Cross-site currency: AUD on AU, NZD on NZ | P2 | All |

**Cart fixture pattern:**
```ts
// Before checkout tests — seed cart via Magento REST API
const cartId = await apiClient.post('/rest/V1/carts/mine', {});
await apiClient.post(`/rest/V1/carts/${cartId}/items`, {
  cartItem: { sku: TestProducts.stableSkuPlatypusAU, qty: 1, quote_id: cartId }
});
```

---

### 7.18 Authentication (Phase 2)

| ID | Title | Priority | Sites |
|---|---|---|---|
| E2E-AUTH-005 | "Forgot your password?" link is accessible | P2 | All |
| E2E-AUTH-007 | "Remember me" checkbox is checked by default | P3 | All |
| E2E-AUTH-008 | Register new account via "JOIN NOW" | P1 | All |
| E2E-AUTH-009 | Duplicate email registration shows error | P2 | All |

**Data note:** Registration tests must use dynamic email: `test+${Date.now()}@example.com`

---

### 7.19 Account (Phase 2 — requires logged-in state)

| ID | Title | Priority | Sites |
|---|---|---|---|
| E2E-ACCT-001 | Account dashboard is accessible after login | P1 | All |
| E2E-ACCT-002 | Order history shows past orders | P2 | All |
| E2E-ACCT-003 | Address book: add new address | P2 | All |
| E2E-ACCT-004 | Address book: edit existing address | P2 | All |
| E2E-ACCT-005 | Profile update: change name/email | P2 | All |
| E2E-ACCT-006 | Wishlist saved items persist after login | P2 | All |

---

### 7.20 Localization (Phase 2)

| ID | Title | Priority | Sites |
|---|---|---|---|
| E2E-LOC-005 | Skechers NZ Spend & Save displayed with correct thresholds ($110/$170/$200) | P2 | Skechers NZ |
| E2E-LOC-006 | Free shipping threshold reads correctly per region | P2 | All |

---

### 7.21 Mobile / Responsive (Phase 2)

All mobile tests use 375px viewport.

| ID | Title | Priority | Sites |
|---|---|---|---|
| E2E-MOB-001 | Homepage renders correctly on 375px viewport | P2 | All |
| E2E-MOB-002 | Mobile nav hamburger menu works | P2 | All |
| E2E-MOB-003 | PLP product grid adapts on mobile | P2 | All |
| E2E-MOB-004 | PDP add to cart is accessible on mobile | P1 | All |
| E2E-MOB-005 | Mini cart overlay is usable on mobile | P2 | All |
| E2E-MOB-006 | Login modal is usable on mobile | P2 | All |
| E2E-MOB-007 | Checkout form is navigable on mobile | P2 | All |

---

### 7.22 Error Handling (Phase 2)

| ID | Title | Priority | Sites |
|---|---|---|---|
| E2E-ERR-002 | Search with invalid term shows empty results gracefully | P2 | All |
| E2E-ERR-004 | Invalid promo code shows error | P2 | All |
| E2E-ERR-007 | Invalid email format at checkout triggers validation | P2 | All |
| E2E-ERR-008 | Track Order with invalid order number shows error | P2 | All |
| E2E-ERR-009 | Empty cart state is visible with correct messaging | P2 | All |

---

### 7.23 Utilities (Phase 2)

| ID | Title | Priority | Sites |
|---|---|---|---|
| E2E-UTIL-003 | Track Order FAQ accordion opens/closes correctly | P3 | All |
| E2E-UTIL-004 | Stores locator page loads | P2 | All |
| E2E-UTIL-006 | Qantas landing page (/qantas) loads (AU only) | P3 | AU sites only |
| E2E-UTIL-008 | Chat widget (Zendesk) is present and opens | P3 | Skechers AU, Skechers NZ |

---

## Phase 3 — Keep Manual (No Automation)

| Scenario | Reason |
|---|---|
| Payment full E2E (Afterpay, PayPal, card) | Requires sandbox credentials per payment provider |
| Track Order with real order number | Requires live order IDs |
| Qantas Points / Loyalty balance verification | Requires live account with earned points |
| Find in Store | Requires geo data / store inventory API |
| Password reset email | Requires email interception setup |
| "Write a review" | Requires logged-in account with purchased product |

---

## 8. Test Data Plan

| Data Need | Strategy |
|---|---|
| Stable test products (in-stock) | Seed list of SKUs per site, confirmed in-stock. Export from `test-products.ts` |
| Guest checkout email | Dynamic: `test+${Date.now()}@example.com` |
| Registered test accounts | Static credentials per site stored in `.env.staging` (never committed) |
| Promo codes | Request from merchandising team; store in `.env.staging` |
| Order numbers (Track Order) | Maintain list of placed test orders per region |
| Skechers NZ Spend & Save | Cart seeded with $110 / $170 / $200 worth of items |
| Currency assertions | Use regex: `/\$[\d,]+\.\d{2}/` — do not assert exact prices |
| Brand/loyalty name | Per-site data module exports `brandName`, `loyaltyProgramName` |

---

## 9. CI/CD Execution Plan

| Trigger | Suite | Scope | Parallelism |
|---|---|---|---|
| PR / Push | Smoke | `@smoke` across 8 sites | 8 projects × ~6 specs |
| Nightly | Full regression | `@regression` + `@smoke` | 50% workers |
| Pre-release | Full + mobile | All tags | Full parallelism |

**CLI commands per site:**
```bash
# Platypus
npx playwright test --project=platypus-au --grep @smoke
npx playwright test --project=platypus-nz --grep @smoke

# Skechers
npx playwright test --project=skechers-au --grep @smoke
npx playwright test --project=skechers-nz --grep @smoke

# Vans
npx playwright test --project=vans-au --grep @smoke
npx playwright test --project=vans-nz --grep @smoke

# Dr. Martens
npx playwright test --project=drmartens-au --grep @smoke
npx playwright test --project=drmartens-nz --grep @smoke
```

**Flaky test strategy:**
- Tag unstable tests `@quarantine` — run separately, non-blocking on PR
- Retry 2× on CI (existing config in `playwright.config.ts`)
- HTML + Allure trend reporting for flakiness detection

---

## 10. Risks and Mitigations

| # | Risk | Mitigation |
|---|---|---|
| 1 | Cart/checkout requires seeded items | Use Magento REST API `POST /rest/V1/carts` to seed items before checkout tests |
| 2 | ServiceWorker errors cause test flakiness | Disable SW in Playwright browser context: `serviceWorkers: 'block'` |
| 3 | Third-party iframes (Afterpay, Vimeo, Zendesk) | Assert iframe presence only — no deep interaction inside cross-origin iframes |
| 4 | Promotion banners are data-driven text | Use structural assertions (element visible), not exact text matching |
| 5 | AU/NZ data divergence on loyalty | Test loyalty join flow per region independently using site-specific data modules |
| 6 | Presale products are time-limited | Avoid presale SKUs in regression; use standard in-stock products |

---

## 11. Open Questions (Resolve Before Phase 2)

| # | Question | Recommendation |
|---|---|---|
| 1 | Are there stable test accounts for all 4 sites? | Create dedicated staging accounts |
| 2 | Is there an API to seed cart items? | Use Magento REST API `/rest/V1/carts` |
| 3 | Does Skechers NZ Spend & Save apply at cart or order level? | Confirm with product team |
| 4 | Are presale products automatable (stable SKUs)? | Avoid; use standard in-stock products |
| 5 | Is accessibility scanning expected? | Add `@accessibility` tag in Phase 2 using existing `/accessibility` skill |

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
| Forgot password | Medium | Low | Medium | Phase 2 or manual |
| Payment failure | High | Low | Medium | Partial — up to method selection |
| Visual merchandising | Low | High | Low | Manual or visual regression |
