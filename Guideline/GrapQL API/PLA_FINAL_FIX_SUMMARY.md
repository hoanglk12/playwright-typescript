# PLA API Tests - Complete Fix Summary

## Problem
Test 3 (PLA_GetCustomerDetails) was failing with authentication error: "The current customer isn't authorized."

## Root Cause
The issue was **NOT** about using the wrong token (customerId vs customerToken). The token was correct all along.

The real issue was **how the token was being sent**:
- We were using `customHeaders: { 'Authorization': 'Bearer ${token}' }` 
- BUT the ApiClient only applies `customHeaders` when `authType === AuthType.CUSTOM`
- Since we didn't set `authType`, the Authorization header was **never added** to the request!

## Solutions Implemented

### 1. Fixed Authentication Method
Changed from:
```typescript
const authClient = await createGraphQLClient({
  baseURL: 'https://stag-platypus-au.accentgra.com/graphql',
  customHeaders: {
    'Authorization': `Bearer ${customerToken}` // ❌ Never applied!
  }
});
```

To:
```typescript
const authClient = await createGraphQLClient({
  authType: 'bearer' as any, // ✅ Use built-in Bearer auth
  token: customerToken // ✅ Token properly applied
});
```

### 2. Environment-Based Configuration
Removed hardcoded URLs and now using environment configuration:

**Before:**
```typescript
const graphqlClient = await createGraphQLClient({
  baseURL: 'https://stag-platypus-au.accentgra.com/graphql' // ❌ Hardcoded
});
```

**After:**
```typescript
const graphqlClient = await createGraphQLClient(); // ✅ Uses graphqlApiBaseUrl from environment
```

**Configuration in `src/api/config/environment.ts`:**
```typescript
export interface ApiEnvironment {
  apiBaseUrl: string;
  restfulApiBaseUrl: string;
  graphqlApiBaseUrl: string; // ✅ Added for PLA GraphQL API
  timeout: number;
  retries: number;
}

export function getApiEnvironment(): ApiEnvironment {
  return {
    apiBaseUrl: process.env.API_BASE_URL || 'https://restful-booker.herokuapp.com',
    restfulApiBaseUrl: process.env.RESTFUL_API_BASE_URL || 'https://api.restful-api.dev',
    graphqlApiBaseUrl: process.env.GRAPHQL_API_URL || 'https://stag-platypus-au.accentgra.com/graphql',
    timeout: parseInt(process.env.API_TIMEOUT || (isCI ? '60000' : '30000')),
    retries: parseInt(process.env.API_RETRIES || (isCI ? '2' : '0')),
  };
}
```

**Updated `src/api/ApiTest.ts` fixture:**
```typescript
graphqlURL: async ({}, use) => {
  const apiEnv = getApiEnvironment();
  // Use graphqlApiBaseUrl from environment configuration
  await use(apiEnv.graphqlApiBaseUrl);
},
```

Benefits:
- ✅ Easier to switch between environments (dev, staging, production)
- ✅ No hardcoded URLs in test files
- ✅ Centralized configuration management
- ✅ Can be overridden via environment variables: `GRAPHQL_API_URL=https://prod-platypus-au.accentgra.com/graphql`

### 3. Fixed Data Type Assertion
The PLA API returns `customer.id` as a **Number**, not a String:
```typescript
// Changed from:
await response.assertDataField('customer.id', expect.any(String)); // ❌

// To:
await response.assertDataField('customer.id', expect.any(Number)); // ✅
```

## Verification
Postman collection shows that `PLA_GetCustomerDetails` uses native Bearer authentication:
```json
"auth": {
  "type": "bearer",
  "bearer": [{
    "key": "token",
    "value": "{{customerToken}}",
    "type": "string"
  }]
}
```

Our implementation now matches this exactly.

## Test Results
✅ All 3 tests passing consistently:
- **PLA_CreateAccount** - Creates customer account with unique email
- **PLA_SignIn** - Generates JWT token for authentication
- **PLA_GetCustomerDetails** - Retrieves customer details successfully

Example output:
```
✓ PLA_CreateAccount - Creates customer ID: 578361
✓ PLA_SignIn - Generates JWT token
✓ PLA_GetCustomerDetails - Retrieves customer details
  ID: 578361
  Name: Hoang PLA1
  Email: platest1759936786532@mail.com
  Subscribed: false
  Loyalty Status: false

3 passed (4.8s)
```

## Environment Configuration Usage

### Development (default)
```bash
npx playwright test tests/api/pla-account-management.spec.ts --config=api.config.ts
# Uses: https://stag-platypus-au.accentgra.com/graphql
```

### Production
```bash
GRAPHQL_API_URL=https://prod-platypus-au.accentgra.com/graphql npx playwright test tests/api/pla-account-management.spec.ts --config=api.config.ts
```

### Using .env file
Create `.env.production`:
```
GRAPHQL_API_URL=https://prod-platypus-au.accentgra.com/graphql
API_TIMEOUT=60000
API_RETRIES=2
```

Run with:
```bash
NODE_ENV=production npx playwright test tests/api/pla-account-management.spec.ts --config=api.config.ts
```

## Lessons Learned
1. **Always check authentication configuration** - Not just the token value, but HOW it's being applied
2. **Use framework's built-in auth methods** when available rather than custom headers
3. **API type mismatches** can cause subtle failures (Number vs String)
4. **Environment-based configuration** is better than hardcoded URLs for maintainability
5. The user's intuition about "variable type" was correct - it led us to discover both the auth type and data type issues!

## Files Modified
1. `tests/api/pla-account-management.spec.ts` - Fixed auth method, removed hardcoded URLs
2. `src/api/config/environment.ts` - Added `graphqlApiBaseUrl` configuration
3. `src/api/ApiTest.ts` - Updated `graphqlURL` fixture to use environment config
