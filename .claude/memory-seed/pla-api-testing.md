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
| `tests/api/shared-state.ts` | Token, customerId, cartId, addressId — shared across PLA spec files in one worker |
| `src/data/api/pla-test-data.ts` | Dynamic email + all account/address/cart test data |
| `src/data/api/pla-auth-data.ts` | Auth-specific test data (reset password inputs, error messages) |

## Shared-State Pattern

All PLA specs use `test.describe.serial()` or `test.describe.configure({ mode: 'serial' })` + a `beforeAll` that:
1. Tries `getCustomerToken()` from shared-state (reuse if tests run in suite order)
2. If missing: creates account via `createCustomer` mutation → signs in → calls `setCustomerToken()`

When running a PLA spec in isolation, `beforeAll` self-bootstraps a fresh account. `plaTestData.validCustomer.email` equals `getTestEmail()` — the same dynamic email used across all PLA specs in a single test session.

## Staging API Quirks (discovered 2026-05-15)

- **`requestPasswordResetEmail` with non-existent email** returns a `graphql-input` error (NOT silent `true` as in standard Magento 2). The staging app discloses account non-existence through this error.
- **Invalid email format error message** is `"Invalid email address entered"` (custom message), NOT the standard Magento `"is not a valid email address."`. Update `plaAuthErrorMessages.invalidEmailFormat` if Magento is upgraded.
- **`revokeCustomerToken` error category** is `graphql-authorization` (confirmed on staging).
- **`resetPassword` validates token before password** — weak-password tests will get a token-invalid error first, not a password-strength error.

## TC_XX Naming Convention

PLA auth tests use `TC_XX - Description` format. Earlier PLA specs (`pla-account-creation-signin`) use `PLA_OperationName - description` format. New tests should use `TC_XX`.

**Why:** [[feedback_preferences]] — terse consistent naming. TC_XX aligns with CLAUDE.md standard test structure.

## api-scenarios-report.html

Self-contained HTML report at project root. Generated 2026-05-15. Documents 38 GraphQL operations across 12 categories (Account, Auth, Cart, Checkout, Catalog, Search, Customer, Address, Loyalty, Store, Wishlist, Orders). Marks each as Covered/New and assigns P1/P2/P3 priority. Regenerate by running `qa-orchestrator` explore workflow.
