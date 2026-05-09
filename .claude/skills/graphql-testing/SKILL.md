---
name: "graphql-testing"
description: Use when mocking, testing, or validating GraphQL APIs in Playwright, including queries, mutations, variables, error handling, introspection, and batching.
---

# GraphQL Testing

This project has a built-in `GraphQLClient` (extends `ApiClient`) with full query, mutation, and assertion support. All GraphQL tests live in `tests/api/` and use `apiTest` from `../../src/api/ApiTest`.

---

## Import — Critical

```ts
// API tests: NEVER use @config/base-test or @playwright/test directly
import { apiTest as test, expect } from '../../src/api/ApiTest';
import { AuthType } from '../../src/api/ApiClient';
import { createTestLogger } from '../../src/utils/test-logger';
```

## Serial Mode — Mandatory

Every API spec file must declare this at the top, outside all `test.describe` blocks:

```ts
test.describe.configure({ mode: 'serial' });
```

---

## Fixtures Available

| Fixture | Type | Use for |
|---|---|---|
| `graphqlClient` | `GraphQLClient` | Default GQL client against `graphqlURL` env var |
| `createGraphQLClient` | factory | Custom auth/endpoint — returns a fresh `GraphQLClient` |
| `graphqlURL` | `string` | The resolved `graphqlBaseUrl + graphqlEndpoint` |

---

## `GraphQLClient` Methods

| Method | Returns | Purpose |
|---|---|---|
| `query(query, variables?, opName?)` | `Promise<APIResponse>` | Raw query — use for low-level tests |
| `mutate(mutation, variables?, opName?)` | `Promise<APIResponse>` | Raw mutation |
| `queryWrapped(query, variables?, opName?)` | `Promise<GraphQLResponseWrapper>` | **Preferred** — returns assertion-ready wrapper |
| `mutateWrapped(mutation, variables?, opName?)` | `Promise<GraphQLResponseWrapper>` | **Preferred** for mutations |
| `introspect()` | `Promise<APIResponse>` | Schema introspection |
| `addToBatch(request)` | `void` | Queue a request (requires `batchingEnabled: true`) |
| `executeBatch()` | `Promise<APIResponse>` | Flush the batch queue |
| `clearBatch()` | `void` | Discard queued batch |
| `parseGraphQLResponse(response)` | `Promise<GraphQLResponse<T>>` | Parse raw `APIResponse` into `{data, errors}` |
| `hasErrors(gqlResponse)` | `boolean` | Sync check on parsed response |
| `getErrorMessages(gqlResponse)` | `string[]` | Extract error messages from parsed response |

---

## `GraphQLResponseWrapper` Assertion Chain

Always prefer `*Wrapped` methods — they return a `GraphQLResponseWrapper` with chainable assertions.

### Happy-path pattern (no errors expected)

```ts
const response = await graphqlClient.queryWrapped(
  `query GetUser($id: ID!) { user(id: $id) { id name email } }`,
  { id: '1' }
);

await response.assertStatus(200);      // HTTP-level check
await response.assertNoErrors();       // REQUIRED on all happy-path GQL tests
await response.assertHasData();        // data field exists and is not null
await response.assertDataHasFields(['user']);
await response.assertDataField('user.id', '1');
await response.assertDataField('user.name', expect.any(String));
await response.assertDataFieldContains('user.email', '@');

const data = await response.getData();
expect(data.user.name).toBe('Alice');
```

### Error-path pattern

```ts
const response = await graphqlClient.queryWrapped(`
  query GetProtected { secretData { value } }
`);

await response.assertHasErrors();
await response.assertErrorMessage('Unauthorized');
await response.assertErrorCode('UNAUTHENTICATED');  // checks extensions.code
await response.assertErrorPath(['secretData']);       // checks which field errored
```

### List assertions

```ts
const listSize = await response.getListSize('users');
await response.assertListSize('users', 10);
```

### Full method reference

| Method | Description |
|---|---|
| `assertNoErrors()` | Fails if `errors` field exists — call first on every happy-path test |
| `assertHasErrors()` | Fails if no `errors` field |
| `assertErrorMessage(msg)` | Partial match on any error message |
| `assertErrorCode(code)` | Matches `extensions.code` on any error |
| `assertErrorPath(path[])` | Matches the `path` array on any error |
| `assertData(expected)` | `toMatchObject` on `data` field |
| `assertDataField(path, value)` | Dot-notation path equality check |
| `assertDataFieldContains(path, value)` | Contains check (string, array, or object partial) |
| `assertHasData()` | `data` is defined and not null |
| `assertDataHasFields(fields[])` | Each field name is present in `data` |
| `getListSize(path)` | Returns count of array at dot-notation path |
| `assertListSize(path, size)` | Asserts array length |
| `getData<T>()` | Returns typed `data` object |
| `getErrors()` | Returns raw errors array |
| `getErrorMessages()` | Returns string array of error messages |

---

## Variables — Always Use the Second Argument

**NEVER string-interpolate variables into query bodies.** Always pass them as the second argument.

```ts
// WRONG — injection risk, breaks operation caching
const response = await graphqlClient.queryWrapped(
  `query { user(id: "${userId}") { id } }`
);

// CORRECT — type-safe, cacheable
const response = await graphqlClient.queryWrapped(
  `query GetUser($id: ID!) { user(id: $id) { id } }`,
  { id: userId }
);
```

---

## Authentication

Use `createGraphQLClient` for per-test auth variations:

```ts
test('TC_01 - Authenticated query', async ({ createGraphQLClient }) => {
  const client = await createGraphQLClient({
    authType: AuthType.BEARER,
    token: process.env.TEST_TOKEN ?? ''
  });

  const response = await client.queryWrapped(`query { me { id email } }`);
  await response.assertNoErrors();
  await response.assertDataHasFields(['me']);
});

test('TC_02 - API Key auth', async ({ createGraphQLClient }) => {
  const client = await createGraphQLClient({
    authType: AuthType.API_KEY,
    apiKey: process.env.API_KEY ?? '',
    apiKeyHeaderName: 'X-API-Key'
  });
  // ...
});
```

For tokens that persist across multiple tests (e.g., login-once-then-use), use `ApiClient.storeToken`:

```ts
import { ApiClient } from '../../src/api/ApiClient';

test.beforeAll(async ({ graphqlClient }) => {
  const authResp = await graphqlClient.mutateWrapped(
    `mutation Login($input: LoginInput!) { login(input: $input) { token } }`,
    { input: { email: 'user@example.com', password: 'pass' } }
  );
  await authResp.assertNoErrors();
  const data = await authResp.getData<{ login: { token: string } }>();
  ApiClient.storeToken('gql-auth', data.login.token);
});
```

---

## GraphQL Mocking (UI Tests Only)

In UI tests that need to mock GraphQL responses from the browser, use `ApiMockService`:

```ts
import { ApiMockService } from '../../src/api/ApiMockService';

test('TC_01 - Page renders with mocked GQL data', async ({ page }) => {
  const mockService = new ApiMockService(page);

  await mockService.mockGraphQLQuery('GetUserProfile', {
    userProfile: { id: '1', name: 'Mock User', role: 'admin' }
  });

  await mockService.mockGraphQLError('GetProtectedData', 'Unauthorized', 'UNAUTHENTICATED');

  await page.goto('/dashboard');
  // assertions on UI that consumed the mocked GraphQL data
});
```

GraphQL mocks match on the `operationName` field in the request body — always name your operations.

---

## Introspection

```ts
test('TC_01 - Schema introspection', async ({ graphqlClient }) => {
  const response = await graphqlClient.introspect();
  expect(response.status()).toBe(200);

  const schema = await response.json();
  expect(schema.data.__schema.types).toBeInstanceOf(Array);

  const queryType = schema.data.__schema.types.find((t: any) => t.name === 'Query');
  expect(queryType).toBeDefined();
});
```

---

## Batching

Only use when your GraphQL server explicitly supports batched requests:

```ts
test('TC_01 - Batch queries', async ({ createGraphQLClient }) => {
  const client = await createGraphQLClient({ batchingEnabled: true, maxBatchSize: 5 });

  client.addToBatch({ query: `query Q1 { users { id } }` });
  client.addToBatch({ query: `query Q2 { posts { id } }` });

  const response = await client.executeBatch();
  expect(response.status()).toBe(200);
});
```

---

## Full Test File Template

```ts
import { apiTest as test, expect } from '../../src/api/ApiTest';
import { AuthType } from '../../src/api/ApiClient';
import { createTestLogger } from '../../src/utils/test-logger';
import { MyGraphQLData } from '../../src/data/my-graphql-data';

test.describe.configure({ mode: 'serial' });

test.describe('User GraphQL API @api @graphql', () => {

  test('TC_01 - Should fetch user by ID', async ({ graphqlClient }) => {
    const logger = createTestLogger('TC_01 Should fetch user by ID');

    logger.step('Step 1 - Execute GetUser query');
    const response = await graphqlClient.queryWrapped(
      `query GetUser($id: ID!) {
        user(id: $id) { id name email }
      }`,
      { id: MyGraphQLData.existingUserId }
    );

    logger.step('Step 2 - Assert response');
    await response.assertStatus(200);
    await response.assertNoErrors();
    await response.assertDataField('user.id', MyGraphQLData.existingUserId);
    logger.verify('User ID matches', MyGraphQLData.existingUserId, (await response.getData()).user.id);
  });

  test('TC_02 - Should return error for unknown user', async ({ graphqlClient }) => {
    const logger = createTestLogger('TC_02 Should return error for unknown user');

    logger.step('Step 1 - Execute query with unknown ID');
    const response = await graphqlClient.queryWrapped(
      `query GetUser($id: ID!) { user(id: $id) { id } }`,
      { id: '999999' }
    );

    logger.step('Step 2 - Assert error response');
    const data = await response.getData();
    if (await response.hasErrors()) {
      await response.assertErrorMessage('not found');
    } else {
      expect(data.user).toBeNull();
    }
  });

  test('TC_03 - Should create user via mutation', async ({ graphqlClient }) => {
    const logger = createTestLogger('TC_03 Should create user via mutation');

    logger.step('Step 1 - Execute CreateUser mutation');
    const response = await graphqlClient.mutateWrapped(
      `mutation CreateUser($input: CreateUserInput!) {
        createUser(input: $input) { id name email }
      }`,
      { input: MyGraphQLData.newUser }
    );

    logger.step('Step 2 - Assert created user');
    await response.assertNoErrors();
    await response.assertDataField('createUser.email', MyGraphQLData.newUser.email);
  });
});
```

---

## Data Module Pattern

```ts
// src/data/my-graphql-data.ts
export interface NewUserInput {
  name: string;
  email: string;
  password: string;
}

export interface MyGraphQLDataShape {
  existingUserId: string;
  newUser: NewUserInput;
}

export const MyGraphQLData: MyGraphQLDataShape = {
  existingUserId: '1',
  newUser: { name: 'Test User', email: `test${Date.now()}@example.com`, password: 'TestPass123!' },
};
```

---

## Common Mistakes

| Wrong | Correct |
|---|---|
| `import { test } from '@playwright/test'` | `import { apiTest as test } from '../../src/api/ApiTest'` |
| `import { test } from '@config/base-test'` | `import { apiTest as test } from '../../src/api/ApiTest'` |
| Skip `assertNoErrors()` on happy-path | Always call `await response.assertNoErrors()` first |
| String-interpolate variables | Pass typed object as second arg |
| `const r = await graphqlClient.query(...)` without wrapping | Use `queryWrapped` for automatic assertion support |
| Put GQL tests in `tests/frontsite/` | GQL tests belong in `tests/api/` |
| Miss `test.describe.configure({ mode: 'serial' })` | Required at top of every API spec file |
