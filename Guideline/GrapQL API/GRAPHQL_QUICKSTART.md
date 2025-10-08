# GraphQL Quick Start Guide

Get started with GraphQL API testing in under 5 minutes!

## Step 1: Configure Your GraphQL Endpoint

Create or update `.env.testing`:

```bash
# Optional - defaults to ${API_BASE_URL}/graphql
GRAPHQL_ENDPOINT=https://api.yourapp.com/graphql
```

## Step 2: Create Your First GraphQL Test

Create `tests/api/my-first-graphql-test.spec.ts`:

```typescript
import { apiTest as test } from '../../src/api/ApiTest';

test.describe('My First GraphQL Tests', () => {
  
  test('should query users', async ({ graphqlClient }) => {
    const response = await graphqlClient.queryWrapped(`
      query {
        users {
          id
          name
          email
        }
      }
    `);

    await response.assertNoErrors();
    await response.assertHasData();
    
    const data = await response.getData();
    console.log('Users:', data.users);
  });

  test('should create a user', async ({ graphqlClient }) => {
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
  });
});
```

## Step 3: Run Your Tests

```bash
# Run all GraphQL tests
npx playwright test tests/api/my-first-graphql-test.spec.ts

# Run with UI mode
npx playwright test tests/api/my-first-graphql-test.spec.ts --ui

# Run in debug mode
npx playwright test tests/api/my-first-graphql-test.spec.ts --debug
```

## Common Patterns

### Query with Variables

```typescript
test('query with variables', async ({ graphqlClient }) => {
  const response = await graphqlClient.queryWrapped(
    `
    query GetUser($id: ID!) {
      user(id: $id) {
        id
        name
      }
    }
    `,
    { id: '123' }
  );

  await response.assertNoErrors();
  await response.assertDataField('user.id', '123');
});
```

### Authentication

```typescript
test('authenticated query', async ({ createGraphQLClient }) => {
  const client = await createGraphQLClient({
    authType: AuthType.BEARER,
    token: 'your-jwt-token'
  });

  const response = await client.queryWrapped(`
    query {
      me {
        id
        username
      }
    }
  `);

  await response.assertNoErrors();
});
```

### Error Handling

```typescript
test('handle errors', async ({ graphqlClient }) => {
  const response = await graphqlClient.queryWrapped(`
    query {
      nonExistentField
    }
  `);

  await response.assertHasErrors();
  const errors = await response.getErrorMessages();
  console.log('Errors:', errors);
});
```

## Next Steps

- 📖 Read full documentation: `GRAPHQL_INTEGRATION.md`
- 📝 View examples: `tests/api/graphql-examples.spec.ts`
- 📋 Check implementation summary: `GRAPHQL_IMPLEMENTATION_SUMMARY.md`

## Quick Reference

### Available Fixtures

- `graphqlClient` - Auto-configured GraphQL client
- `createGraphQLClient(options)` - Create custom client
- `graphqlURL` - GraphQL endpoint URL

### Common Assertions

```typescript
await response.assertNoErrors();
await response.assertHasErrors();
await response.assertHasData();
await response.assertDataField('user.id', '123');
await response.assertDataHasFields(['user', 'posts']);
await response.assertErrorMessage('Validation failed');
```

### Data Extraction

```typescript
const data = await response.getData();
const errors = await response.getErrors();
const errorMessages = await response.getErrorMessages();
const fields = await response.getDataFields();
```

## Need Help?

See troubleshooting section in `GRAPHQL_INTEGRATION.md` or check example tests in `tests/api/graphql-examples.spec.ts`.

Happy testing! 🚀
