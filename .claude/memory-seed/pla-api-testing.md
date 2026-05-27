---
name: pla-api-testing
description: "PLA (Platypus Shoes) GraphQL API test patterns, file structure, shared-state flow, and staging API quirks"
metadata: 
  node_type: memory
  type: project
  originSessionId: bcd19b4a-e845-42ae-8ca0-fc0da0a8189e
---

## File & Data Structure

| File | Purpose |
|---|---|
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
| `tests/api/shared-state.ts` | Token, customerId, cartId, addressId — shared across PLA spec files in one worker |
| `src/data/api/pla-test-data.ts` | Dynamic email + all account/address/cart test data |
| `src/data/api/pla-auth-data.ts` | Auth-specific test data (reset password inputs, error messages) |
| `src/data/api/pla-search-data.ts` | Search terms and pagination config for search tests |
| `src/data/api/pla-customer-profile-data.ts` | changeCustomerPassword inputs, updateCustomerV2 personal info inputs, error messages |
| `src/data/api/pla-catalog-data.ts` | Catalog test data: discovery config (searchTerm, pageSize, brandRetryTerm), PLP/PDP sentinels, storeConfig patterns, urlResolver URLs |
| `src/data/api/pla-checkout-shipping-data.ts` | Shipping address fixtures, invalid codes, invalid cart ID |
| `src/data/api/pla-checkout-billing-payment-data.ts` | `CartInlineAddress` interface; shipping + billing address fixtures; invalidPaymentCode |

## Shared-State Pattern

All PLA specs use `test.describe.configure({ mode: 'serial' })` (NOT `test.describe.serial(...)`) + a `beforeAll` that:

**Always-fresh-auth pattern (mandatory for specs needing auth):**
- Always sign in fresh in `beforeAll` — never reuse `getCustomerToken()` from shared-state
- Root cause: `pla-authentication.spec.ts` calls `generateCustomerToken` for the same account (TC_01/TC_02 disposable tokens), which invalidates any previously issued token. The `if (!customerToken)` guard is bypassed when the variable is a non-empty stale string.
- Pattern:
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
- **`validSku` scope**: when a SKU is only used inside `beforeAll` (to add product to cart), declare it as a local `let` inside `beforeAll` — not a module-level variable.

## Place Order Patterns (added 2026-05-27)

- **`instore_pickup` + `placeOrder`**: Selecting `instore_pickup` as the shipping method then calling `placeOrder` fails with `"Unable to place order: Quote does not have Pickup Location assigned."` — always prefer `flatrate_flatrate` (or other non-instore carrier) when the test needs to call `placeOrder`.
- **PLA order number format**: NOT purely numeric. Do NOT assert `/^\d+$/`. Use `/^\S+$/` or just `toBeTruthy()`.
- **OOS items blocked at cart level**: Staging blocks OOS items at `addProductsToCart` level via `user_errors` (`"Product that you are trying to add is not available."`). It is NOT possible to have an OOS item in the cart to trigger a `placeOrder` OOS error. The OOS scenario was removed from `pla-place-order.spec.ts` for this reason.
- **SKU discovery retry pattern**: Never use the `else if (item.sku)` fallback in SKU discovery — it captures configurable parent product SKUs that can't be added to cart. Collect only confirmed IN_STOCK SimpleProduct or variant SKUs, then retry adding each candidate until one succeeds.
- **`pla-place-order-data.ts`**: `productSearchTerms` (renamed from `outOfStockSearchTerms`) is the list of search terms used for product discovery; `orderNumberPattern: /^\S+$/` is the flexible order number format check.

## Staging API Quirks (discovered 2026-05-15, expanded 2026-05-19, 2026-05-26)

- **`requestPasswordResetEmail` with non-existent email** returns a `graphql-input` error (NOT silent `true` as in standard Magento 2). The staging app discloses account non-existence through this error.
- **Invalid email format error message** is `"Invalid email address entered"` (custom message), NOT the standard Magento `"is not a valid email address."`. Update `plaAuthErrorMessages.invalidEmailFormat` if Magento is upgraded.
- **`revokeCustomerToken` error category** is `graphql-authorization` (confirmed on staging).
- **`resetPassword` validates token before password** — weak-password tests will get a token-invalid error first, not a password-strength error.
- **`changeCustomerPassword` wrong-password error** returns `"Invalid login or password."` — NOT the standard Magento `"The password doesn't match this account"`. Update `plaCustomerProfileErrorMessages.wrongCurrentPassword` if Magento is upgraded.
- **`updateCustomerV2` personal info (firstname/lastname/dob/phone) always blocked on staging** — staging has "Require Password for Account Changes" Magento admin config enabled, but `CustomerUpdateInput` GraphQL type does NOT include a `password` field. This makes personal info updates structurally impossible via GraphQL on this staging. TC_05–07 in `pla-customer-profile.spec.ts` document and assert this staging-specific error behavior. `is_subscribed` / `loyalty_program_status` (covered in `pla-my-details.spec.ts`) are NOT subject to this restriction.
- **Cross-spec token rate-limiting flakiness** — rapid successive `generateCustomerToken` calls for the same account (e.g. TC_01/TC_02 in `pla-authentication.spec.ts` followed by a `beforeAll` in the next spec) can trigger Platypus staging rate limiting. Specs pass 100% standalone but fail intermittently when run back-to-back in the same worker. Not a code bug — an environment constraint.

- **`instore_pickup` + `placeOrder`** breaks with "Quote does not have Pickup Location assigned" — prefer `flatrate` in any spec that calls `placeOrder`.
- **OOS items blocked at addProductsToCart** — OOS scenario removed from `pla-place-order.spec.ts`; staging blocks at cart-add level making it untestable at the `placeOrder` stage.

## TC_XX Naming Convention

PLA auth tests use `TC_XX - Description` format. Earlier PLA specs (`pla-account-creation-signin`) use `PLA_OperationName - description` format. New tests should use `TC_XX`.

**Why:** [[feedback_preferences]] — terse consistent naming. TC_XX aligns with CLAUDE.md standard test structure.

## PLA Test Code Quality Rules (confirmed 2026-05-16)

Rules the qa-code-reviewer flagged and confirmed:

1. **All GraphQL strings must be hoisted to module-level `const`** — never inline inside `test()` bodies or `beforeAll`. This applies to every mutation and query used in the file.

2. **`logger.verify()` before `softExpect()` is correct — NOT a duplicate.** `softExpect` (bare Pattern A) does NOT log internally. Only the `softAssert.*` fixture (SoftAssertHelper) logs internally with `🔵 [SOFT]`. The qa-code-reviewer may flag this as "duplicate logging" but that is a false positive — see [[feedback_preferences]].

3. **Module-level variables must have explicit initializers**: `let customerToken: string = ''` not `let customerToken: string`.

4. **`AuthType.BEARER` enum** — never `"bearer" as any`.

5. **`test.describe.configure({ mode: 'serial' })` outside all `describe` blocks** — not `test.describe.serial(...)`.

6. **Guard `errors[0]` access with `.length` check**: `gql.errors.length ? gql.errors[0]?.message ?? '' : ''`.

7. **`plaTestData.cartId` was a dead field** — removed 2026-05-16. The field imported `cartId` from shared-state at module init time, capturing `undefined` before any test set it. The `cartId` import and `PlaTestData.cartId` interface field have been deleted from `pla-test-data.ts`.

8. **P2 schema gaps (productSearch)**: `productSearch` autocomplete is not in the staging Magento 2 schema. Tests for this operation must call `getGraphQLResponse()` directly, check for `"Cannot query field"` + `"productSearch"` in errors, and return early instead of failing.

## api-scenarios-report.html

Self-contained HTML report at `Guideline/api-scenarios-report.html`. Documents 38 GraphQL operations across 12 categories. Marks each as Covered/New and assigns P1/P2/P3 priority. Regenerate by running `qa-orchestrator` explore workflow.

**Coverage as of 2026-05-27:** 37 Covered, 1 New/Gap (customer.orders P1).
- +1 added 2026-05-27: `placeOrder` (covered by `pla-place-order.spec.ts` TC_01–03)
- +2 added 2026-05-26: `setBillingAddressOnCart`, `setPaymentMethodOnCart` (covered by `pla-checkout-billing-payment.spec.ts`)
- +2 added with `pla-checkout-shipping.spec.ts`: `setShippingAddressesOnCart`, `setShippingMethodsOnCart`
