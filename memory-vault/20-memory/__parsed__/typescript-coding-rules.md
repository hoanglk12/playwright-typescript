---
name: typescript-coding-rules
description: "TypeScript quality rules enforced by qa-code-reviewer and CI lint gate — error array guards, optional chaining, initializers, GraphQL hoisting"
type: feedback
tags: [memory, feedback]
last_verified: 2026-06-12
---

Rules the qa-code-reviewer flags and CI type-check enforces. Apply to every API spec and page class.

## 1. Error Array: `errors?.length`, never bare truthy

```ts
// WRONG — empty array [] is truthy; misclassifies failed response as success
if (gql.errors) { ... }

// CORRECT
if (gql.errors?.length) { ... }
// or equivalently:
if ((gql.errors?.length ?? 0) > 0) { ... }
```

**How to apply:** Every single `if (gql.errors)` check must become `if (gql.errors?.length)`.

## 2. Optional chaining on error index — inside length checks too

TypeScript does NOT narrow `errors` to non-undefined after `if (gql.errors?.length)`. Always use `?.` on index access:

```ts
// WRONG — TS doesn't narrow errors inside the block
if (gql.errors?.length) {
  const msg = gql.errors[0].message;  // compile error: possibly undefined
}

// CORRECT
if (gql.errors?.length) {
  const msg = gql.errors?.[0]?.message ?? '';
}
```

## 3. Module-level `let` — explicit initializers required

```ts
// WRONG — TypeScript strict: definite assignment error
let customerToken: string;
let cartId: string;

// CORRECT
let customerToken: string = '';
let cartId: string = '';
```

**Why:** Explicit initializers make the "empty state" semantic explicit and prevent `undefined` slipping in through strict mode gaps.

## 4. GraphQL strings hoisted to module-level `const`

```ts
// WRONG — inline inside test() or beforeAll()
test('TC_01', async ({ graphqlClient }) => {
  const response = await graphqlClient.queryWrapped(
    `query GetUser($id: ID!) { user(id: $id) { name } }`,
    { id }
  );
});

// CORRECT — module-level constant
const GET_USER_QUERY = `
  query GetUser($id: ID!) {
    user(id: $id) { name }
  }
`;

test('TC_01', async ({ graphqlClient }) => {
  const response = await graphqlClient.queryWrapped(GET_USER_QUERY, { id });
});
```

**Why:** All GraphQL strings must be hoisted. Applies to every mutation and query used in the file.

## 5. AuthType enum — never string literals

```ts
// WRONG
const client = await createGraphQLClient({ auth: "bearer" as any });

// CORRECT
import { AuthType } from '../../src/api/ApiClient';
const client = await createGraphQLClient({ authType: AuthType.BEARER, token });
```

## 6. Named interfaces on all exported data shapes

```ts
// WRONG — inferred type
export const AdminData = { VALID_ADMIN: { username: 'admin', password: 'pass' } };

// CORRECT — named interface + annotation
export interface LoginCredentials { username: string; password: string; }
export interface AdminDataShape { VALID_ADMIN: LoginCredentials; }
export const AdminData: AdminDataShape = { VALID_ADMIN: { username: 'admin', password: 'pass' } };
```

Applies to: all exported `const` data objects AND all generator return types.

## 7. Explicit return types on exported functions and generators

```ts
// WRONG — inferred
static generateCustomerData() { return { name: 'Test', email: 'test@mail.com' }; }

// CORRECT
static generateCustomerData(): CustomerData { return { name: 'Test', email: 'test@mail.com' }; }
```

## 8. CI lint gate

`npm run lint` runs `tsc --noEmit`. Any TypeScript type error **fails the CI build**. Run locally before pushing: `npm run lint`.

**Why all of the above matter:** TypeScript strict mode + `noEmit` lint gate means every pattern violation turns into a CI failure. The qa-code-reviewer catches these before CI — these rules reflect what it looks for.

See also [[feedback_preferences]] for softExpect vs softAssert logging rules.
