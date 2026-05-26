# Test Coverage Map

## Page Objects → Spec Files

### Frontsite (`src/pages/frontsite/`)

| Page Object | Fixture | Spec file |
|---|---|---|
| `home-page.ts` | `homePage` | `tests/frontsite/home-page.spec.ts` |
| `form-drag-and-drop.ts` | `formDragAndDropPage` | `tests/frontsite/form-drag-and-drop.spec.ts` |
| `profile-listing-page.ts` | `profileListingPage` | `tests/frontsite/profile-listing-page.spec.ts` |
| `insights-page.ts` | `insightsPage` | `tests/frontsite/insights-search.spec.ts` |
| `services-az-page.ts` | `servicesAZPage` | `tests/frontsite/services-az-list.spec.ts` |

### Admin (`src/pages/admin/`)

| Page Object | Fixture | Spec file |
|---|---|---|
| `login-page.ts` | `loginPage` | `tests/admin/login.spec.ts` |

### Ecommerce (`src/pages/ecommerce/`)

| Page Object | Fixture | Spec file |
|---|---|---|
| `home-page.ts` | `ecommerceHomePage` | `tests/ecommerce/smoke/homepage-smoke.spec.ts` |
| `nav-page.ts` | `ecommerceNavPage` | `tests/ecommerce/smoke/navigation-smoke.spec.ts` |
| `search-page.ts` | `ecommerceSearchPage` | `tests/ecommerce/smoke/search-smoke.spec.ts` |
| `plp-page.ts` | `ecommercePLPPage` | `tests/ecommerce/smoke/plp-smoke.spec.ts` |
| `pdp-page.ts` | `ecommercePDPPage` | `tests/ecommerce/smoke/pdp-smoke.spec.ts` |

### API (`tests/api/`)

| Spec | Client/Service fixture | Scope |
|---|---|---|
| `restful-booker.spec.ts` | `bookingService` | CRUD for Restful Booker API |
| `objects-crud.spec.ts` | `restfulApiClient` | Device API CRUD (restful-api.dev) |
| `graphql-examples.spec.ts` | `graphqlClient` | GraphQL queries + mutations |
| `api-mocking-examples.spec.ts` | `apiClient` | API mock/intercept patterns |
| `pla-account-creation-signin.spec.ts` | `apiClientExt` | PLA account flow |
| `pla-cart_minicart.spec.ts` | `apiClientExt` | PLA cart operations |
| `pla-my-details.spec.ts` | `apiClientExt` | PLA profile details |
| `pla-support-features.spec.ts` | `apiClientExt` | PLA support features |
| `pla-authentication.spec.ts` | `apiClientExt` | PLA auth tokens |
| `pla-search.spec.ts` | `apiClientExt` | PLA search / autocomplete |
| `pla-customer-profile.spec.ts` | `apiClientExt` | PLA customer profile |
| `pla-catalog.spec.ts` | `apiClientExt` | PLA catalog / product queries |
| `pla-address-book-countries.spec.ts` | `apiClientExt` | PLA address book + countries |
| `pla-wishlist.spec.ts` | `apiClientExt` | PLA wishlist |
| `pla-checkout-shipping.spec.ts` | `apiClientExt` | PLA checkout shipping (TC_01-07) |
| `pla-checkout-billing-payment.spec.ts` | `apiClientExt` | PLA checkout billing/payment |

## Ecommerce Smoke Coverage (as of 2026-05-26)

All 5 ecommerce specs run serially (`test.describe.serial`). Each scenario repeats across all 8 storefronts. Total: ~176 tests.

### homepage-smoke.spec.ts — 3 × 8 = 24 tests

| Scenario | Title |
|---|---|
| E2E-HOME-001 | Homepage loads with expected title and hero |
| E2E-HOME-002 | Top bar promotional message is visible |
| E2E-HOME-003 | Qantas Points link visible on AU sites only (skips NZ) |

### navigation-smoke.spec.ts — 6 scenarios × 8 storefronts ≈ 48 tests (some skip per storefront)

| Scenario | Title | Skip condition |
|---|---|---|
| E2E-NAV-001 | All top-nav links render and are clickable | — |
| E2E-NAV-002 | Womens nav link navigates to womens PLP | No `womensNavLabel` |
| E2E-NAV-003 | Mens nav link navigates to mens PLP | No `mensNavLabel` |
| E2E-NAV-004 | Kids nav link navigates to kids PLP | No `kidsNavLabel` |
| E2E-NAV-005 | Sale nav link navigates to sale PLP | No `saleNavLabel` |
| E2E-NAV-009 | Logo click returns to homepage | — |

### search-smoke.spec.ts — 2 × 8 = 16 tests

| Scenario | Title |
|---|---|
| E2E-SEARCH-001 | Search returns results for known product |
| E2E-SEARCH-002 | Clicking search icon submits search |

### plp-smoke.spec.ts — 5 × 8 = 40 tests

| Scenario | Title |
|---|---|
| E2E-PLP-001 | PLP loads with product grid visible |
| E2E-PLP-004 | Filter by category reduces product count |
| E2E-PLP-006 | Filter by size reduces product count |
| E2E-PLP-011 | Quick Add button opens size selector or adds item |
| E2E-PLP-012 | Clicking product card image navigates to PDP |

### pdp-smoke.spec.ts — 6 × 8 = 48 tests

| Scenario | Title |
|---|---|
| E2E-PDP-001 | PDP loads with product name, price, and image gallery |
| E2E-PDP-002 | Colour swatch selection updates product images |
| E2E-PDP-004 | Size selector shows correct sizes (gender toggle) |
| E2E-PDP-005 | Selecting a size enables Add to Cart button |
| E2E-PDP-006 | Add to Cart without size shows validation |
| E2E-PDP-007 | Add to Cart adds item and updates mini cart count |

## Coverage gaps (as of 2026-05-26)

- No UI tests for ecommerce checkout flow
- No UI tests for admin content management
- `plp-smoke.spec.ts` — tests skip conditionally per storefront when nav labels not configured; not blanket-skipped
- PLA API: 38 GraphQL operations documented in `Guideline/api-scenarios-report.html`; 34 covered, 4 gaps as of 2026-05-26
