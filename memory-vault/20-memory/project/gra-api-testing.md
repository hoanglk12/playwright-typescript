---
name: gra-api-testing
description: "GRA multi-brand GraphQL API test patterns, file structure, shared-state flow, and staging API quirks (4 AU brands: pla-au, skx-au, drm-au, van-au)"
type: project
tags: [memory, project]
source_session: bcd19b4a-e845-42ae-8ca0-fc0da0a8189e
last_verified: 2026-06-13
---

## GRA Multi-Brand Expansion (Phase 1 — implemented 2026-06-10)

All 15 `gra-*.spec.ts` files run as a shared suite across 4 AU brand endpoints via Playwright projects:

| Project | Endpoint | siteCode |
|---|---|---|
| `pla-au` | `stag-platypus-au.accentgra.com/graphql` | `pla-au` |
| `skx-au` | `stag-skechers-au.accentgra.com/graphql` | `skx-au` |
| `drm-au` | `stag-drmartens-au.accentgra.com/graphql` | `drm-au` |
| `van-au` | `stag-vans-au.accentgra.com/graphql` | `van-au` |

**Key files added:**
- `src/data/api/sites.ts` — `SiteContext` interface + `siteRegistry` (4 AU entries). Interface fields include `catalogSearchTerm: string` (brand-safe search term for catalog/search tests) and `hasLoyalty: boolean` (pla-au/skx-au=true; drm-au/van-au=false). Each entry has `testData: GraTestData`.
- `tests/api/gra-test.ts` — `graTest` extends `apiTest`; adds `site: SiteContext` (reads `testInfo.project.metadata.siteCode`) and `siteState: TestState` (Map-keyed per siteCode); overrides `graphqlClient` + `createGraphQLClient` to default to `site.baseURL`

**Import rule:** All `gra-*.spec.ts` import `graTest as test` from `./gra-test` — NOT from `../../src/api/ApiTest`. Non-GRA specs (restful-booker, objects-crud) still use `apiTest` from `ApiTest`. (`graphql-examples.spec.ts` was deleted 2026-06-11 — DEBT-014.)

**`shared-state.ts` is now Map-keyed:** Re-keyed to `Map<siteCode, TestState>`. Each brand project gets its own isolated `TestState` bucket. `getStateForSite(siteCode)` returns (and creates if needed) the bucket. Backward-compat function exports (`getCustomerToken()` etc.) still exist but default to `'pla-au'`.

**`signInAndStoreToken` signature changed:** Now `(client: GraphQLClient, logger: TestLogger, site: SiteContext, state: TestState)`. Uses `site.testData.validCredentials` and `state.setCustomerToken(token)` internally.

**`gra-test-data.ts` added:** `createBrandTestData(emailPrefix: string): GraTestData` — generic factory using brand-specific email prefix (e.g. `'skx'` → `skxtest{timestamp}@mail.com`). `createPlaTestData()` (legacy) now delegates to `createBrandTestData('pla')`.

**Spec pattern change:** Specs destructure `site` and `siteState` from fixtures; replace `plaTestData.xxx` with `site.testData.xxx`; replace `setCartId(id)` etc. with `siteState.setCartId(id)`.

**Rename note (2026-06-12):** All files renamed from `pla-*.spec.ts` → `gra-*.spec.ts` and `src/data/api/pla-*.ts` → `src/data/api/gra-*.ts`. Test describe titles changed from `PLA GraphQL API - X` → `GRA GraphQL API - X`; test names with `PLA_` prefix changed to `GRA_`. siteCode `pla-au` is unchanged (Platypus brand identifier).

**Baseline (2026-06-10):** All 4 brands 54/54 passed for account/loyalty/order-history suites (drm-au/van-au loyalty excluded via `testIgnore` in api.config.ts — `hasLoyalty: false` in SiteContext). Full suite of 116 tests per brand passes in isolation.

**Parallel execution (2026-06-11):** `api.config.ts` changed to `workers: 4` — 4 brands run concurrently in separate worker processes. Sequential order within each brand preserved by `fullyParallel: false` in `api.config.ts`. `test.describe.configure({ mode: 'serial' })` was **removed** from all GRA spec files on 2026-06-11 — serial mode cascades skips on failure; `fullyParallel: false` alone is sufficient for sequential ordering without cascade-skip behaviour. Safe because: each brand hits a different staging URL; `shared-state.ts` is Map-keyed by siteCode; module-level `let` vars re-initialised by `beforeAll` each project run.

## File & Data Structure

| File | Purpose |
|---|---|
| `tests/api/api-test-helpers.ts` | `signInAndStoreToken(client, logger, site, siteState)` — canonical always-fresh auth bootstrap used in all GRA spec `beforeAll` blocks |
| `tests/api/gra-account-creation-signin.spec.ts` | Create account, sign in, get customer details |
| `tests/api/gra-cart-minicart.spec.ts` | Cart / minicart queries and mutations (TC_01–TC_12 cover addProductsToCart, updateCartItems, removeItemFromCart, applyCouponToCart) |
| `tests/api/gra-my-details.spec.ts` | Address book, newsletter / loyalty subscription updates |
| `tests/api/gra-support-features.spec.ts` | Currency, dynamic promo blocks |
| `tests/api/gra-authentication.spec.ts` | revokeCustomerToken (TC_01–03), requestPasswordResetEmail (TC_04–06), resetPassword (TC_07–09) |
| `tests/api/gra-search.spec.ts` | Product search TC_01–05, autocomplete TC_06–07 (schema-gap aware) |
| `tests/api/gra-customer-profile.spec.ts` | changeCustomerPassword TC_01–04, updateCustomerV2 personal info TC_05–09 |
| `tests/api/gra-catalog.spec.ts` | Catalog & Products — products PLP TC_01–06, products PDP TC_07–10, categories TC_11–13, storeConfig TC_14–16, urlResolver TC_17–20 (all unauthenticated) |
| `tests/api/gra-address-book-countries.spec.ts` | Address book mutations + countries query |
| `tests/api/gra-wishlist.spec.ts` | Wishlist mutations (addProductsToWishlist, removeProductsFromWishlist) |
| `tests/api/gra-checkout-shipping.spec.ts` | setShippingAddressesOnCart TC_01–04, setShippingMethodsOnCart TC_05–07 |
| `tests/api/gra-checkout-billing-payment.spec.ts` | setBillingAddressOnCart TC_01–02, setPaymentMethodOnCart TC_03–05 (added 2026-05-26) |
| `tests/api/gra-place-order.spec.ts` | placeOrder TC_01–03: happy path, missing shipping, missing payment (added 2026-05-27; OOS scenario not implemented — staging blocks at addProductsToCart level) |
| `tests/api/gra-order-history.spec.ts` | customer.orders TC_01–04, guestOrder TC_05 (added 2026-06-03; TC_01/TC_03 staging-aware; TC_06 removed — not implementable without guest token) |
| `tests/api/gra-loyalty-rewards.spec.ts` | applyRewardPointsToCart (TC_01–02), applyQantasPointsToCart (TC_03–05), removeRewardPointsFromCart (TC_06), removeQantasPointsFromCart (TC_07) |
| `tests/api/shared-state.ts` | Token, customerId, cartId, addressId — shared across GRA spec files in one worker |
| `src/data/api/gra-test-data.ts` | **Factory `createBrandTestData(prefix)`** returns a fresh self-consistent instance (email, name, address all share same random seed). `createPlaTestData()` delegates to `createBrandTestData('pla')` |
| `src/data/api/gra-auth-data.ts` | Auth-specific test data (reset password inputs, error messages) |
| `src/data/api/gra-search-data.ts` | Search terms and pagination config for search tests |
| `src/data/api/gra-customer-profile-data.ts` | changeCustomerPassword inputs, updateCustomerV2 personal info inputs, error messages |
| `src/data/api/gra-catalog-data.ts` | Catalog test data: discovery config (searchTerm, pageSize, brandRetryTerm), PLP/PDP sentinels, storeConfig patterns, urlResolver URLs |
| `src/data/api/gra-checkout-shipping-data.ts` | Shipping address fixtures, invalid codes, invalid cart ID |
| `src/data/api/gra-checkout-billing-payment-data.ts` | `CartInlineAddress` interface; shipping + billing address fixtures; invalidPaymentCode |
| `src/data/api/gra-order-history-data.ts` | `CustomerOrderShape`, `CustomerOrdersShape`, `FreshOrderAccount`; `OrderHistoryData` constants; `OrderHistoryDataGenerator.generateFreshAccount()` for TC_02 |
| `src/data/api/gra-loyalty-rewards-data.ts` | Fixed test account credentials; QFF input data (memberNumber, pointsBurned, dollarValue, quoteRef) |

## Shared-State Pattern

All GRA specs rely on `fullyParallel: false` in `api.config.ts` for sequential ordering within each file — no `test.describe.configure` call is needed or present in GRA spec files. `beforeAll` pattern:

**`shared-state.ts` implementation (2026-06-01 refactor):**
- Now a **singleton `TestState` class** — not bare module-level variables
- Getter/setter pairs for `customerToken`, `customerId`, `cartId`, `addressId`
- Setters throw `Error` on empty/falsy value — prevents silently storing blank state
- Module-level exports (`getCustomerToken()`, `setCustomerToken()`, etc.) remain for backward compat

**`api-test-helpers.ts` — canonical auth bootstrap (2026-06-01):**
- `signInAndStoreToken(client: GraphQLClient, logger: TestLogger): Promise<string>`
- Encapsulates the always-fresh auth flow: try sign-in → if errors, create account first → retry sign-in → `setCustomerToken(token)`
- All GRA spec `beforeAll` blocks now call this instead of inlining the sign-in mutation

**Always-fresh-auth pattern (mandatory for specs needing auth):**
- Always sign in fresh in `beforeAll` via `signInAndStoreToken()` — never reuse `getCustomerToken()` from shared-state
- Root cause: `gra-authentication.spec.ts` calls `generateCustomerToken` for the same account (TC_01/TC_02 disposable tokens), which invalidates any previously issued token.
- Pattern (now handled by `signInAndStoreToken`):
  1. Try `generateCustomerToken` with `site.testData.validCredentials`
  2. If errors → create account → sign in again
  3. Call `setCustomerToken(token)` to update shared-state for downstream specs
  4. Pass only `{ email, password, remember }` to `SIGN_IN_MUTATION` — not the full `validCredentials` object

**Always-fresh-cart pattern (mandatory for specs needing a cart):**
- Always create a fresh cart in `beforeAll` with the auth client — never reuse `getCartId()` from shared-state
- Root cause: a `cartId` created in one customer session is not accessible with a different session's token. Magento 2 returns `"The current user cannot perform operations on cart"` when the session doesn't own the cart.

## Catalog-Specific Patterns (gra-catalog.spec.ts, 2026-05-21)

- **All operations are unauthenticated** — `createGraphQLClient()` used without auth options; no `beforeAll` auth setup needed.
- **Runtime discovery in `beforeAll`**: queries the live API to find valid `url_key`, category filter field/value, and `apparel21_brand_id` rather than hardcoding.
- **Category filter field ambiguity**: Magento 2 uses `category_uid` (base64) or `category_id` (int) depending on version. Discovery checks `category_uid` first, falls back to `category_id`.
- **Brand retry**: `apparel21_brand_id` aggregation is absent in "shoe" search results on PLA staging. `beforeAll` retries with `GraCatalogData.discovery.brandRetryTerm` ('nike').
- **`assertNoCriticalErrors()` helper**: tolerates `price_range` path errors (staging partial data) while failing on all other error types.
- **Price sort not assertable**: PLA staging price sort uses base price internally; `final_price` ordering is not guaranteed.
- **PLA staging urlResolver never returns `null`**: returns `{ id: null, type: null, __typename: "EntityUrl" }` for unresolvable URLs. TC_20 accepts both standard and PLA staging formats.

## Checkout Billing & Payment Patterns (added 2026-05-26)

- **Operation order**: addProductsToCart → setShippingAddressesOnCart → setShippingMethodsOnCart → setBillingAddressOnCart → setPaymentMethodOnCart → placeOrder.
- **`setBillingAddressOnCart` with `same_as_shipping: true` DOES populate `billing_address`** in the response on staging.
- **Braintree variants** require SDK `payment_method_nonce` — cannot test without real Braintree SDK.
- **Available payment methods on staging AU**: `checkmo`, `braintree_applepay`, `afterpay`, `braintree`, `braintree_paypal`. Use `checkmo` (TC_03) and `afterpay` (TC_04).
- **`shippingMethodSet` flag pattern**: module-level `let shippingMethodSet: boolean = false`; set to `true` only after shipping method mutation succeeds.
- **TC_04 drm-au staging quirk**: invalid-firstname mutation leaves cart shipping address unusable — TC_05/TC_06 must re-set full inline shipping address before querying available methods.
- **`validSku` scope**: when a SKU is only used inside `beforeAll`, declare it as a local `let` inside `beforeAll`.

## Place Order Patterns (added 2026-05-27)

- **`instore_pickup` + `placeOrder`**: fails with "Quote does not have Pickup Location assigned" — always prefer `flatrate_flatrate`.
- **PLA order number format**: NOT purely numeric. Use `/^\S+$/` or `toBeTruthy()`.
- **OOS items blocked at cart level**: removed from `gra-place-order.spec.ts`; staging blocks at addProductsToCart level.
- **SKU discovery retry pattern**: Never use `else if (item.sku)` fallback — captures configurable parent SKUs that can't be added to cart.
- **`createEmptyCart` for authenticated customers returns existing active cart**: For TC_02/TC_03 negative tests, use a **guest client** with `setGuestEmailOnCart` — not the authenticated customer client. Guest carts are always unique.
- **`beforeAll` timeout**: `test.setTimeout(TIMEOUTS.API_SUITE_SETUP)` (90s) as the **first line** of `beforeAll` for multi-call suites. `TIMEOUTS.API_SUITE_SETUP = 90000` in `src/constants/timeouts.ts`.
- **Cart creation must be in `beforeAll`, not in a test**: when Playwright retries a failed test, it re-runs `beforeAll` but NOT earlier tests.

## Staging API Quirks

- **`requestPasswordResetEmail` with non-existent email** returns a `graphql-input` error (NOT silent `true` as in standard Magento 2).
- **Invalid email format error message** is `"Invalid email address entered"` (custom), NOT standard Magento message.
- **`revokeCustomerToken` error category** is `graphql-authorization`.
- **`revokeCustomerToken` CI flakiness**: two eventual-consistency layers — poll the protected-resource query up to 5 × 1s until `graphql-authorization` appears. Both patterns use `TIMEOUTS.POLL_INTERVAL_NORMAL` (1s).
- **`resetPassword` validates token before password** — weak-password tests get token-invalid error first.
- **`changeCustomerPassword` wrong-password error** returns `"Invalid login or password."` (NOT standard Magento message).
- **`updateCustomerV2` personal info always blocked on staging** — "Require Password for Account Changes" config enabled, but `CustomerUpdateInput` has no `password` field. TC_05–07 in `gra-customer-profile.spec.ts` document and assert this staging-specific behavior.
- **`customer.orders` always returns `total_count: 0`** on PLA staging. `grand_total` on `CustomerOrder` is a plain `Float` scalar (NOT `Money` object). TC_01 and TC_03 in `gra-order-history.spec.ts` use staging-aware early-return.
- **`guestOrder` / `orderByToken` not in staging schema**. TC_05 in `gra-order-history.spec.ts` handles with "Cannot query field" early-return. TC_06 removed entirely.

## Address List Assertions — Find by ID, Not Index 0

When asserting newly created address fields, never use `addresses[0]` — account may have pre-existing addresses. Always find by ID:

```ts
const targetAddress = addresses!.find((addr: { id: unknown }) => String(addr.id) === String(addressId));
expect(targetAddress, `Expected address with id=${addressId} to exist in address book`).toBeDefined();
softExpect(targetAddress!.city).toBe(expectedCity);
```

**Why `String()` on both sides:** Magento 2 returns address IDs as `Int`; module-level `addressId` is typed `string`.

## TC_XX / GRA_ Naming Convention

GRA specs use `TC_XX - Description` format for new tests. A small number of older tests retain `GRA_OperationName - description` format (originally `PLA_`, renamed 2026-06-12). New tests should use `TC_XX`.

## GRA Test Code Quality Rules

1. **All GraphQL strings must be hoisted to module-level `const`** — never inline inside `test()` bodies or `beforeAll`.
2. **`logger.verify()` before `softExpect()` is correct** — `softExpect` (bare Pattern A) does NOT log internally; only `softAssert.*` fixture logs with `🔵 [SOFT]`.
3. **Module-level variables must have explicit initializers**: `let customerToken: string = ''` not `let customerToken: string`.
4. **`AuthType.BEARER` enum** — never `"bearer" as any`.
5. **Do NOT add `test.describe.configure({ mode: 'serial' })` to GRA specs** — cascades skips; `fullyParallel: false` alone is sufficient.
6. **Guard `errors[0]` with optional chaining**: `gql.errors?.[0]?.message ?? ''` even inside a length check.
7. **`cartId` as dead field anti-pattern**: never add `cartId` to a test data class; it lives exclusively in `shared-state.ts`.
8. **P2 schema gaps (productSearch)**: check for `"Cannot query field"` + `"productSearch"` in errors and return early.

## Loyalty & Rewards Spec (gra-loyalty-rewards.spec.ts — added 2026-06-02)

**Key signatures confirmed via live staging:**
- `applyRewardPointsToCart(cartId: ID!)` — direct arg
- `applyQantasPointsToCart(input: ApplyQantasPointsInput!)` — required: `cart_id`, `quote_ref`, `points_burned`, `dollar_value`
- `removeRewardPointsFromCart(cartId: ID!)`
- `removeQantasPointsFromCart(input: RemoveQantasPointsInput!)` — required: `cart_id`

**Staging quirks:**
- `applyQantasPointsToCart` ALWAYS returns "Internal server error" in mutation response; side effect succeeds — verify via separate `cart(cart_id)` query.
- `applyRewardPointsToCart` returns `applied_multiple_rewards: null` when account has no PlatyPoints — NOT an error.
- `LoyaltyRewardsData` used only for QFF-specific input data (`qffApply`, `invalidCartId`).

## api-scenarios-report.html

Self-contained HTML report at `Guideline/api-scenarios-report.html`. Documents 40 GraphQL operations across 12 categories.

**Coverage as of 2026-06-03:** 40 Covered, 0 New/Gap. All operations automated.
