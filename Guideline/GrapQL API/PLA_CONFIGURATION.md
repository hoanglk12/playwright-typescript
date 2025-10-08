# PLA GraphQL API Configuration

## Environment-Based Configuration

The PLA GraphQL API tests use a flexible environment-based configuration that separates the base URL and endpoint path for better maintainability.

### Configuration Structure

**File: `src/api/config/environment.ts`**

```typescript
export interface ApiEnvironment {
  apiBaseUrl: string;           // REST API base URL
  restfulApiBaseUrl: string;    // Restful device API base URL
  graphqlBaseUrl: string;       // GraphQL base URL (without /graphql)
  graphqlEndpoint: string;      // GraphQL endpoint path (e.g., /graphql)
  timeout: number;
  retries: number;
}

export function getApiEnvironment(): ApiEnvironment {
  return {
    apiBaseUrl: process.env.API_BASE_URL || 'https://restful-booker.herokuapp.com',
    restfulApiBaseUrl: process.env.RESTFUL_API_BASE_URL || 'https://api.restful-api.dev',
    graphqlBaseUrl: process.env.GRAPHQL_BASE_URL || 'https://stag-platypus-au.accentgra.com',
    graphqlEndpoint: process.env.GRAPHQL_ENDPOINT || '/graphql',
    timeout: parseInt(process.env.API_TIMEOUT || (isCI ? '60000' : '30000')),
    retries: parseInt(process.env.API_RETRIES || (isCI ? '2' : '0')),
  };
}
```

### How It Works

The final GraphQL URL is constructed by combining `graphqlBaseUrl + graphqlEndpoint`:

**Default Configuration:**
- `graphqlBaseUrl`: `https://stag-platypus-au.accentgra.com`
- `graphqlEndpoint`: `/graphql`
- **Result**: `https://stag-platypus-au.accentgra.com/graphql`

### Usage in Tests

Tests don't need to specify any URL - it's handled automatically:

```typescript
test('PLA_CreateAccount', async ({ createGraphQLClient }) => {
  // No baseURL needed - uses environment configuration
  const graphqlClient = await createGraphQLClient();
  
  // Execute queries/mutations...
});

test('PLA_GetCustomerDetails', async ({ createGraphQLClient }) => {
  // With authentication
  const authClient = await createGraphQLClient({
    authType: 'bearer' as any,
    token: customerToken
  });
  
  // Execute authenticated queries...
});
```

## Environment Variables

### Development (Staging)
Default configuration - no environment variables needed:
```bash
npx playwright test tests/api/pla-account-management.spec.ts --config=api.config.ts
```
Uses: `https://stag-platypus-au.accentgra.com/graphql`

### Production
Override via environment variables:
```bash
GRAPHQL_BASE_URL=https://platypus-au.accentgra.com npx playwright test tests/api/pla-account-management.spec.ts --config=api.config.ts
```
Uses: `https://platypus-au.accentgra.com/graphql`

### Custom Endpoint
Override the endpoint path (rare):
```bash
GRAPHQL_ENDPOINT=/api/graphql npx playwright test tests/api/pla-account-management.spec.ts --config=api.config.ts
```
Uses: `https://stag-platypus-au.accentgra.com/api/graphql`

### Complete Override
Both base URL and endpoint:
```bash
GRAPHQL_BASE_URL=https://dev-platypus-au.accentgra.com GRAPHQL_ENDPOINT=/v2/graphql npx playwright test tests/api/pla-account-management.spec.ts --config=api.config.ts
```
Uses: `https://dev-platypus-au.accentgra.com/v2/graphql`

## Using .env Files

### .env.development
```bash
GRAPHQL_BASE_URL=https://dev-platypus-au.accentgra.com
GRAPHQL_ENDPOINT=/graphql
API_TIMEOUT=30000
API_RETRIES=0
```

### .env.staging
```bash
GRAPHQL_BASE_URL=https://stag-platypus-au.accentgra.com
GRAPHQL_ENDPOINT=/graphql
API_TIMEOUT=45000
API_RETRIES=1
```

### .env.production
```bash
GRAPHQL_BASE_URL=https://platypus-au.accentgra.com
GRAPHQL_ENDPOINT=/graphql
API_TIMEOUT=60000
API_RETRIES=2
```

**Run with specific environment:**
```bash
NODE_ENV=production npx playwright test tests/api/pla-account-management.spec.ts --config=api.config.ts
```

## Benefits of This Approach

### 1. Separation of Concerns
- **Base URL**: Server/domain (changes per environment)
- **Endpoint**: API path (usually consistent across environments)

### 2. Flexibility
```bash
# Easy to test against different environments
GRAPHQL_BASE_URL=https://qa-platypus-au.accentgra.com npm test

# Easy to test different API versions
GRAPHQL_ENDPOINT=/v2/graphql npm test
```

### 3. No Hardcoding
Tests are environment-agnostic:
```typescript
// ✅ Good - Uses environment config
const client = await createGraphQLClient();

// ❌ Bad - Hardcoded URL
const client = await createGraphQLClient({
  baseURL: 'https://stag-platypus-au.accentgra.com/graphql'
});
```

### 4. CI/CD Ready
Different pipelines can use different configs without code changes:
```yaml
# Azure Pipelines example
- task: Npm@1
  inputs:
    command: 'custom'
    customCommand: 'run test:api'
  env:
    GRAPHQL_BASE_URL: $(GRAPHQL_BASE_URL)
    GRAPHQL_ENDPOINT: '/graphql'
```

## Test Files Structure

```
tests/api/
├── pla-account-management.spec.ts    # ✅ No hardcoded URLs
├── graphql-tests.spec.ts             # ✅ Uses environment config
└── ...
```

## Example Test Output

```bash
🚀 Starting API test global setup...
API Base URL: https://restful-booker.herokuapp.com
Mode: Serial execution (no parallel)
Browser: None (pure API testing)
✅ API test global setup completed

Running 3 tests using 1 worker

✓ PLA_CreateAccount - Creates customer ID: 578367
✓ PLA_SignIn - Generates JWT token
✓ PLA_GetCustomerDetails - Retrieves customer details
  ID: 578367
  Name: Hoang PLA1
  Email: platest1759937059738@mail.com
  Subscribed: false
  Loyalty Status: false

3 passed (4.4s)
```

## Summary

- **Clean Tests**: No hardcoded URLs in test files
- **Flexible Configuration**: Easy to switch environments
- **Modular Design**: Separate base URL and endpoint
- **Environment Variables**: Full control via env vars or .env files
- **CI/CD Friendly**: Easy to integrate with pipelines
- **Type-Safe**: TypeScript interfaces ensure correct usage
