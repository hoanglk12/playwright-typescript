# GraphQL Migration Guide

A practical guide for migrating your API tests from REST to GraphQL.

## Table of Contents

1. [Overview](#overview)
2. [Side-by-Side Comparison](#side-by-side-comparison)
3. [Migration Strategies](#migration-strategies)
4. [Step-by-Step Migration](#step-by-step-migration)
5. [Hybrid Approach](#hybrid-approach)
6. [Common Patterns](#common-patterns)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Overview

This guide helps you migrate from REST API testing to GraphQL API testing while maintaining test coverage and quality.

**Key Points:**
- ✅ GraphQL and REST can coexist
- ✅ No need to migrate everything at once
- ✅ Same fixtures and patterns
- ✅ Incremental migration path

---

## Side-by-Side Comparison

### Fetching a User

**REST API:**
```typescript
test('REST: get user', async ({ apiClient }) => {
  const response = await apiClient.get('/users/123');
  expect(response.status()).toBe(200);
  
  const user = await response.json();
  expect(user.id).toBe('123');
  expect(user.name).toBeDefined();
  expect(user.email).toBeDefined();
});
```

**GraphQL API:**
```typescript
test('GraphQL: get user', async ({ graphqlClient }) => {
  const response = await graphqlClient.queryWrapped(
    `query GetUser($id: ID!) {
      user(id: $id) {
        id
        name
        email
      }
    }`,
    { id: '123' }
  );
  
  await response.assertNoErrors();
  await response.assertDataField('user.id', '123');
  await response.assertDataHasFields(['user']);
});
```

### Creating a User

**REST API:**
```typescript
test('REST: create user', async ({ apiClient }) => {
  const response = await apiClient.post('/users', {
    data: {
      name: 'John Doe',
      email: 'john@example.com'
    }
  });
  
  expect(response.status()).toBe(201);
  const user = await response.json();
  expect(user.email).toBe('john@example.com');
});
```

**GraphQL API:**
```typescript
test('GraphQL: create user', async ({ graphqlClient }) => {
  const response = await graphqlClient.mutateWrapped(
    `mutation CreateUser($input: CreateUserInput!) {
      createUser(input: $input) {
        id
        name
        email
      }
    }`,
    {
      input: {
        name: 'John Doe',
        email: 'john@example.com'
      }
    }
  );
  
  await response.assertNoErrors();
  await response.assertDataField('createUser.email', 'john@example.com');
});
```

### Updating a User

**REST API:**
```typescript
test('REST: update user', async ({ apiClient }) => {
  const response = await apiClient.put('/users/123', {
    data: { name: 'Jane Doe' }
  });
  
  expect(response.status()).toBe(200);
  const user = await response.json();
  expect(user.name).toBe('Jane Doe');
});
```

**GraphQL API:**
```typescript
test('GraphQL: update user', async ({ graphqlClient }) => {
  const response = await graphqlClient.mutateWrapped(
    `mutation UpdateUser($id: ID!, $input: UpdateUserInput!) {
      updateUser(id: $id, input: $input) {
        id
        name
      }
    }`,
    { id: '123', input: { name: 'Jane Doe' } }
  );
  
  await response.assertNoErrors();
  await response.assertDataField('updateUser.name', 'Jane Doe');
});
```

### Deleting a User

**REST API:**
```typescript
test('REST: delete user', async ({ apiClient }) => {
  const response = await apiClient.delete('/users/123');
  expect(response.status()).toBe(204);
});
```

**GraphQL API:**
```typescript
test('GraphQL: delete user', async ({ graphqlClient }) => {
  const response = await graphqlClient.mutateWrapped(
    `mutation DeleteUser($id: ID!) {
      deleteUser(id: $id) {
        success
      }
    }`,
    { id: '123' }
  );
  
  await response.assertNoErrors();
  await response.assertDataField('deleteUser.success', true);
});
```

### Error Handling

**REST API:**
```typescript
test('REST: handle not found', async ({ apiClient }) => {
  const response = await apiClient.get('/users/999');
  expect(response.status()).toBe(404);
  
  const error = await response.json();
  expect(error.message).toContain('not found');
});
```

**GraphQL API:**
```typescript
test('GraphQL: handle not found', async ({ graphqlClient }) => {
  const response = await graphqlClient.queryWrapped(
    `query GetUser($id: ID!) { user(id: $id) { id } }`,
    { id: '999' }
  );
  
  // GraphQL might return errors or null data
  if (await response.hasErrors()) {
    await response.assertErrorMessage('not found');
  } else {
    const data = await response.getData();
    expect(data.user).toBeNull();
  }
});
```

---

## Migration Strategies

### Strategy 1: Big Bang Migration

Migrate all tests at once.

**Pros:**
- ✅ Clean break from REST
- ✅ Consistent codebase
- ✅ No hybrid complexity

**Cons:**
- ❌ High risk
- ❌ Large effort upfront
- ❌ All-or-nothing approach

**When to use:** Small test suites, new projects

### Strategy 2: Incremental Migration

Migrate one endpoint/feature at a time.

**Pros:**
- ✅ Low risk
- ✅ Gradual transition
- ✅ Easier to validate
- ✅ Can pause/resume

**Cons:**
- ❌ Temporary hybrid codebase
- ❌ Longer migration period

**When to use:** Large test suites, production systems ✅ **RECOMMENDED**

### Strategy 3: Parallel Testing

Keep both REST and GraphQL tests.

**Pros:**
- ✅ Maximum validation
- ✅ Easy rollback
- ✅ Confidence in migration

**Cons:**
- ❌ Double maintenance
- ❌ Longer test runs

**When to use:** Critical systems, validation phase

---

## Step-by-Step Migration

### Phase 1: Setup (Day 1)

1. **Configure GraphQL endpoint**
   ```bash
   # .env.testing
   GRAPHQL_ENDPOINT=https://api.example.com/graphql
   ```

2. **Verify connectivity**
   ```typescript
   test('verify GraphQL endpoint', async ({ graphqlClient }) => {
     const response = await graphqlClient.query(`{ __typename }`);
     expect(response.status()).toBe(200);
   });
   ```

### Phase 2: Identify Candidates (Day 2-3)

1. **List all REST tests**
   ```bash
   find tests/api -name "*.spec.ts" -type f
   ```

2. **Categorize by complexity**
   - Simple GET requests → Migrate first
   - CRUD operations → Migrate second
   - Complex workflows → Migrate last

3. **Identify dependencies**
   - Which tests depend on others?
   - Which share setup/teardown?

### Phase 3: Create GraphQL Equivalents (Week 1-2)

1. **Start with simple queries**
   ```typescript
   // Before (REST)
   test('get all users', async ({ apiClient }) => {
     const response = await apiClient.get('/users');
     expect(response.status()).toBe(200);
   });

   // After (GraphQL)
   test('get all users', async ({ graphqlClient }) => {
     const response = await graphqlClient.queryWrapped(`
       query { users { id name } }
     `);
     await response.assertNoErrors();
   });
   ```

2. **Add mutations**
   ```typescript
   // Migrate POST/PUT/DELETE to mutations
   ```

3. **Handle authentication**
   ```typescript
   // Ensure auth tokens work with GraphQL
   const client = await createGraphQLClient({
     authType: AuthType.BEARER,
     token: existingToken
   });
   ```

### Phase 4: Validation (Week 2-3)

1. **Run both test suites in parallel**
   ```bash
   # Run REST tests
   npx playwright test tests/api/rest/

   # Run GraphQL tests
   npx playwright test tests/api/graphql/
   ```

2. **Compare results**
   - Same assertions passing?
   - Same data returned?
   - Same error cases covered?

3. **Fix discrepancies**

### Phase 5: Cleanup (Week 3-4)

1. **Deprecate REST tests**
   ```typescript
   test.skip('OLD REST: get users', async ({ apiClient }) => {
     // Migrated to GraphQL - see graphql/users.spec.ts
   });
   ```

2. **Update documentation**

3. **Remove deprecated tests**
   ```bash
   git rm tests/api/rest/deprecated-*.spec.ts
   ```

---

## Hybrid Approach

You can use REST and GraphQL together!

### Example 1: REST Auth + GraphQL Queries

```typescript
test('login via REST, query via GraphQL', async ({ apiClient, createGraphQLClient }) => {
  // Login using existing REST endpoint
  const authResp = await apiClient.post('/auth/login', {
    data: { username: 'admin', password: 'pass123' }
  });
  
  const token = (await authResp.json()).token;
  
  // Use token with GraphQL
  const gqlClient = await createGraphQLClient({
    authType: AuthType.BEARER,
    token
  });
  
  const response = await gqlClient.queryWrapped(`
    query { me { id username roles } }
  `);
  
  await response.assertNoErrors();
});
```

### Example 2: GraphQL Query + REST File Upload

```typescript
test('GraphQL metadata, REST file upload', async ({ graphqlClient, apiClient }) => {
  // Get upload URL via GraphQL
  const metaResp = await graphqlClient.queryWrapped(`
    query { uploadUrl { url fields } }
  `);
  
  const uploadData = (await metaResp.getData()).uploadUrl;
  
  // Upload file via REST
  const uploadResp = await apiClient.post(uploadData.url, {
    multipart: {
      ...uploadData.fields,
      file: './test-file.pdf'
    }
  });
  
  expect(uploadResp.status()).toBe(200);
});
```

---

## Common Patterns

### Pattern 1: Pagination

**REST:**
```typescript
const response = await apiClient.get('/users?page=1&limit=20');
```

**GraphQL:**
```typescript
const response = await graphqlClient.queryWrapped(
  `query GetUsers($page: Int!, $limit: Int!) {
    users(page: $page, limit: $limit) {
      items { id name }
      totalCount
      pageInfo { hasNextPage }
    }
  }`,
  { page: 1, limit: 20 }
);
```

### Pattern 2: Filtering

**REST:**
```typescript
const response = await apiClient.get('/users?role=admin&status=active');
```

**GraphQL:**
```typescript
const response = await graphqlClient.queryWrapped(
  `query GetUsers($filter: UserFilter!) {
    users(filter: $filter) { id name }
  }`,
  { filter: { role: 'admin', status: 'active' } }
);
```

### Pattern 3: Nested Resources

**REST (Multiple Requests):**
```typescript
const userResp = await apiClient.get('/users/123');
const user = await userResp.json();

const postsResp = await apiClient.get(`/users/${user.id}/posts`);
const posts = await postsResp.json();
```

**GraphQL (Single Request):**
```typescript
const response = await graphqlClient.queryWrapped(`
  query GetUserWithPosts($id: ID!) {
    user(id: $id) {
      id
      name
      posts {
        id
        title
      }
    }
  }`,
  { id: '123' }
);
```

---

## Best Practices

### 1. Keep Tests Isolated

```typescript
// ❌ Don't do this
test('create, update, delete user', async ({ graphqlClient }) => {
  // Too many operations in one test
});

// ✅ Do this
test('create user', async ({ graphqlClient }) => { /* ... */ });
test('update user', async ({ graphqlClient }) => { /* ... */ });
test('delete user', async ({ graphqlClient }) => { /* ... */ });
```

### 2. Use Meaningful Operation Names

```typescript
// ❌ Anonymous queries
const response = await graphqlClient.query(`{ users { id } }`);

// ✅ Named operations
const response = await graphqlClient.query(
  `query GetAllUsers { users { id } }`
);
```

### 3. Validate Both Success and Error Cases

```typescript
test('valid input', async ({ graphqlClient }) => {
  const response = await graphqlClient.mutateWrapped(/* ... */);
  await response.assertNoErrors();
});

test('invalid input', async ({ graphqlClient }) => {
  const response = await graphqlClient.mutateWrapped(/* ... */);
  await response.assertHasErrors();
  await response.assertErrorMessage('Validation failed');
});
```

### 4. Use TypeScript for Type Safety

```typescript
interface User {
  id: string;
  name: string;
  email: string;
}

interface GetUserResponse {
  user: User;
}

const data = await response.getData<GetUserResponse>();
const user: User = data.user;
```

---

## Troubleshooting

### Issue: Different Error Formats

**Problem:** REST returns 404, GraphQL returns errors array

**Solution:**
```typescript
test('handle not found - REST', async ({ apiClient }) => {
  const response = await apiClient.get('/users/999');
  expect(response.status()).toBe(404);
});

test('handle not found - GraphQL', async ({ graphqlClient }) => {
  const response = await graphqlClient.queryWrapped(
    `query { user(id: "999") { id } }`
  );
  
  // Check both patterns
  const hasErrors = await response.hasErrors();
  const data = await response.getData();
  
  expect(hasErrors || data.user === null).toBe(true);
});
```

### Issue: Authentication Token Format

**Problem:** REST uses API key, GraphQL needs Bearer token

**Solution:**
```typescript
test('convert API key to Bearer', async ({ apiClient, createGraphQLClient }) => {
  // Get Bearer token using API key
  const authResp = await apiClient.post('/auth/exchange', {
    headers: { 'X-API-Key': 'my-api-key' }
  });
  
  const bearerToken = (await authResp.json()).token;
  
  // Use Bearer token with GraphQL
  const gqlClient = await createGraphQLClient({
    authType: AuthType.BEARER,
    token: bearerToken
  });
});
```

### Issue: Missing Fields in GraphQL

**Problem:** GraphQL requires explicit field selection

**Solution:**
```typescript
// ❌ REST returns all fields automatically
const restResp = await apiClient.get('/users/123');
const user = await restResp.json();
// user has all fields

// ✅ GraphQL requires explicit selection
const gqlResp = await graphqlClient.queryWrapped(`
  query GetUser($id: ID!) {
    user(id: $id) {
      # List all needed fields
      id
      name
      email
      createdAt
      updatedAt
      # ... etc
    }
  }`,
  { id: '123' }
);
```

---

## Migration Checklist

- [ ] Configure GraphQL endpoint in `.env.testing`
- [ ] Verify GraphQL connectivity
- [ ] List all REST API tests
- [ ] Categorize tests by complexity
- [ ] Create GraphQL test directory structure
- [ ] Migrate simple GET requests
- [ ] Migrate POST/PUT/DELETE to mutations
- [ ] Test authentication with GraphQL
- [ ] Validate error handling
- [ ] Run both test suites in parallel
- [ ] Compare results
- [ ] Fix discrepancies
- [ ] Update documentation
- [ ] Deprecate REST tests
- [ ] Remove deprecated tests
- [ ] Celebrate! 🎉

---

## Timeline Example

**Small Project (< 50 tests):**
- Week 1: Setup + Simple queries
- Week 2: Mutations + Validation
- Week 3: Cleanup
- **Total: 3 weeks**

**Medium Project (50-200 tests):**
- Week 1-2: Setup + Simple queries
- Week 3-4: Mutations
- Week 5-6: Complex workflows
- Week 7-8: Validation + Cleanup
- **Total: 2 months**

**Large Project (200+ tests):**
- Month 1: Planning + Setup
- Month 2-4: Incremental migration
- Month 5-6: Validation
- Month 7: Cleanup
- **Total: 6-7 months**

---

## Next Steps

1. ✅ Read [GraphQL Integration Guide](./GRAPHQL_INTEGRATION.md)
2. ✅ Review [Example Tests](./tests/api/graphql-examples.spec.ts)
3. ✅ Try [Quick Start Guide](./GRAPHQL_QUICKSTART.md)
4. ✅ Start migrating your first test!

---

**Need Help?** Check the troubleshooting section in `GRAPHQL_INTEGRATION.md` or review example tests.

**Good luck with your migration! 🚀**
