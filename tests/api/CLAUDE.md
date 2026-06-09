# API Test Rules

Supplements the root `CLAUDE.md`. Rules here apply to everything under `tests/api/`.

## Import — Critical

```ts
// Always this
import { apiTest as test, expect, softExpect } from '../../src/api/ApiTest';

// Never this in API test files
import { test, expect } from '@config/base-test';
```

## Serial Mode — Mandatory

Every spec file must declare this **outside all `test.describe` blocks**:

```ts
test.describe.configure({ mode: 'serial' });
// NOT: test.describe.serial(...)
```

## API Test Data

All API test data lives in `src/data/api/` — one file per feature domain (e.g., `pla-catalog-data.ts`, `pla-auth-data.ts`, `pla-search-data.ts`). Always annotate exported constants and generator return types with named interfaces (see root CLAUDE.md Test Data section).

## Code Quality Rules

1. **Hoist all GraphQL strings to module-level `const`** — never inline mutations/queries inside `test()` bodies or `beforeAll`.
2. **Module-level `let` variables need explicit initializers**: `let token: string = ''` not `let token: string`.
3. **`AuthType.BEARER` enum** — never `"bearer" as any`.
4. **Guard `errors[0]` access**: `gql.errors.length ? gql.errors[0]?.message ?? '' : ''`.
5. **No `logger.verify()` adjacent to `softAssert.*` fixture calls** — `SoftAssertHelper` (the `softAssert` fixture) logs internally with `🔵 [SOFT]`; calling `logger.verify()` before a `softAssert.*` call creates a duplicate log entry. **`softExpect` (bare Pattern A, no fixture) does NOT log internally** — pairing it with `logger.verify()` is correct and expected.

## PLA GraphQL Tests — Shared-State Pattern

Shared state (`tests/api/shared-state.ts`) carries `token`, `customerId`, `cartId`, `addressId` across PLA spec files within a single worker.

### Always-fresh auth (mandatory for any spec needing auth)

Never reuse `getCustomerToken()` from shared-state. Always sign in fresh in `beforeAll`:

1. Try `generateCustomerToken` with `plaTestData.validCredentials`
2. If errors → create account → sign in again
3. Call `setCustomerToken(token)` to update shared-state

**Why:** `pla-authentication.spec.ts` calls `generateCustomerToken` for the same account (TC_01/TC_02), which invalidates any previously issued token. A non-empty stale string bypasses an `if (!token)` guard.

Pass only `{ email, password, remember }` to `SIGN_IN_MUTATION` — not the full `validCredentials` object (which has `firstName`/`lastName` not declared in the mutation variables).

### Always-fresh cart (mandatory for any spec needing a cart)

Never reuse `getCartId()` from shared-state. Always create a fresh cart in `beforeAll` using the auth client.

**Why:** A `cartId` created in one session is inaccessible with a different session token. Magento 2 returns `"The current user cannot perform operations on cart"`.

## PLA Staging API Quirks

These are Platypus staging-specific behaviours — do not assume standard Magento 2 responses:

| Operation | Staging behaviour |
|---|---|
| `requestPasswordResetEmail` with non-existent email | Returns `graphql-input` error (NOT silent `true`) — staging discloses account non-existence |
| Invalid email format error message | `"Invalid email address entered"` (custom), NOT standard Magento `"is not a valid email address."` |
| `revokeCustomerToken` error category | `graphql-authorization` |
| `revokeCustomerToken` + immediate re-sign-in (TC_01 → TC_02) | TC_01 revokes its token; TC_02 signs in immediately after → new token is **immediately invalid** on Magento staging (session store hasn't committed TC_01's revocation). Fix: add `POLL_INTERVAL_NORMAL` (1s) wait at the **start of TC_02** before signing in. |
| `revokeCustomerToken` + immediate `customer` query (TC_02 Step 3) | After `revokeCustomerToken` succeeds, the revoked token may still be accepted for 1–5s. Fix: **poll** the protected resource (up to 5 × 1s) until the `graphql-authorization` error appears rather than querying once immediately. |
| `resetPassword` validation order | Validates token **before** password strength — weak-password tests get a token-invalid error first |
| `addProductsToWishlist` item `__typename` | Returns `ConfigurableWishlistItem` even for simple-product adds — use `.toContain('WishlistItem')` not `.toBe('WishlistItem')` |
| Product search `__typename` | `products(search: ...)` returns only `ConfigurableProduct` items inconsistently — always fall back to `allItems[0]`; never throw on "no SimpleProduct found" |
| `CartAddressInput.region` | Plain `String` (e.g. `'NSW'`), NOT a `CustomerAddressRegionInput` object — only `CustomerAddressInput` uses `{ region_code: String }` |
| Available shipping methods on staging | `instore_pickup` and `flatrate_flatrate` are the two available methods for AU addresses |
| Braintree payment variants | `braintree`, `braintree_applepay`, `braintree_paypal` require an SDK-provided `payment_method_nonce`. Setting just `{ code: "braintree" }` returns `"Required parameter 'braintree' for 'payment_method' is missing."` — untestable without Braintree SDK |
| Available payment methods on staging | `checkmo`, `braintree_applepay`, `afterpay`, `braintree`, `braintree_paypal` (AU cart, confirmed 2026-05-26). Use `checkmo` and `afterpay` for payment method API tests |
| `setBillingAddressOnCart` same_as_shipping | `billing_address` IS populated (non-null) in the response when `same_as_shipping: true` — it contains the shipping address data |
| `instore_pickup` + `placeOrder` | Selecting `instore_pickup` as shipping method then calling `placeOrder` fails with `"Unable to place order: Quote does not have Pickup Location assigned."` — always prefer `flatrate_flatrate` for tests that call `placeOrder` |
| `placeOrder` order number format | PLA staging order numbers are NOT purely numeric — do NOT assert `/^\d+$/`. Use `/^\S+$/` (any non-whitespace) or just `.toBeTruthy()` |
| OOS items + `placeOrder` | Staging blocks out-of-stock items at `addProductsToCart` level via `user_errors` (`"Product that you are trying to add is not available."`). It is not possible to have an OOS item in the cart to test a `placeOrder` OOS error — skip gracefully when `user_errors` is non-empty on add |

## Error Presence Check — Critical

Never use `if (!gql.errors)` — an empty array `[]` is truthy and bypasses the error branch silently.
Use `if (!(gql.errors?.length))` consistently across all `beforeAll` auth flows.

## Wishlist — Error Shape

Wishlist mutations (`addProductsToWishlist`, `removeProductsFromWishlist`) return errors two ways:
- Top-level `errors` — auth failures (`graphql-authorization`)
- `user_errors` in mutation payload — business logic failures (invalid SKU, non-existent item ID)

Use a `wasRejected(gql, opName)` helper that checks both:

```ts
interface GqlWithUserErrors { user_errors?: UserError[]; }

function wasRejected(
  gql: { errors?: { message?: string }[]; data?: Record<string, GqlWithUserErrors | undefined> },
  opName: string,
): boolean {
  if ((gql.errors?.length ?? 0) > 0) return true;
  const userErrors = gql.data?.[opName]?.user_errors;
  return Array.isArray(userErrors) && userErrors.length > 0;
}
```

Wishlist items use `items_v2(pageSize: N)` — the modern accessor; plain `items` is deprecated in Magento 2.4+.

## GraphQL Variables — Never Interpolate

```ts
// Correct — variables as second arg
await graphqlClient.queryWrapped(
  `query GetUser($id: ID!) { user(id: $id) { name } }`,
  { id }
);

// Wrong — injection risk, breaks caching
await graphqlClient.queryWrapped(`query { user(id: "${id}") { name } }`);
```

## PLA Catalog — Partial Error Tolerance

PLA staging has broken `price_range` data on some products. Catalog queries must use `assertNoCriticalErrors()` instead of `response.assertNoErrors()`:

```ts
function assertNoCriticalErrors(gql: { errors?: Array<{ path?: unknown }> }): void {
  const criticalErrors = (gql.errors ?? []).filter(
    (e) => !(Array.isArray(e.path) && (e.path as string[]).includes('price_range')),
  );
  expect(criticalErrors, 'unexpected GraphQL errors').toHaveLength(0);
}
```

Define this as a module-level function in any spec that touches product pricing. Never use `response.assertNoErrors()` for catalog queries on PLA staging.

## `productSearch` Schema Gap

`productSearch` autocomplete is not in the staging Magento 2 schema (P2 gap). Tests for this operation must call `getGraphQLResponse()` directly, check for `"Cannot query field"` + `"productSearch"` in errors, and return early rather than failing.

## Checkout Shipping — Operation Order Dependency

`setShippingMethodsOnCart` requires a shipping address to already be set on the cart.
`available_shipping_methods` is only populated after `setShippingAddressesOnCart` runs.
Always call these in order within the same test suite: address → methods.
For TC_05/TC_06: re-query `cart.shipping_addresses[0].available_shipping_methods` fresh each test — do NOT store from a prior test's response; address changes between tests can alter the method list.

## Checkout Billing & Payment — Operation Order Dependency

Full checkout mutation order: `addProductsToCart` → `setShippingAddressesOnCart` → `setShippingMethodsOnCart` → `setBillingAddressOnCart` → `setPaymentMethodOnCart` → `placeOrder`.

`cart.available_payment_methods` is empty until `setShippingMethodsOnCart` has run. Payment method tests that skip silently when `available_payment_methods` is empty provide no failure signal — guard them explicitly:

```ts
let shippingMethodSet: boolean = false;

// In beforeAll — set to true only when shipping method mutation succeeds
if (!(methodGql.errors?.length)) { shippingMethodSet = true; }

// In TC_03/TC_04 — fail fast and clearly
if (!shippingMethodSet || availablePaymentMethods.length === 0) {
  test.skip(true, 'No shipping method set or no payment methods available');
  return;
}
```

Braintree payment variants (`braintree`, `braintree_applepay`, `braintree_paypal`) require an SDK-provided nonce and cannot be tested without Braintree integration. Use `checkmo` (primary) and `afterpay` (alternate) for payment method API tests on staging.

## Place Order — SKU Discovery

When discovering a valid SKU for cart operations in `beforeAll`, **never use the fallback `else if (item.sku)` pattern** that captures configurable parent product SKUs. Parent SKUs are not addable to cart and return `user_errors: "Product that you are trying to add is not available."`.

Correct pattern: collect only confirmed in-stock simple product SKUs or variant SKUs, then retry adding each candidate in order:

```ts
const candidateSkus: string[] = [];
for (const item of items) {
  if (item.stock_status === 'IN_STOCK' && item.__typename === 'SimpleProduct') {
    candidateSkus.push(item.sku);
  } else if (item.__typename === 'ConfigurableProduct' && Array.isArray(item.variants)) {
    for (const v of item.variants) {
      if (v.product?.stock_status === 'IN_STOCK') candidateSkus.push(v.product.sku);
    }
  }
  // NO fallback to item.sku here
}
// Then try adding each candidate until one succeeds
for (const sku of candidateSkus) {
  const addGql = await addToCart(sku);
  const userErrors = addGql.data?.addProductsToCart?.user_errors ?? [];
  if (!addGql.errors?.length && !userErrors.length) { validSku = sku; break; }
}
```

## Test Naming Convention

New PLA tests: `TC_XX - Description` format.
Older PLA specs (`pla-account-creation-signin`): `PLA_OperationName - description` format — do not rename existing tests.
