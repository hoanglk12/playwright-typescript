---
name: pla-api-testing
description: "PLA (Platypus Shoes) GraphQL API test patterns, file structure, shared-state flow, and staging API quirks"
metadata: 
  node_type: memory
  type: project
  originSessionId: bcd19b4a-e845-42ae-8ca0-fc0da0a8189e
---

## GRA Multi-Brand Expansion (Phase 1 — implemented 2026-06-10)

All 15 `pla-*.spec.ts` files now run as a shared suite across 4 AU brand endpoints via Playwright projects:

| Project | Endpoint | siteCode |
|---|---|---|
| `pla-au` | `stag-platypus-au.accentgra.com/graphql` | `pla-au` |
| `skx-au` | `stag-skechers-au.accentgra.com/graphql` | `skx-au` |
| `drm-au` | `stag-drmartens-au.accentgra.com/graphql` | `drm-au` |
| `van-au` | `stag-vans-au.accentgra.com/graphql` | `van-au` |

**Key files added:**
- `src/data/api/sites.ts` — `SiteContext` interface + `siteRegistry` (4 AU entries). Interface fields include `catalogSearchTerm: string` (brand-safe search term for catalog/search tests) and `hasLoyalty: boolean` (pla-au/skx-au=true; drm-au/van-au=false). Each entry has `testData: PlaTestData`.
- `tests/api/gra-test.ts` — `graTest` extends `apiTest`; adds `site: SiteContext` (reads `testInfo.project.metadata.siteCode`) and `siteState: TestState` (Map-keyed per siteCode); overrides `graphqlClient` + `createGraphQLClient` to default to `site.baseURL`

**Import rule — CHANGED:** All `pla-*.spec.ts` now import `graTest as test` from `./gra-test` — NOT from `../../src/api/ApiTest`. Non-GRA specs (restful-booker, objects-crud) still use `apiTest` from `ApiTest`. (`graphql-examples.spec.ts` was deleted 2026-06-11 — DEBT-014.)

**`shared-state.ts` is now Map-keyed:** Re-keyed to `Map<siteCode, TestState>`. Each brand project gets its own isolated `TestState` bucket. `getStateForSite(siteCode)` returns (and creates if needed) the bucket. Backward-compat function exports (`getCustomerToken()` etc.) still exist but default to `'pla-au'`.

**`signInAndStoreToken` signature changed:** Now `(client: GraphQLClient, logger: TestLogger, site: SiteContext, state: TestState)`. Uses `site.testData.validCredentials` and `state.setCustomerToken(token)` internally.

**`pla-test-data.ts` added:** `createBrandTestData(emailPrefix: string): PlaTestData` — generic factory using brand-specific email prefix (e.g. `'skx'` → `skxtest{timestamp}@mail.com`). `createPlaTestData()` now delegates to `createBrandTestData('pla')`.

**Spec pattern change:** Specs destructure `site` and `siteState` from fixtures; replace `plaTestData.xxx` with `site.testData.xxx`; replace `setCartId(id)` etc. with `siteState.setCartId(id)`.

**Baseline (2026-06-10):** All 4 brands 54/54 passed for account/loyalty/order-history suites (drm-au/van-au loyalty excluded via `testIgnore` in api.config.ts — `hasLoyalty: false` in SiteContext). Full suite of 116 tests per brand passes in isolation.

**Parallel execution (2026-06-11):** `api.config.ts` changed to `workers: 4` — 4 brands run concurrently in separate worker processes. Sequential order within each brand preserved by `fullyParallel: false` in `api.config.ts`. `test.describe.configure({ mode: 'serial' })` was **removed** from all 15 `pla-*.spec.ts` files on 2026-06-11 — serial mode cascades skips on failure; `fullyParallel: false` alone is sufficient for sequential ordering without cascade-skip behaviour. Safe because: each brand hits a different staging URL; `shared-state.ts` is Map-keyed by siteCode; module-level `let` vars re-initialised by `beforeAll` each project run.

## File & Data Structure

| File | Purpose |
|---|---|
| `tests/api/api-test-helpers.ts` | `signInAndStoreToken(client, logger, site, siteState)` — canonical always-fresh auth bootstrap used in all PLA spec `beforeAll` blocks |
| `tests/api/pla-account-creation-signin.spec.ts` | Create account, sign in, get customer details |
| `tests/api/pla-cart_minicart.spec.ts` | Cart / minicart queries and mutations (TC_01–TC_12 cover addProductsToCart, updateCartItems, removeItemFromCart, applyCouponToCart) |
| `tests/api/pla-my-details.spec.ts` | Address book, newsletter / loyalty subscription updates |
| `tests/api/pla-support-features.spec.ts` | Currency, dynamic promo blocks |
| `tests/api/pla-authentication.spec.ts` | revokeCustomerToken (TC_01–03), requestPasswordResetEmail (TC_04–06), resetPassword (TC_07–09) |
| `tests/api/pla-search.spec.ts` | Product search TC_01–05, autocomplete TC_06–07 (schema-gap aware) |
| `tests/api/pla-customer-profile.spec.ts` | changeCustomerPassword TC_01–04, updateCustomerV2 personal info TC_05–09 |
| `tests/api/pla-catalog.spec.ts` | Catalog & Products — products PLP TC_01–06, products PDP TC_07–10, categories TC_11–13, storeConfig TC_14–16, urlResolver TC_17–20 (all unauthenticated) |
| `tests/api/pla-address-book-countries.spec.ts` | Address book mutations + countries query |
| `tests/api/pla-wishlist.spec.ts` | Wishlist mutations (addProductsToWishlist, removeProductsFromWishlist) |
| `tests/api/pla-checkout-shipping.spec.ts` | setShippingAddressesOnCart TC_01–04, setShippingMethodsOnCart TC_05–07 |
| `tests/api/pla-checkout-billing-payment.spec.ts` | setBillingAddressOnCart TC_01–02, setPaymentMethodOnCart TC_03–05 (added 2026-05-26) |
| `tests/api/pla-place-order.spec.ts` | placeOrder TC_01–03: happy path, missing shipping, missing payment (added 2026-05-27; OOS scenario not implemented — staging blocks at addProductsToCart level) |
| `tests/api/pla-order-history.spec.ts` | customer.orders TC_01–04, guestOrder TC_05 (added 2026-06-03; TC_01/TC_03 staging-aware; TC_06 removed — not implementable without guest token) |
| `tests/api/shared-state.ts` | Token, customerId, cartId, addressId — shared across PLA spec files in one worker |
| `src/data/api/pla-test-data.ts` | **Factory `createPlaTestData()`** returns a fresh self-consistent instance (email, name, address all share same random seed). Call once at module level: `const plaTestData = createPlaTestData()` |
| `src/data/api/pla-auth-data.ts` | Auth-specific test data (reset password inputs, error messages) |
| `src/data/api/pla-search-data.ts` | Search terms and pagination config for search tests |
| `src/data/api/pla-customer-profile-data.ts` | changeCustomerPassword inputs, updateCustomerV2 personal info inputs, error messages |
| `src/data/api/pla-catalog-data.ts` | Catalog test data: discovery config (searchTerm, pageSize, brandRetryTerm), PLP/PDP sentinels, storeConfig patterns, urlResolver URLs |
| `src/data/api/pla-checkout-shipping-data.ts` | Shipping address fixtures, invalid codes, invalid cart ID |
| `src/data/api/pla-checkout-billing-payment-data.ts` | `CartInlineAddress` interface; shipping + billing address fixtures; invalidPaymentCode |
| `src/data/api/pla-order-history-data.ts` | `CustomerOrderShape`, `CustomerOrdersShape`, `FreshOrderAccount`; `OrderHistoryData` constants; `OrderHistoryDataGenerator.generateFreshAccount()` for TC_02 |

## Shared-State Pattern

All PLA specs rely on `fullyParallel: false` in `api.config.ts` for sequential ordering within each file — no `test.describe.configure` call is needed or present in GRA spec files. `beforeAll` pattern:

**`shared-state.ts` implementation (2026-06-01 refactor):**
- Now a **singleton `TestState` class** — not bare module-level variables
- Getter/setter pairs for `customerToken`, `customerId`, `cartId`, `addressId`
- Setters throw `Error` on empty/falsy value — prevents silently storing blank state
- Module-level exports (`getCustomerToken()`, `setCustomerToken()`, etc.) remain for backward compat

**`api-test-helpers.ts` — canonical auth bootstrap (2026-06-01):**
- `signInAndStoreToken(client: GraphQLClient, logger: TestLogger): Promise<string>`
- Encapsulates the always-fresh auth flow: try sign-in → if errors, create account first → retry sign-in → `setCustomerToken(token)`
- All PLA spec `beforeAll` blocks now call this instead of inlining the sign-in mutation

**Always-fresh-auth pattern (mandatory for specs needing auth):**
- Always sign in fresh in `beforeAll` via `signInAndStoreToken()` — never reuse `getCustomerToken()` from shared-state
- Root cause: `pla-authentication.spec.ts` calls `generateCustomerToken` for the same account (TC_01/TC_02 disposable tokens), which invalidates any previously issued token. The `if (!customerToken)` guard is bypassed when the variable is a non-empty stale string.
- Pattern (now handled by `signInAndStoreToken`):
  1. Try `generateCustomerToken` with `plaTestData.validCredentials`
  2. If errors → create account → sign in again
  3. Call `setCustomerToken(token)` to update shared-state for downstream specs
  4. Pass only `{ email, password, remember }` to `SIGN_IN_MUTATION` — not the full `validCredentials` object (which contains extra fields like `firstName`/`lastName` not declared in the mutation variables)

**Always-fresh-cart pattern (mandatory for specs needing a cart):**
- Always create a fresh cart in `beforeAll` with the auth client — never reuse `getCartId()` from shared-state
- Root cause: a `cartId` created in one customer session is not accessible with a different session's token. Magento 2 returns `"The current user cannot perform operations on cart"` when the session doesn't own the cart.

When running a PLA spec in isolation, `beforeAll` self-bootstraps a fresh account. `plaTestData.validCustomer.email` equals `getTestEmail()` — the same dynamic email used across all PLA specs in a single test session.

## Catalog-Specific Patterns (pla-catalog.spec.ts, 2026-05-21)

- **All operations are unauthenticated** — `createGraphQLClient()` used without auth options; no `beforeAll` auth setup needed.
- **Runtime discovery in `beforeAll`**: queries the live API to find valid `url_key`, category filter field/value, and `apparel21_brand_id` rather than hardcoding. Makes tests resilient to data changes.
- **Category filter field ambiguity**: Magento 2 uses `category_uid` (base64) or `category_id` (int) depending on version. Discovery checks `category_uid` first, falls back to `category_id`. Stores both field name (`discoveredCategoryFilterField`) and value (`discoveredCategoryFilterValue`).
- **Brand retry**: `apparel21_brand_id` aggregation is absent in "shoe" search results on this staging. `beforeAll` retries with `PlaCatalogData.discovery.brandRetryTerm` ('nike'). TC_02 still skips gracefully if brand_id stays empty.
- **`assertNoCriticalErrors()` helper**: module-level function that tolerates `price_range` path errors (staging partial data) while failing on all other error types. Used in TC_01–06 instead of `assertNoErrors()`.
- **Price sort not assertable**: PLA staging price sort uses base price internally; `final_price` ordering is not guaranteed. TC_03/TC_04 only verify price fields are numeric ≥ 0.
- **PLA staging urlResolver never returns `null`**: returns `{ id: null, type: null, __typename: "EntityUrl" }` for unresolvable URLs. TC_20 accepts both standard Magento 2 (`null`) and PLA staging (`{ type: null, id: null }`) as "not found". TC_17/TC_18 try with and without `.html` suffix, skip gracefully if neither resolves.

## Checkout Billing & Payment Patterns (added 2026-05-26)

- **Operation order for payment to succeed**: addProductsToCart → setShippingAddressesOnCart → setShippingMethodsOnCart → setBillingAddressOnCart → setPaymentMethodOnCart → placeOrder. `setPaymentMethodOnCart` silently returns no errors but `available_payment_methods` is empty until shipping method is set.
- **`setBillingAddressOnCart` with `same_as_shipping: true` DOES populate `billing_address`** in the response (non-null) on staging — billing_address contains the shipping address data.
- **Braintree payment variants** (`braintree`, `braintree_applepay`, `braintree_paypal`) require an SDK-provided `payment_method_nonce` field. Attempting `setPaymentMethodOnCart` with just `{ code: "braintree" }` returns `"Required parameter 'braintree' for 'payment_method' is missing."` — cannot test these without real Braintree SDK integration.
- **Available payment methods on staging AU cart** (confirmed 2026-05-26): `checkmo`, `braintree_applepay`, `afterpay`, `braintree`, `braintree_paypal`. Use `checkmo` (TC_03) and `afterpay` (TC_04) for payment method tests.
- **`shippingMethodSet` flag pattern**: declare a module-level `let shippingMethodSet: boolean = false` in beforeAll; set to `true` only after shipping method mutation succeeds. Use this flag to skip payment tests gracefully rather than failing all tests when shipping setup fails.
- **TC_04 `setShippingAddressesOnCart` with empty `firstname` clears cart address on drm-au staging**: TC_04's invalid-firstname mutation leaves the cart's shipping address in an unusable state. TC_05/TC_06 must re-set the full inline shipping address at the start (before querying `available_shipping_methods`) — otherwise they get "No shipping address on cart" and skip. This is a drm-au staging quirk, not standard Magento 2. (Fixed 2026-06-11.)
- **`validSku` scope**: when a SKU is only used inside `beforeAll` (to add product to cart), declare it as a local `let` inside `beforeAll` — not a module-level variable.

## Place Order Patterns (added 2026-05-27)

- **`instore_pickup` + `placeOrder`**: Selecting `instore_pickup` as the shipping method then calling `placeOrder` fails with `"Unable to place order: Quote does not have Pickup Location assigned."` — always prefer `flatrate_flatrate` (or other non-instore carrier) when the test needs to call `placeOrder`.
- **PLA order number format**: NOT purely numeric. Do NOT assert `/^\d+$/`. Use `/^\S+$/` or just `toBeTruthy()`.
- **OOS items blocked at cart level**: Staging blocks OOS items at `addProductsToCart` level via `user_errors` (`"Product that you are trying to add is not available."`). It is NOT possible to have an OOS item in the cart to trigger a `placeOrder` OOS error. The OOS scenario was removed from `pla-place-order.spec.ts` for this reason.
- **SKU discovery retry pattern**: Never use the `else if (item.sku)` fallback in SKU discovery — it captures configurable parent product SKUs that can't be added to cart. Collect only confirmed IN_STOCK SimpleProduct or variant SKUs, then retry adding each candidate until one succeeds.
- **`pla-place-order-data.ts`**: `productSearchTerms` (renamed from `outOfStockSearchTerms`) is the list of search terms used for product discovery; `orderNumberPattern: /^\S+$/` is the flexible order number format check. Also contains `PlaceOrderTestDataGenerator.generateGuestEmail()` — unique guest email per call (needed before `placeOrder` validation runs on guest carts).
- **`createEmptyCart` for authenticated customers returns the EXISTING active cart** — not a new one (Magento 2 behaviour). For TC_02/TC_03 (negative tests: missing shipping / missing payment), the authenticated `beforeAll` fully configures the customer's cart including payment for TC_01. After TC_01's `placeOrder` succeeds, quote deactivation lags on staging — a second `createEmptyCart` returns the same fully-configured cart, causing `placeOrder` to SUCCEED and `assertHasErrors()` to fail. Fix: use a **guest client** (`createGraphQLClient()` with no auth) for TC_02/TC_03. Guest `createEmptyCart` calls are guaranteed unique. Requires `setGuestEmailOnCart` before `placeOrder` validation runs. Confirmed 2026-06-11 for pla-au and skx-au.
- **`beforeAll` timeout for multi-call suites**: 8+ sequential staging API calls can exceed the default 30s hook timeout, causing all tests in the suite to appear as "skipped". Fix: `test.setTimeout(TIMEOUTS.API_SUITE_SETUP)` (90s) as the **first line** of `beforeAll`. `TIMEOUTS.API_SUITE_SETUP = 90000` was added to `src/constants/timeouts.ts` on 2026-06-11.
- **Cart creation must be in `beforeAll`, not in a test**: when Playwright retries a failed test, it re-runs `beforeAll` but NOT earlier tests. If `cartId` is only set in an earlier test (e.g. `PLA_CreateCartAfterSignIn`), the retry worker has `cartId = ''` and all subsequent mutations fail with "Required parameter cart_id is missing". Move cart creation into `beforeAll` and probe-add/remove a SKU there to verify the SKU is addable, leaving the cart empty for TC_01.

## Staging API Quirks (discovered 2026-05-15, expanded 2026-05-19, 2026-05-26)

- **`requestPasswordResetEmail` with non-existent email** returns a `graphql-input` error (NOT silent `true` as in standard Magento 2). The staging app discloses account non-existence through this error.
- **Invalid email format error message** is `"Invalid email address entered"` (custom message), NOT the standard Magento `"is not a valid email address."`. Update `plaAuthErrorMessages.invalidEmailFormat` if Magento is upgraded.
- **`revokeCustomerToken` error category** is `graphql-authorization` (confirmed on staging).
- **`revokeCustomerToken` CI flakiness — two eventual-consistency layers (fixed 2026-05-31):**
  1. TC_01 revokes its token → TC_02 signs in immediately → new token is **immediately invalid** (Magento session store hasn't committed TC_01's revocation). Fix: `POLL_INTERVAL_NORMAL` (1s) wait at the start of TC_02 before signing in.
  2. After `revokeCustomerToken` succeeds, the revoked token may still be accepted for 1–5s. Fix: **poll** the protected-resource query up to 5 × 1s until `graphql-authorization` appears. Both patterns use `TIMEOUTS.POLL_INTERVAL_NORMAL` (1s).
- **`resetPassword` validates token before password** — weak-password tests will get a token-invalid error first, not a password-strength error.
- **`changeCustomerPassword` wrong-password error** returns `"Invalid login or password."` — NOT the standard Magento `"The password doesn't match this account"`. Update `plaCustomerProfileErrorMessages.wrongCurrentPassword` if Magento is upgraded.
- **`updateCustomerV2` personal info (firstname/lastname/dob/phone) always blocked on staging** — staging has "Require Password for Account Changes" Magento admin config enabled, but `CustomerUpdateInput` GraphQL type does NOT include a `password` field. This makes personal info updates structurally impossible via GraphQL on this staging. TC_05–07 in `pla-customer-profile.spec.ts` document and assert this staging-specific error behavior. `is_subscribed` / `loyalty_program_status` (covered in `pla-my-details.spec.ts`) are NOT subject to this restriction.
- **Cross-spec token rate-limiting flakiness** — rapid successive `generateCustomerToken` calls for the same account (e.g. TC_01/TC_02 in `pla-authentication.spec.ts` followed by a `beforeAll` in the next spec) can trigger Platypus staging rate limiting. Specs pass 100% standalone but fail intermittently when run back-to-back in the same worker. Not a code bug — an environment constraint.

- **`createEmptyCart` for authenticated customers returns existing active cart** — NOT a new cart. Quote deactivation after `placeOrder` lags on staging (seconds to minutes). Negative-assertion tests (TC_02/TC_03 in `pla-place-order.spec.ts`) that need genuinely incomplete carts must use a **guest client** with `setGuestEmailOnCart` — not the authenticated customer client. Guest carts are always unique.
- **`instore_pickup` + `placeOrder`** breaks with "Quote does not have Pickup Location assigned" — prefer `flatrate` in any spec that calls `placeOrder`.
- **OOS items blocked at addProductsToCart** — OOS scenario removed from `pla-place-order.spec.ts`; staging blocks at cart-add level making it untestable at the `placeOrder` stage.
- **`customer.orders` always returns `total_count: 0`** on PLA staging (confirmed 2026-06-03) even immediately after placing orders. Orders are stored (placeOrder returns a valid order number) but do not surface via the GraphQL `customer.orders` query on this staging endpoint. `grand_total` on `CustomerOrder` is a plain `Float` scalar (NOT a `Money` object — do NOT use `{ value currency }` sub-selection). TC_01 and TC_03 in `pla-order-history.spec.ts` use staging-aware early-return: assert structure then return early when `total_count: 0`.
- **`guestOrder` / `orderByToken` not in staging schema** (confirmed 2026-06-03). Neither field exists on the PLA staging GraphQL endpoint. `Order` type has no `token` field; `placeOrder` does not return a guest token; tokens only appear in confirmation emails or the Magento DB. TC_05 in `pla-order-history.spec.ts` handles the schema gap with "Cannot query field" early-return (like productSearch). TC_06 (valid token) was removed entirely — not implementable until the schema is deployed and a guest token source is available.

## Address List Assertions — Find by ID, Not Index 0

When asserting the fields of a newly created address, never use `addresses[0]` — the account may have pre-existing addresses that appear first in the API response list. Always find by ID:

```ts
// WRONG — assumes newly created address is first in list
softExpect(addresses![0].city).toBe(expectedCity);

// CORRECT — find the specific address by ID set in the previous test
const targetAddress = addresses!.find((addr: { id: unknown }) => String(addr.id) === String(addressId));
expect(targetAddress, `Expected address with id=${addressId} to exist in address book`).toBeDefined();
softExpect(targetAddress!.city).toBe(expectedCity);
```

**Why `String()` on both sides:** Magento 2 returns address IDs as `Int` in GraphQL, but the module-level `addressId` variable is typed `string`. `String()` coercion avoids a number-vs-string mismatch that would cause `.find()` to return `undefined` even when the ID is correct.

**Why the guard is hard:** `expect(targetAddress).toBeDefined()` is a hard precondition — if the address isn't found, every subsequent `targetAddress!.xxx` would throw a useless `Cannot read properties of undefined`. The hard assertion gives a clear "address not found" message.

**Confirmed in:** `pla-my-details.spec.ts` `PLA_GetCustomerAddressesForAddressBook` (fixed 2026-05-28). Root cause: test account had an existing SYDNEY address that sorted first, pushing the newly created PERTH address to a later index.

## TC_XX Naming Convention

PLA auth tests use `TC_XX - Description` format. Earlier PLA specs (`pla-account-creation-signin`) use `PLA_OperationName - description` format. New tests should use `TC_XX`.

**Why:** [[feedback_preferences]] — terse consistent naming. TC_XX aligns with CLAUDE.md standard test structure.

## PLA Test Code Quality Rules (confirmed 2026-05-16)

Rules the qa-code-reviewer flagged and confirmed:

1. **All GraphQL strings must be hoisted to module-level `const`** — never inline inside `test()` bodies or `beforeAll`. This applies to every mutation and query used in the file.

2. **`logger.verify()` before `softExpect()` is correct — NOT a duplicate.** `softExpect` (bare Pattern A) does NOT log internally. Only the `softAssert.*` fixture (SoftAssertHelper) logs internally with `🔵 [SOFT]`. The qa-code-reviewer may flag this as "duplicate logging" but that is a false positive — see [[feedback_preferences]].

3. **Module-level variables must have explicit initializers**: `let customerToken: string = ''` not `let customerToken: string`.

4. **`AuthType.BEARER` enum** — never `"bearer" as any`.

5. **Do NOT add `test.describe.configure({ mode: 'serial' })` to GRA specs** — it cascades skips on failure. Sequential order is guaranteed by `fullyParallel: false` in `api.config.ts` alone.

6. **Guard `errors[0]` access with optional chaining — even inside a length check**: `gql.errors?.[0]?.message ?? ''`. TypeScript does NOT narrow `errors` to non-undefined inside `if ((gql.errors?.length ?? 0) > 0)` — you must still use `?.` on the index access. Pattern: `if ((gql.errors?.length ?? 0) > 0) { const msg = gql.errors?.[0]?.message ?? ''; }`.

7. **`plaTestData.cartId` was a dead field** — removed 2026-05-16. The field imported `cartId` from shared-state at module init time, capturing `undefined` before any test set it. The `cartId` import and `PlaTestData.cartId` interface field have been deleted from `pla-test-data.ts`.

8. **P2 schema gaps (productSearch)**: `productSearch` autocomplete is not in the staging Magento 2 schema. Tests for this operation must call `getGraphQLResponse()` directly, check for `"Cannot query field"` + `"productSearch"` in errors, and return early instead of failing.

## api-scenarios-report.html

Self-contained HTML report at `Guideline/api-scenarios-report.html`. Documents 40 GraphQL operations across 12 categories. Marks each as Covered/New and assigns P1/P2/P3 priority. Regenerate by running `qa-orchestrator` explore workflow.

**Coverage as of 2026-06-03:** 40 Covered, 0 New/Gap. All operations automated.
- +2 added 2026-06-03: `customer.orders` (TC_01–04), `guestOrder/orderByToken` (TC_05) — covered by `pla-order-history.spec.ts` (5 tests; TC_06 removed)
- +2 added 2026-06-02: `applyRewardPointsToCart` (PlatyPoints), `applyQantasPointsToCart` (QFF), plus `removeRewardPointsFromCart` and `removeQantasPointsFromCart` (covered by `pla-loyalty-rewards.spec.ts` TC_01–TC_07)
- +1 added 2026-05-27: `placeOrder` (covered by `pla-place-order.spec.ts` TC_01–03)
- +2 added 2026-05-26: `setBillingAddressOnCart`, `setPaymentMethodOnCart` (covered by `pla-checkout-billing-payment.spec.ts`)
- +2 added with `pla-checkout-shipping.spec.ts`: `setShippingAddressesOnCart`, `setShippingMethodsOnCart`

## Loyalty & Rewards Spec (pla-loyalty-rewards.spec.ts — added 2026-06-02)

| File | Purpose |
|---|---|
| `tests/api/pla-loyalty-rewards.spec.ts` | applyRewardPointsToCart (TC_01–02), applyQantasPointsToCart (TC_03–05), removeRewardPointsFromCart (TC_06), removeQantasPointsFromCart (TC_07) |
| `src/data/api/pla-loyalty-rewards-data.ts` | Fixed test account credentials; QFF input data (memberNumber, pointsBurned, dollarValue, quoteRef) |

**Key signatures confirmed via live staging exploration:**
- `applyRewardPointsToCart(cartId: ID!)` — direct arg, NOT an input wrapper
- `applyQantasPointsToCart(input: ApplyQantasPointsInput!)` — required fields: `cart_id: String!`, `quote_ref: String!`, `points_burned: Int!`, `dollar_value: Float!`; optional: `member_number: String`
- `removeRewardPointsFromCart(cartId: ID!)` — same arg shape as apply
- `removeQantasPointsFromCart(input: RemoveQantasPointsInput!)` — required: `cart_id: String!`

**Staging quirks confirmed 2026-06-02:**
- `applyQantasPointsToCart` ALWAYS returns "Internal server error" in the mutation response, but the side effect succeeds — `applied_qantas_points` is correctly set in the cart. Verify via a separate `cart(cart_id)` query, not from the mutation response.
- `applyQantasPointsToCart` has NO authentication guard on staging — unauthenticated callers also receive ISE (not a proper auth error). Production behaviour may differ.
- `applyRewardPointsToCart` returns `applied_multiple_rewards: null` when the account has no PlatyPoints balance — this is NOT an error state.
- QFF credentials (member number/lastname/PIN) are Qantas-API inputs for obtaining a real `quote_ref`; that external step is outside Magento GraphQL scope. The `applyQantasPointsToCart` input takes pre-computed `points_burned` + `dollar_value` + `quote_ref` directly.
- `is_qff_member: false` on the test account does NOT block `applyQantasPointsToCart` — the flag is informational only.
- This spec uses the standard `signInAndStoreToken(client, logger, site, siteState)` pattern with `site.testData` credentials — same as all other authenticated GRA specs. The fixed-account auth (`lincoln.pham@accentgr.com.au` / `LoyaltyRewardsData.fixedAccount`) was removed. `LoyaltyRewardsData` is now referenced only for QFF-specific input data (`qffApply`, `invalidCartId`).
