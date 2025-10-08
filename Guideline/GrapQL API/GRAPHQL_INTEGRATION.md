# GraphQL API Integration Guide

This guide provides comprehensive instructions for using GraphQL API testing in your Playwright TypeScript framework.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Setup Instructions](#setup-instructions)
4. [Authentication Configuration](#authentication-configuration)
5. [Query Examples](#query-examples)
6. [Mutation Examples](#mutation-examples)
7. [Subscription Examples](#subscription-examples)
8. [Introspection Usage](#introspection-usage)
9. [Batching Requests](#batching-requests)
10. [Error Handling](#error-handling)
11. [Response Assertions](#response-assertions)
12. [Security Best Practices](#security-best-practices)
13. [Testing Strategies](#testing-strategies)
14. [Troubleshooting](#troubleshooting)
15. [Migration from REST](#migration-from-rest)

---

## Overview

The GraphQL integration extends the existing API testing framework to support GraphQL operations while maintaining architectural consistency with the REST API testing approach.

**Key Features:**
- ✅ Query, Mutation, and Subscription support
- ✅ Schema introspection
- ✅ Request batching
- ✅ Response wrapper with fluent assertions
- ✅ Multiple authentication methods
- ✅ Fixture-based dependency injection
- ✅ Automatic error parsing
- ✅ Type-safe responses

---

## Architecture

The GraphQL integration follows the same architectural pattern as the REST API framework:

```
┌─────────────────────────────────────────────────────────┐
│                    Test Layer                           │
│  (tests/*.spec.ts - uses fixtures and assertions)       │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────┐
│                  Fixture Layer                          │
│  (ApiTest.ts - dependency injection & lifecycle)        │
│  - graphqlClient fixture                                │
│  - createGraphQLClient factory                          │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────┐
│                Response Wrapper Layer                   │
│  (GraphQLResponse.ts - fluent assertions)               │
│  - assertNoErrors(), assertData(), assertErrorMessage() │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────┐
│                  Client Layer                           │
│  (GraphQLClient.ts - GraphQL operations)                │
│  - query(), mutate(), subscribe(), introspect()         │
│  - Request batching & error parsing                     │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────┐
│                   Base Layer                            │
│  (ApiClient.ts - HTTP & authentication)                 │
│  - Multi-auth support (Bearer, API Key, Basic)          │
│  - Context management                                   │
└─────────────────────────────────────────────────────────┘
```

---

## Setup Instructions

### 1. Environment Configuration

Add GraphQL endpoint to your `.env.testing` file:

```bash
# GraphQL Endpoint (optional - defaults to baseURL/graphql)
GRAPHQL_ENDPOINT=https://api.example.com/graphql
```

### 2. Import GraphQL Client in Tests

```typescript
import { apiTest as test } from '@api/ApiTest';
import { expect } from '@playwright/test';

test.describe('GraphQL Tests', () => {
  test('should query data', async ({ graphqlClient }) => {
    // graphqlClient is auto-injected via fixture
    const response = await graphqlClient.queryWrapped(`
      query GetUser($id: ID!) {
        user(id: $id) {
          id
          name
          email
        }
      }
    `, { id: '123' });

    await response.assertNoErrors();
    await response.assertData({ user: { id: '123' } });
  });
});
```

### 3. Create Custom GraphQL Client

```typescript
test('use custom GraphQL client', async ({ createGraphQLClient }) => {
  const client = await createGraphQLClient({
    baseURL: 'https://custom-api.com/graphql',
    authType: AuthType.BEARER,
    token: 'custom-token',
    timeout: 30000
  });

  const response = await client.queryWrapped(`{ __typename }`);
  await response.assertNoErrors();
});
```

---

## Authentication Configuration

### Bearer Token Authentication

```typescript
test('GraphQL with Bearer token', async ({ createGraphQLClient }) => {
  const client = await createGraphQLClient({
    authType: AuthType.BEARER,
    token: 'your-jwt-token'
  });

  const response = await client.queryWrapped(`
    query Me {
      me {
        id
        username
      }
    }
  `);

  await response.assertNoErrors();
});
```

### API Key Authentication

```typescript
test('GraphQL with API Key', async ({ createGraphQLClient }) => {
  const client = await createGraphQLClient({
    authType: AuthType.API_KEY,
    apiKey: 'your-api-key',
    apiKeyHeader: 'X-API-Key'
  });

  // API key will be sent in headers
  const response = await client.queryWrapped(`{ publicData }`);
  await response.assertNoErrors();
});
```

### Basic Authentication

```typescript
test('GraphQL with Basic Auth', async ({ createGraphQLClient }) => {
  const client = await createGraphQLClient({
    authType: AuthType.BASIC,
    username: 'admin',
    password: 'password123'
  });

  const response = await client.queryWrapped(`{ adminData }`);
  await response.assertNoErrors();
});
```

### Custom Headers

```typescript
test('GraphQL with custom headers', async ({ createGraphQLClient }) => {
  const client = await createGraphQLClient({
    extraHTTPHeaders: {
      'X-Custom-Header': 'value',
      'X-Request-ID': 'abc-123'
    }
  });

  const response = await client.queryWrapped(`{ data }`);
  await response.assertNoErrors();
});
```

---

## Query Examples

### Simple Query

```typescript
test('execute simple query', async ({ graphqlClient }) => {
  const response = await graphqlClient.queryWrapped(`
    query {
      posts {
        id
        title
      }
    }
  `);

  await response.assertNoErrors();
  await response.assertHasData();
  await response.assertDataField('posts', expect.arrayContaining([
    expect.objectContaining({ id: expect.any(String) })
  ]));
});
```

### Query with Variables

```typescript
test('query with variables', async ({ graphqlClient }) => {
  const response = await graphqlClient.queryWrapped(
    `
    query GetPost($id: ID!) {
      post(id: $id) {
        id
        title
        author {
          name
        }
      }
    }
    `,
    { id: '123' }
  );

  await response.assertNoErrors();
  await response.assertDataField('post.id', '123');
  await response.assertDataField('post.title', expect.any(String));
});
```

### Query with Operation Name

```typescript
test('query with operation name', async ({ graphqlClient }) => {
  const response = await graphqlClient.queryWrapped(
    `
    query GetUsers {
      users {
        id
        name
      }
    }
    query GetPosts {
      posts {
        id
        title
      }
    }
    `,
    {},
    'GetUsers' // Specify which operation to execute
  );

  await response.assertNoErrors();
  await response.assertDataHasFields(['users']);
});
```

### Nested Field Queries

```typescript
test('query nested fields', async ({ graphqlClient }) => {
  const response = await graphqlClient.queryWrapped(`
    query {
      user(id: "1") {
        id
        profile {
          bio
          avatar
        }
        posts {
          id
          comments {
            id
            text
          }
        }
      }
    }
  `);

  await response.assertNoErrors();
  await response.assertDataField('user.profile.bio', expect.any(String));
  await response.assertListSize('user.posts', expect.any(Number));
});
```

---

## Mutation Examples

### Create Mutation

```typescript
test('create user mutation', async ({ graphqlClient }) => {
  const response = await graphqlClient.mutateWrapped(
    `
    mutation CreateUser($input: CreateUserInput!) {
      createUser(input: $input) {
        id
        name
        email
      }
    }
    `,
    {
      input: {
        name: 'John Doe',
        email: 'john@example.com'
      }
    }
  );

  await response.assertNoErrors();
  await response.assertDataField('createUser.email', 'john@example.com');
  
  // Extract created ID for cleanup
  const data = await response.getData();
  const userId = data.createUser.id;
  console.log('Created user:', userId);
});
```

### Update Mutation

```typescript
test('update user mutation', async ({ graphqlClient }) => {
  const response = await graphqlClient.mutateWrapped(
    `
    mutation UpdateUser($id: ID!, $input: UpdateUserInput!) {
      updateUser(id: $id, input: $input) {
        id
        name
        email
        updatedAt
      }
    }
    `,
    {
      id: '123',
      input: {
        name: 'Jane Doe Updated'
      }
    }
  );

  await response.assertNoErrors();
  await response.assertDataField('updateUser.id', '123');
  await response.assertDataField('updateUser.name', 'Jane Doe Updated');
});
```

### Delete Mutation

```typescript
test('delete user mutation', async ({ graphqlClient }) => {
  const response = await graphqlClient.mutateWrapped(
    `
    mutation DeleteUser($id: ID!) {
      deleteUser(id: $id) {
        success
        message
      }
    }
    `,
    { id: '123' }
  );

  await response.assertNoErrors();
  await response.assertDataField('deleteUser.success', true);
});
```

### Multiple Mutations in Transaction

```typescript
test('multiple mutations', async ({ graphqlClient }) => {
  const response = await graphqlClient.mutateWrapped(
    `
    mutation CreatePostAndComment($postInput: CreatePostInput!, $commentInput: CreateCommentInput!) {
      createPost(input: $postInput) {
        id
        title
      }
      createComment(input: $commentInput) {
        id
        text
      }
    }
    `,
    {
      postInput: { title: 'New Post', content: 'Content here' },
      commentInput: { postId: '1', text: 'Great post!' }
    }
  );

  await response.assertNoErrors();
  await response.assertDataHasFields(['createPost', 'createComment']);
});
```

---

## Subscription Examples

### WebSocket Subscription

```typescript
test('subscribe to data changes', async ({ graphqlClient }) => {
  const subscriptionQuery = `
    subscription OnPostCreated {
      postCreated {
        id
        title
        author {
          name
        }
      }
    }
  `;

  const response = await graphqlClient.subscribe(subscriptionQuery);
  
  // Note: Subscription handling requires WebSocket support
  // This is a basic example - actual implementation depends on your backend
  await response.assertStatus(200);
});
```

---

## Introspection Usage

### Full Schema Introspection

```typescript
test('introspect GraphQL schema', async ({ graphqlClient }) => {
  const response = await graphqlClient.introspect();
  
  await response.assertStatus(200);
  const schema = await response.json();
  
  // Verify schema has types
  expect(schema.data.__schema.types).toBeDefined();
  expect(schema.data.__schema.queryType).toBeDefined();
  
  // Find specific type
  const userType = schema.data.__schema.types.find(
    (t: any) => t.name === 'User'
  );
  expect(userType).toBeDefined();
});
```

### Query Available Operations

```typescript
test('list available queries', async ({ graphqlClient }) => {
  const response = await graphqlClient.introspect();
  const schema = await response.json();
  
  const queryType = schema.data.__schema.types.find(
    (t: any) => t.name === schema.data.__schema.queryType.name
  );
  
  const queryFields = queryType.fields.map((f: any) => f.name);
  console.log('Available queries:', queryFields);
  
  expect(queryFields).toContain('user');
  expect(queryFields).toContain('posts');
});
```

---

## Batching Requests

### Queue Multiple Operations

```typescript
test('batch multiple queries', async ({ graphqlClient }) => {
  // Queue queries
  graphqlClient.queueRequest({
    query: `query { user(id: "1") { name } }`,
    operationName: 'GetUser1'
  });
  
  graphqlClient.queueRequest({
    query: `query { user(id: "2") { name } }`,
    operationName: 'GetUser2'
  });
  
  graphqlClient.queueRequest({
    query: `query { posts { id } }`,
    operationName: 'GetPosts'
  });
  
  // Execute all at once
  const response = await graphqlClient.executeBatch();
  
  await response.assertStatus(200);
  const results = await response.json();
  
  expect(results).toHaveLength(3);
  expect(results[0].data).toBeDefined();
  expect(results[1].data).toBeDefined();
  expect(results[2].data).toBeDefined();
});
```

---

## Error Handling

### Assert GraphQL Errors

```typescript
test('handle GraphQL errors', async ({ graphqlClient }) => {
  const response = await graphqlClient.queryWrapped(
    `
    query InvalidQuery {
      nonExistentField {
        id
      }
    }
    `
  );

  // Assert that errors exist
  await response.assertHasErrors();
  
  // Check specific error message
  await response.assertErrorMessage('Cannot query field "nonExistentField"');
  
  // Get all error messages
  const errors = await response.getErrorMessages();
  console.log('Errors:', errors);
});
```

### Validate Error Extensions

```typescript
test('check error extensions', async ({ graphqlClient }) => {
  const response = await graphqlClient.queryWrapped(
    `
    query UnauthorizedQuery {
      secretData {
        value
      }
    }
    `
  );

  await response.assertHasErrors();
  await response.assertErrorCode('UNAUTHENTICATED');
});
```

### Handle Partial Errors

```typescript
test('handle partial data with errors', async ({ graphqlClient }) => {
  const response = await graphqlClient.queryWrapped(
    `
    query {
      validField {
        id
      }
      invalidField {
        value
      }
    }
    `
  );

  // GraphQL can return both data and errors
  const hasErrors = await response.hasErrors();
  const data = await response.getData();
  
  if (hasErrors) {
    console.log('Partial response with errors');
    expect(data.validField).toBeDefined();
    expect(data.invalidField).toBeNull();
  }
});
```

---

## Response Assertions

### Comprehensive Assertion Examples

```typescript
test('various response assertions', async ({ graphqlClient }) => {
  const response = await graphqlClient.queryWrapped(
    `
    query GetUserProfile($userId: ID!) {
      user(id: $userId) {
        id
        username
        email
        posts {
          id
          title
          tags
        }
      }
    }
    `,
    { userId: '123' }
  );

  // Assert no errors
  await response.assertNoErrors();
  
  // Assert has data
  await response.assertHasData();
  
  // Assert specific data fields
  await response.assertDataField('user.id', '123');
  await response.assertDataField('user.username', expect.any(String));
  
  // Assert data contains fields
  await response.assertDataHasFields(['user']);
  
  // Assert nested field contains value
  await response.assertDataFieldContains('user.posts', 
    expect.objectContaining({ id: expect.any(String) })
  );
  
  // Assert list size
  await response.assertListSize('user.posts', expect.any(Number));
  
  // Extract and validate complex data
  const data = await response.getData();
  expect(data.user.posts).toBeInstanceOf(Array);
  expect(data.user.posts[0]).toHaveProperty('title');
});
```

### Snapshot Testing

```typescript
test('snapshot testing for GraphQL responses', async ({ graphqlClient }) => {
  const response = await graphqlClient.queryWrapped(`
    query {
      users(limit: 5) {
        id
        name
      }
    }
  `);

  await response.assertNoErrors();
  const data = await response.getData();
  
  // Compare with snapshot
  expect(data).toMatchSnapshot();
});
```

---

## Security Best Practices

### 1. Authentication & Authorization

```typescript
test('verify authentication required', async ({ createGraphQLClient }) => {
  // Client without auth
  const unauthClient = await createGraphQLClient({
    authType: AuthType.NONE
  });

  const response = await unauthClient.queryWrapped(`
    query { 
      protectedData { 
        value 
      } 
    }
  `);

  // Should return error
  await response.assertHasErrors();
  await response.assertErrorCode('UNAUTHENTICATED');
});
```

### 2. Input Validation

```typescript
test('validate malicious input is rejected', async ({ graphqlClient }) => {
  const response = await graphqlClient.mutateWrapped(
    `
    mutation CreateUser($input: CreateUserInput!) {
      createUser(input: $input) {
        id
      }
    }
    `,
    {
      input: {
        name: '<script>alert("xss")</script>',
        email: 'invalid-email'
      }
    }
  );

  // Should validate and reject
  await response.assertHasErrors();
  await response.assertErrorMessage('Invalid email format');
});
```

### 3. Rate Limiting

```typescript
test('verify rate limiting', async ({ graphqlClient }) => {
  const promises = [];
  
  // Send 100 requests rapidly
  for (let i = 0; i < 100; i++) {
    promises.push(
      graphqlClient.query(`query { ping }`)
    );
  }
  
  const responses = await Promise.all(promises);
  
  // Some requests should be rate limited
  const rateLimited = responses.filter(r => r.status() === 429);
  expect(rateLimited.length).toBeGreaterThan(0);
});
```

### 4. Query Depth Limiting

```typescript
test('verify query depth is limited', async ({ graphqlClient }) => {
  // Deeply nested query
  const response = await graphqlClient.queryWrapped(`
    query {
      user {
        posts {
          comments {
            author {
              posts {
                comments {
                  author {
                    id
                  }
                }
              }
            }
          }
        }
      }
    }
  `);

  // Should reject overly complex queries
  await response.assertHasErrors();
  await response.assertErrorMessage('Query depth exceeded');
});
```

### 5. Field-Level Authorization

```typescript
test('verify field-level permissions', async ({ graphqlClient }) => {
  const response = await graphqlClient.queryWrapped(`
    query {
      user(id: "123") {
        id
        email          # Public field
        internalNotes  # Admin-only field
      }
    }
  `);

  // Regular user should get error on restricted field
  await response.assertHasErrors();
  await response.assertErrorMessage('Not authorized to access internalNotes');
});
```

---

## Testing Strategies

### 1. Happy Path Testing

```typescript
test.describe('Happy Path Tests', () => {
  test('complete user workflow', async ({ graphqlClient }) => {
    // Create user
    const createResp = await graphqlClient.mutateWrapped(
      `mutation CreateUser($input: CreateUserInput!) {
        createUser(input: $input) { id name }
      }`,
      { input: { name: 'Test User', email: 'test@example.com' } }
    );
    await createResp.assertNoErrors();
    const userId = (await createResp.getData()).createUser.id;

    // Query user
    const getResp = await graphqlClient.queryWrapped(
      `query GetUser($id: ID!) { user(id: $id) { id name email } }`,
      { id: userId }
    );
    await getResp.assertNoErrors();
    await getResp.assertDataField('user.name', 'Test User');

    // Update user
    const updateResp = await graphqlClient.mutateWrapped(
      `mutation UpdateUser($id: ID!, $input: UpdateUserInput!) {
        updateUser(id: $id, input: $input) { id name }
      }`,
      { id: userId, input: { name: 'Updated Name' } }
    );
    await updateResp.assertNoErrors();

    // Delete user
    const deleteResp = await graphqlClient.mutateWrapped(
      `mutation DeleteUser($id: ID!) {
        deleteUser(id: $id) { success }
      }`,
      { id: userId }
    );
    await deleteResp.assertNoErrors();
  });
});
```

### 2. Error Case Testing

```typescript
test.describe('Error Cases', () => {
  test('invalid input validation', async ({ graphqlClient }) => {
    const response = await graphqlClient.mutateWrapped(
      `mutation CreateUser($input: CreateUserInput!) {
        createUser(input: $input) { id }
      }`,
      { input: { name: '', email: 'invalid' } }
    );

    await response.assertHasErrors();
    await response.assertErrorMessage('Validation failed');
  });

  test('resource not found', async ({ graphqlClient }) => {
    const response = await graphqlClient.queryWrapped(
      `query GetUser($id: ID!) { user(id: $id) { id } }`,
      { id: 'non-existent-id' }
    );

    await response.assertHasErrors();
    await response.assertErrorMessage('User not found');
  });
});
```

### 3. Performance Testing

```typescript
test.describe('Performance Tests', () => {
  test('query response time', async ({ graphqlClient }) => {
    const startTime = Date.now();
    
    const response = await graphqlClient.queryWrapped(`
      query {
        users(limit: 100) {
          id
          name
        }
      }
    `);
    
    const duration = Date.now() - startTime;
    
    await response.assertNoErrors();
    expect(duration).toBeLessThan(1000); // Should complete in < 1s
  });
});
```

### 4. Data-Driven Testing

```typescript
test.describe('Data-Driven Tests', () => {
  const testUsers = [
    { name: 'User 1', email: 'user1@test.com' },
    { name: 'User 2', email: 'user2@test.com' },
    { name: 'User 3', email: 'user3@test.com' }
  ];

  for (const userData of testUsers) {
    test(`create user: ${userData.name}`, async ({ graphqlClient }) => {
      const response = await graphqlClient.mutateWrapped(
        `mutation CreateUser($input: CreateUserInput!) {
          createUser(input: $input) { id name email }
        }`,
        { input: userData }
      );

      await response.assertNoErrors();
      await response.assertDataField('createUser.email', userData.email);
    });
  }
});
```

---

## Troubleshooting

### Issue 1: Connection Errors

**Problem:** Cannot connect to GraphQL endpoint

**Solution:**
```typescript
// Verify endpoint in .env file
console.log('GraphQL URL:', process.env.GRAPHQL_ENDPOINT);

// Test connectivity
test('verify GraphQL endpoint', async ({ graphqlClient }) => {
  const response = await graphqlClient.query(`{ __typename }`);
  expect(response.status()).toBe(200);
});
```

### Issue 2: Authentication Failures

**Problem:** 401/403 errors on authenticated requests

**Solution:**
```typescript
// Debug authentication headers
test('debug auth headers', async ({ createGraphQLClient }) => {
  const client = await createGraphQLClient({
    authType: AuthType.BEARER,
    token: 'your-token'
  });

  // Manually inspect request
  const context = await client.getContext();
  const response = await context.post('/graphql', {
    data: { query: '{ __typename }' }
  });
  
  console.log('Status:', response.status());
  console.log('Headers:', response.headers());
});
```

### Issue 3: GraphQL Parse Errors

**Problem:** Syntax errors in GraphQL queries

**Solution:**
```typescript
// Use multiline strings for readability
const query = `
  query GetUser($id: ID!) {
    user(id: $id) {
      id
      name
    }
  }
`;

// Validate query syntax before sending
test('validate query syntax', async ({ graphqlClient }) => {
  const response = await graphqlClient.queryWrapped(query, { id: '123' });
  
  if (await response.hasErrors()) {
    const errors = await response.getErrorMessages();
    console.log('Query errors:', errors);
  }
});
```

### Issue 4: Type Mismatches

**Problem:** Variables don't match schema types

**Solution:**
```typescript
// Ensure variable types match schema
test('type-safe variables', async ({ graphqlClient }) => {
  const response = await graphqlClient.mutateWrapped(
    `mutation CreatePost($input: CreatePostInput!) {
      createPost(input: $input) { id }
    }`,
    {
      input: {
        title: 'String type',
        publishedAt: '2025-01-01T00:00:00Z', // ISO date string
        viewCount: 0 // Number, not string
      }
    }
  );

  await response.assertNoErrors();
});
```

### Issue 5: Response Timeout

**Problem:** Long-running queries timeout

**Solution:**
```typescript
test('increase timeout for slow queries', async ({ createGraphQLClient }) => {
  const client = await createGraphQLClient({
    timeout: 60000 // 60 seconds
  });

  const response = await client.queryWrapped(`
    query SlowQuery {
      expensiveOperation {
        result
      }
    }
  `);

  await response.assertNoErrors();
});
```

---

## Migration from REST

### REST vs GraphQL Comparison

| Feature | REST API | GraphQL API |
|---------|----------|-------------|
| Client | `apiClient.get('/users/123')` | `graphqlClient.query('{ user(id: "123") { ... } }')` |
| Response | `await response.json()` | `await response.getData()` |
| Error Check | `response.status() === 200` | `await response.assertNoErrors()` |
| Data Validation | `response.assertJson({ id: '123' })` | `await response.assertDataField('user.id', '123')` |

### Migration Example

**Before (REST):**
```typescript
test('REST: get user', async ({ apiClient }) => {
  const response = await apiClient.get('/users/123');
  expect(response.status()).toBe(200);
  
  const data = await response.json();
  expect(data.id).toBe('123');
  expect(data.name).toBeDefined();
});
```

**After (GraphQL):**
```typescript
test('GraphQL: get user', async ({ graphqlClient }) => {
  const response = await graphqlClient.queryWrapped(
    `query GetUser($id: ID!) {
      user(id: $id) {
        id
        name
      }
    }`,
    { id: '123' }
  );

  await response.assertNoErrors();
  await response.assertDataField('user.id', '123');
  await response.assertDataHasFields(['user']);
});
```

### Hybrid Approach

You can use both REST and GraphQL in the same test:

```typescript
test('hybrid REST + GraphQL', async ({ apiClient, graphqlClient }) => {
  // Use REST for authentication
  const authResp = await apiClient.post('/auth/login', {
    data: { username: 'user', password: 'pass' }
  });
  const token = (await authResp.json()).token;

  // Use GraphQL for data queries with token
  const client = await createGraphQLClient({
    authType: AuthType.BEARER,
    token
  });

  const response = await client.queryWrapped(`{ me { id name } }`);
  await response.assertNoErrors();
});
```

---

## Advanced Examples

### Fragment Usage

```typescript
test('use GraphQL fragments', async ({ graphqlClient }) => {
  const response = await graphqlClient.queryWrapped(`
    fragment UserFields on User {
      id
      name
      email
    }
    
    query GetUsers {
      user1: user(id: "1") {
        ...UserFields
      }
      user2: user(id: "2") {
        ...UserFields
      }
    }
  `);

  await response.assertNoErrors();
  await response.assertDataHasFields(['user1', 'user2']);
});
```

### Aliases

```typescript
test('use query aliases', async ({ graphqlClient }) => {
  const response = await graphqlClient.queryWrapped(`
    query {
      admin: user(id: "1") {
        name
        role
      }
      moderator: user(id: "2") {
        name
        role
      }
    }
  `);

  await response.assertNoErrors();
  await response.assertDataField('admin.role', 'ADMIN');
  await response.assertDataField('moderator.role', 'MODERATOR');
});
```

### Directives

```typescript
test('use GraphQL directives', async ({ graphqlClient }) => {
  const includeEmail = true;

  const response = await graphqlClient.queryWrapped(
    `
    query GetUser($id: ID!, $includeEmail: Boolean!) {
      user(id: $id) {
        id
        name
        email @include(if: $includeEmail)
      }
    }
    `,
    { id: '123', includeEmail }
  );

  await response.assertNoErrors();
  
  if (includeEmail) {
    await response.assertDataHasFields(['user']);
    const data = await response.getData();
    expect(data.user.email).toBeDefined();
  }
});
```

---

## Conclusion

This GraphQL integration provides a comprehensive, type-safe, and testable way to interact with GraphQL APIs while maintaining consistency with your existing Playwright TypeScript framework.

**Key Takeaways:**
- ✅ Use `graphqlClient` fixture for automatic setup
- ✅ Use `queryWrapped()` / `mutateWrapped()` for fluent assertions
- ✅ Always check for errors with `assertNoErrors()`
- ✅ Leverage response wrapper methods for validation
- ✅ Follow security best practices for authentication
- ✅ Use batching for performance optimization
- ✅ Implement comprehensive error handling

For more information, refer to:
- [API Testing Documentation](./API_TESTING.md)
- [Playwright API Reference](https://playwright.dev/docs/api/class-apirequestcontext)
- [GraphQL Specification](https://spec.graphql.org/)
