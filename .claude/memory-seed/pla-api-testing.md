---
name: pla-api-testing
description: PLA (Platypus Shoes) GraphQL API test patterns, file structure, shared-state flow, and staging API quirks
metadata:
  type: project
---

## File & Data Structure

| File | Purpose |
|---|---|
| `tests/api/pla-account-creation-signin.spec.ts` | Create account, sign in, get customer details |
| `tests/api/pla-cart_minicart.spec.ts` | Cart / minicart queries and mutations |
| `tests/api/pla-my-details.spec.ts` | Address book, customer info updates |
| `tests/api/pla-support-features.spec.ts` | Currency, dynamic promo blocks |
| `tests/api/pla-authentication.spec.ts` | revokeCustomerToken, requestPasswordResetEmail, resetPassword |
| `tests/api/pla-search.spec.ts` | Product search and autocomplete suggestions |
| `tests/api/shared-state.ts` | Token, customerId, cartId, addressId — shared across PLA spec files in one worker |
| `src/data/api/pla-test-data.ts` | Dynamic email + all account/address/cart test data |
| `src/data/api/pla-auth-data.ts` | Auth-specific test data (reset password inputs, error messages) |
| `src/data/api/pla-search-data.ts` | Search terms and pagination config for search tests |

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

## Staging API Quirks (discovered 2026-05-15)

- **`requestPasswordResetEmail` with non-existent email** returns a `graphql-input` error (NOT silent `true` as in standard Magento 2). The staging app discloses account non-existence through this error.
- **Invalid email format error message** is `"Invalid email address entered"` (custom message), NOT the standard Magento `"is not a valid email address."`. Update `plaAuthErrorMessages.invalidEmailFormat` if Magento is upgraded.
- **`revokeCustomerToken` error category** is `graphql-authorization` (confirmed on staging).
- **`resetPassword` validates token before password** — weak-password tests will get a token-invalid error first, not a password-strength error.

## TC_XX Naming Convention

PLA auth tests use `TC_XX - Description` format. Earlier PLA specs (`pla-account-creation-signin`) use `PLA_OperationName - description` format. New tests should use `TC_XX`.

**Why:** [[feedback_preferences]] — terse consistent naming. TC_XX aligns with CLAUDE.md standard test structure.

## PLA Test Code Quality Rules (confirmed 2026-05-16)

Rules the qa-code-reviewer flagged and confirmed:

1. **All GraphQL strings must be hoisted to module-level `const`** — never inline inside `test()` bodies or `beforeAll`. This applies to every mutation and query used in the file.

2. **No `logger.verify()` duplicating adjacent `softExpect()` checks.** `softExpect` already logs internally; calling `logger.verify()` on the same fact creates a duplicate log entry.

3. **Module-level variables must have explicit initializers**: `let customerToken: string = ''` not `let customerToken: string`.

4. **`AuthType.BEARER` enum** — never `"bearer" as any`.

5. **`test.describe.configure({ mode: 'serial' })` outside all `describe` blocks** — not `test.describe.serial(...)`.

6. **Guard `errors[0]` access with `.length` check**: `gql.errors.length ? gql.errors[0]?.message ?? '' : ''`.

7. **`plaTestData.cartId` was a dead field** — removed 2026-05-16. The field imported `cartId` from shared-state at module init time, capturing `undefined` before any test set it. The `cartId` import and `PlaTestData.cartId` interface field have been deleted from `pla-test-data.ts`.

8. **P2 schema gaps (productSearch)**: `productSearch` autocomplete is not in the staging Magento 2 schema. Tests for this operation must call `getGraphQLResponse()` directly, check for `"Cannot query field"` + `"productSearch"` in errors, and return early instead of failing.

## api-scenarios-report.html

Self-contained HTML report at project root. Generated 2026-05-15. Documents 38 GraphQL operations across 12 categories (Account, Auth, Cart, Checkout, Catalog, Search, Customer, Address, Loyalty, Store, Wishlist, Orders). Marks each as Covered/New and assigns P1/P2/P3 priority. Regenerate by running `qa-orchestrator` explore workflow.
