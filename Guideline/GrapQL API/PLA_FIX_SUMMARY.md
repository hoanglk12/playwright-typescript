# PLA GetCustomerDetails Test Fix Summary

## Problem
Test 3 (PLA_GetCustomerDetails) was failing with authentication error: "The current customer isn't authorized."

## Root Cause
The issue was **NOT** about using the wrong token (customerId vs customerToken). The token was correct all along.

The real issue was **how the token was being sent**:
- We were using `customHeaders: { 'Authorization': 'Bearer ${token}' }` 
- BUT the ApiClient only applies `customHeaders` when `authType === AuthType.CUSTOM`
- Since we didn't set `authType`, the Authorization header was **never added** to the request!

## Solution
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
  baseURL: 'https://stag-platypus-au.accentgra.com/graphql',
  authType: 'bearer' as any, // ✅ Use built-in Bearer auth
  token: customerToken // ✅ Token properly applied
});
```

## Additional Fix
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
✅ All 3 tests passing:
- PLA_CreateAccount - Creates customer ID 578352
- PLA_SignIn - Generates JWT token
- PLA_GetCustomerDetails - Retrieves customer details successfully

## Lessons Learned
1. **Always check authentication configuration** - Not just the token value, but HOW it's being applied
2. **Use framework's built-in auth methods** when available rather than custom headers
3. **API type mismatches** can cause subtle failures (Number vs String)
4. The user's intuition about "variable type" was correct - just not in the way initially expected!
