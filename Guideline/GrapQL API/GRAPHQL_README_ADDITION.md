# GraphQL API Testing - README Addition

**Add this section to your main README.md file under the API Testing section**

---

## GraphQL API Testing

This framework includes comprehensive GraphQL API testing support with full integration into the existing Playwright TypeScript architecture.

### Features

- ✅ **Query Operations** - Execute GraphQL queries with variables
- ✅ **Mutation Operations** - Create, update, delete operations
- ✅ **Subscription Support** - WebSocket-based subscriptions
- ✅ **Schema Introspection** - Discover and validate GraphQL schemas
- ✅ **Request Batching** - Optimize multiple queries
- ✅ **Response Assertions** - Fluent API for validating responses
- ✅ **Error Handling** - GraphQL-specific error parsing and validation
- ✅ **Multiple Authentication** - Bearer, API Key, Basic, Custom headers
- ✅ **Type Safety** - Full TypeScript support with generics
- ✅ **Test Fixtures** - Auto-injected GraphQL clients

### Quick Start

#### 1. Configure GraphQL Endpoint

Add to `.env.testing`:
```bash
GRAPHQL_ENDPOINT=https://api.example.com/graphql
```

#### 2. Write a Test

```typescript
import { apiTest as test } from '@api/ApiTest';

test('GraphQL query example', async ({ graphqlClient }) => {
  const response = await graphqlClient.queryWrapped(`
    query GetUsers {
      users {
        id
        name
        email
      }
    }
  `);

  await response.assertNoErrors();
  await response.assertHasData();
});
```

#### 3. Run Tests

```bash
npx playwright test tests/api/graphql-examples.spec.ts
```

### Documentation

| Document | Description |
|----------|-------------|
| [GraphQL Integration Guide](./GRAPHQL_INTEGRATION.md) | Comprehensive guide with examples |
| [Quick Start Guide](./GRAPHQL_QUICKSTART.md) | Get started in 5 minutes |
| [Implementation Summary](./GRAPHQL_IMPLEMENTATION_SUMMARY.md) | Technical details and architecture |
| [Example Tests](./tests/api/graphql-examples.spec.ts) | 20+ working examples |

### Key Components

#### GraphQLClient
Extends `ApiClient` with GraphQL-specific methods:
- `query()` - Execute GraphQL queries
- `mutate()` - Execute GraphQL mutations
- `subscribe()` - Handle subscriptions
- `introspect()` - Fetch schema information
- `queryWrapped()` / `mutateWrapped()` - Returns response wrapper

#### GraphQLResponseWrapper
Extends `ApiResponseWrapper` with GraphQL assertions:
- `assertNoErrors()` - Verify no GraphQL errors
- `assertDataField(path, value)` - Validate specific fields
- `assertDataHasFields(fields)` - Check field existence
- `getData()` - Extract typed data
- `getErrors()` - Get GraphQL errors

#### Test Fixtures
- `graphqlClient` - Auto-configured GraphQL client
- `createGraphQLClient(options)` - Factory for custom clients
- `graphqlURL` - GraphQL endpoint URL

### Example Tests

#### Simple Query
```typescript
test('simple query', async ({ graphqlClient }) => {
  const response = await graphqlClient.queryWrapped(`
    query {
      posts {
        id
        title
      }
    }
  `);

  await response.assertNoErrors();
  const posts = (await response.getData()).posts;
  expect(posts.length).toBeGreaterThan(0);
});
```

#### Query with Variables
```typescript
test('query with variables', async ({ graphqlClient }) => {
  const response = await graphqlClient.queryWrapped(
    `query GetUser($id: ID!) { user(id: $id) { id name } }`,
    { id: '123' }
  );

  await response.assertNoErrors();
  await response.assertDataField('user.id', '123');
});
```

#### Mutation
```typescript
test('create mutation', async ({ graphqlClient }) => {
  const response = await graphqlClient.mutateWrapped(
    `mutation CreatePost($input: CreatePostInput!) {
      createPost(input: $input) { id title }
    }`,
    { input: { title: 'New Post', content: 'Content' } }
  );

  await response.assertNoErrors();
  await response.assertDataField('createPost.title', 'New Post');
});
```

#### Authentication
```typescript
test('authenticated request', async ({ createGraphQLClient }) => {
  const client = await createGraphQLClient({
    authType: AuthType.BEARER,
    token: 'jwt-token'
  });

  const response = await client.queryWrapped(`{ me { id } }`);
  await response.assertNoErrors();
});
```

#### Error Handling
```typescript
test('handle GraphQL errors', async ({ graphqlClient }) => {
  const response = await graphqlClient.queryWrapped(`
    query { invalidField }
  `);

  await response.assertHasErrors();
  await response.assertErrorMessage('Cannot query field');
});
```

### Architecture

The GraphQL integration follows the same architectural patterns as REST API testing:

```
Test Layer (*.spec.ts)
    ↓
Fixture Layer (ApiTest.ts)
    ↓
Response Wrapper (GraphQLResponse.ts)
    ↓
Client Layer (GraphQLClient.ts)
    ↓
Base Layer (ApiClient.ts)
```

### Authentication Methods

| Method | Configuration | Example |
|--------|---------------|---------|
| **Bearer Token** | `authType: AuthType.BEARER, token: 'jwt'` | JWT authentication |
| **API Key** | `authType: AuthType.API_KEY, apiKey: 'key'` | Header-based API key |
| **Basic Auth** | `authType: AuthType.BASIC, username, password` | Username/password |
| **Custom Headers** | `extraHTTPHeaders: { 'X-Custom': 'value' }` | Any custom headers |

### Best Practices

1. **Always Check for Errors**
   ```typescript
   await response.assertNoErrors();
   ```

2. **Use Type Safety**
   ```typescript
   interface User { id: string; name: string; }
   const data = await response.getData<{ user: User }>();
   ```

3. **Validate Field Existence**
   ```typescript
   await response.assertDataHasFields(['user', 'posts']);
   ```

4. **Handle Authentication**
   ```typescript
   const client = await createGraphQLClient({
     authType: AuthType.BEARER,
     token: await getAuthToken()
   });
   ```

5. **Use Descriptive Queries**
   ```typescript
   const query = `
     query GetUserProfile($userId: ID!) {
       user(id: $userId) {
         id
         name
         email
       }
     }
   `;
   ```

### Advanced Features

#### Schema Introspection
```typescript
test('introspect schema', async ({ graphqlClient }) => {
  const response = await graphqlClient.introspect();
  const schema = await response.json();
  console.log('Types:', schema.data.__schema.types);
});
```

#### Request Batching
```typescript
test('batch queries', async ({ graphqlClient }) => {
  graphqlClient.queueRequest({ query: `{ user1: user(id: "1") { id } }` });
  graphqlClient.queueRequest({ query: `{ user2: user(id: "2") { id } }` });
  
  const response = await graphqlClient.executeBatch();
  const results = await response.json();
});
```

#### GraphQL Fragments
```typescript
const query = `
  fragment UserFields on User {
    id
    name
    email
  }
  
  query GetUsers {
    users {
      ...UserFields
    }
  }
`;
```

### Migration from REST

GraphQL integration is **fully backward compatible**. You can:
- Use REST and GraphQL in the same test
- Mix authentication methods
- Gradually migrate endpoints
- Keep existing REST tests unchanged

```typescript
test('hybrid REST + GraphQL', async ({ apiClient, graphqlClient }) => {
  // Login via REST
  const authResp = await apiClient.post('/auth/login', {
    data: { username: 'user', password: 'pass' }
  });
  const token = (await authResp.json()).token;

  // Query via GraphQL
  const client = await createGraphQLClient({
    authType: AuthType.BEARER,
    token
  });
  const response = await client.queryWrapped(`{ me { id } }`);
  await response.assertNoErrors();
});
```

### Troubleshooting

#### Connection Issues
```typescript
// Verify endpoint configuration
console.log('GraphQL URL:', process.env.GRAPHQL_ENDPOINT);

// Test basic connectivity
const response = await graphqlClient.query(`{ __typename }`);
expect(response.status()).toBe(200);
```

#### Authentication Failures
```typescript
// Debug authentication
const response = await graphqlClient.queryWrapped(`{ protectedData }`);
if (await response.hasErrors()) {
  const errors = await response.getErrorMessages();
  console.log('Auth errors:', errors);
}
```

#### Query Syntax Errors
```typescript
// Use multiline strings for clarity
const query = `
  query GetUser($id: ID!) {
    user(id: $id) {
      id
      name
    }
  }
`;

// Validate before sending
const response = await graphqlClient.queryWrapped(query, { id: '123' });
if (await response.hasErrors()) {
  console.log('Syntax errors:', await response.getErrorMessages());
}
```

### File Structure

```
src/api/
├── ApiClient.ts              # Base HTTP client
├── ApiResponse.ts            # Response wrapper base
├── ApiClientExt.ts           # Extended client
├── ApiTest.ts                # Test fixtures (includes GraphQL)
├── GraphQLClient.ts          # GraphQL client
└── GraphQLResponse.ts        # GraphQL response wrapper

tests/api/
└── graphql-examples.spec.ts  # Example tests
```

### Performance Considerations

- Use batching for multiple independent queries
- Monitor query complexity and depth
- Set appropriate timeouts for slow queries
- Consider response caching for repeated queries

### Security Features

- Multi-factor authentication support
- Input validation testing
- Rate limiting verification
- Field-level permission testing
- Query depth limiting checks

### Next Steps

1. Read the [Quick Start Guide](./GRAPHQL_QUICKSTART.md)
2. Review [Example Tests](./tests/api/graphql-examples.spec.ts)
3. Check [Full Documentation](./GRAPHQL_INTEGRATION.md)
4. Start writing your own GraphQL tests!

### Resources

- [Playwright API Testing](https://playwright.dev/docs/api-testing)
- [GraphQL Specification](https://spec.graphql.org/)
- [GraphQL Best Practices](https://graphql.org/learn/best-practices/)

---

**Status:** ✅ Production Ready  
**Version:** 1.0  
**Last Updated:** 2025
