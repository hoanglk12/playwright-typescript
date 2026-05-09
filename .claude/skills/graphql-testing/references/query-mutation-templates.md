# GraphQL Query & Mutation Templates

## Minimal query

```ts
const response = await graphqlClient.queryWrapped(
  `query GetItem($id: ID!) {
    item(id: $id) { id name }
  }`,
  { id: '1' }
);
await response.assertNoErrors();
await response.assertDataField('item.id', '1');
```

## Minimal mutation

```ts
const response = await graphqlClient.mutateWrapped(
  `mutation CreateItem($input: CreateItemInput!) {
    createItem(input: $input) { id name }
  }`,
  { input: { name: 'New Item' } }
);
await response.assertNoErrors();
await response.assertHasData();
```

## List query with size assertion

```ts
const response = await graphqlClient.queryWrapped(
  `query ListUsers { users { id name email } }`
);
await response.assertNoErrors();
await response.assertListSize('users', 10);
const data = await response.getData<{ users: User[] }>();
expect(data.users[0].email).toContain('@');
```

## Auth with `createGraphQLClient`

```ts
test('TC_01 - Authenticated query', async ({ createGraphQLClient }) => {
  const client = await createGraphQLClient({
    authType: AuthType.BEARER,
    token: process.env.TEST_TOKEN ?? ''
  });
  const response = await client.queryWrapped(`query { me { id email } }`);
  await response.assertNoErrors();
});
```

## Login-once token store (beforeAll)

```ts
import { ApiClient } from '../../src/api/ApiClient';

test.beforeAll(async ({ graphqlClient }) => {
  const auth = await graphqlClient.mutateWrapped(
    `mutation Login($input: LoginInput!) { login(input: $input) { token } }`,
    { input: { email: 'user@test.com', password: 'pass' } }
  );
  await auth.assertNoErrors();
  const data = await auth.getData<{ login: { token: string } }>();
  ApiClient.storeToken('gql-auth', data.login.token);
});
```

## Error path testing

```ts
const response = await graphqlClient.queryWrapped(
  `query GetProtected { adminData { secret } }`
);
await response.assertHasErrors();
await response.assertErrorMessage('Unauthorized');
await response.assertErrorCode('UNAUTHENTICATED');
```

## Introspection

```ts
const response = await graphqlClient.introspect();
expect(response.status()).toBe(200);
const schema = await response.json();
const queryType = schema.data.__schema.types.find((t: any) => t.name === 'Query');
expect(queryType).toBeDefined();
```

## Batching (only if server supports it)

```ts
const client = await createGraphQLClient({ batchingEnabled: true, maxBatchSize: 5 });
client.addToBatch({ query: `query Q1 { users { id } }` });
client.addToBatch({ query: `query Q2 { posts { id } }` });
const response = await client.executeBatch();
expect(response.status()).toBe(200);
```

## NEVER do this

```ts
// WRONG — string interpolation breaks caching and is an injection risk
await graphqlClient.queryWrapped(`query { user(id: "${userId}") { id } }`);

// CORRECT
await graphqlClient.queryWrapped(
  `query GetUser($id: ID!) { user(id: $id) { id } }`,
  { id: userId }
);
```
