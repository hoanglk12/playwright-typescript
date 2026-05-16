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

## Code Quality Rules

1. **Hoist all GraphQL strings to module-level `const`** — never inline mutations/queries inside `test()` bodies or `beforeAll`.
2. **Module-level `let` variables need explicit initializers**: `let token: string = ''` not `let token: string`.
3. **`AuthType.BEARER` enum** — never `"bearer" as any`.
4. **Guard `errors[0]` access**: `gql.errors.length ? gql.errors[0]?.message ?? '' : ''`.
5. **No `logger.verify()` adjacent to `softExpect()`** — `softExpect` logs internally; calling both creates a duplicate log entry.

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
| `resetPassword` validation order | Validates token **before** password strength — weak-password tests get a token-invalid error first |

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

## `productSearch` Schema Gap

`productSearch` autocomplete is not in the staging Magento 2 schema (P2 gap). Tests for this operation must call `getGraphQLResponse()` directly, check for `"Cannot query field"` + `"productSearch"` in errors, and return early rather than failing.

## Test Naming Convention

New PLA tests: `TC_XX - Description` format.
Older PLA specs (`pla-account-creation-signin`): `PLA_OperationName - description` format — do not rename existing tests.
