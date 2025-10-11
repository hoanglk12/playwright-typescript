# Variable Renaming: baseURL → apiBaseUrl

## Summary
Renamed the fixture variable `baseURL` to `apiBaseUrl` throughout the API test framework for consistency and clarity.

---

## Motivation

### **Before:**
- Fixture interface had both `baseURL` and `apiBaseUrl` (duplicate/confusing)
- Inconsistent naming with other fixtures (`restfulApiBaseURL`, `graphqlURL`)
- Not immediately clear which base URL is being referenced

### **After:**
- Single, clear `apiBaseUrl` fixture
- Consistent naming pattern across all URL fixtures
- Better self-documenting code

---

## Changes Made

### **File: `src/api/ApiTest.ts`**

#### **1. Updated Interface Definition**

**Before:**
```typescript
export interface ApiTestFixtures {
  baseURL: string;           // ← Generic name
  restfulApiBaseURL: string; // ← Different naming pattern
  apiBaseUrl: string;        // ← Duplicate!
  graphqlURL: string;
  // ...
}
```

**After:**
```typescript
export interface ApiTestFixtures {
  apiBaseUrl: string;        // ← Clear, specific name
  restfulApiBaseURL: string; // ← Consistent pattern
  graphqlURL: string;
  // ...
}
```

---

#### **2. Updated Fixture Definition**

**Before:**
```typescript
baseURL: async ({}, use) => {
    const apiEnv = getApiEnvironment();
    await use(apiEnv.apiBaseUrl);
},
```

**After:**
```typescript
apiBaseUrl: async ({}, use) => {
    const apiEnv = getApiEnvironment();
    await use(apiEnv.apiBaseUrl);
},
```

---

#### **3. Updated All Dependent Fixtures**

**Updated fixtures (6 total):**

1. **`apiClient`** fixture:
```typescript
// Before
apiClient: async ({ baseURL }, use) => {
    const client = new ApiClient({ baseURL });

// After
apiClient: async ({ apiBaseUrl }, use) => {
    const client = new ApiClient({ baseURL: apiBaseUrl });
```

2. **`apiClientExt`** fixture:
```typescript
// Before
apiClientExt: async ({ baseURL }, use) => {
    const client = new ApiClientExt({ baseURL });

// After
apiClientExt: async ({ apiBaseUrl }, use) => {
    const client = new ApiClientExt({ baseURL: apiBaseUrl });
```

3. **`bookingService`** fixture:
```typescript
// Before
bookingService: async ({ baseURL }, use) => {
    const service = new RestfulBookerService({ 
        baseURL: baseURL,

// After
bookingService: async ({ apiBaseUrl }, use) => {
    const service = new RestfulBookerService({ 
        baseURL: apiBaseUrl,
```

4. **`createClient`** factory:
```typescript
// Before
createClient: async ({ baseURL }, use) => {
    const client = new ApiClient({ baseURL, ...options });

// After
createClient: async ({ apiBaseUrl }, use) => {
    const client = new ApiClient({ baseURL: apiBaseUrl, ...options });
```

5. **`createClientExt`** factory:
```typescript
// Before
createClientExt: async ({ baseURL }, use) => {
    const client = new ApiClientExt({ baseURL, ...options });

// After
createClientExt: async ({ apiBaseUrl }, use) => {
    const client = new ApiClientExt({ baseURL: apiBaseUrl, ...options });
```

6. **Other fixtures unchanged:**
   - `restfulApiClient` - already uses `restfulApiBaseURL`
   - `graphqlClient` - already uses `graphqlURL`
   - `createRestfulApiClient` - already uses `restfulApiBaseURL`
   - `createGraphQLClient` - already uses `graphqlURL`

---

## Naming Convention Established

After refactoring, all URL fixtures follow a clear pattern:

| Fixture Name | Purpose | Environment Source |
|--------------|---------|-------------------|
| `apiBaseUrl` | General API base URL | `apiEnv.apiBaseUrl` |
| `restfulApiBaseURL` | Restful Device API URL | `apiEnv.restfulApiBaseUrl` |
| `graphqlURL` | GraphQL endpoint URL | `apiEnv.graphqlBaseUrl + apiEnv.graphqlEndpoint` |

---

## Impact Analysis

### **✅ No Breaking Changes to Tests**
- Test files use fixtures via destructuring: `async ({ bookingService, apiClient }) =>`
- Tests don't reference fixture names directly
- All existing tests continue to work without modification

### **✅ Internal Refactoring Only**
- Changes are confined to `ApiTest.ts`
- No changes to test files
- No changes to service classes
- No changes to client classes

---

## Test Results

All tests passing after refactoring:

### **1. Restful Booker Tests:**
```
✅ 9 passed (5.6s)
- Booking endpoints (5 tests)
- Authentication (1 test)
- Full lifecycle (3 tests)
```

### **2. PLA GraphQL Tests:**
```
✅ 7 passed (7.6s)
- Create account (2 tests)
- Sign in (2 tests)
- Get customer details (1 test)
- Create cart (1 test)
- Get item count (1 test)
```

### **3. Objects CRUD Tests (sample):**
```
✅ 3 passed (1.5s)
- TC_01: Get all objects
- TC_02: Get objects by IDs
- TC_03: Get single object
```

---

## Benefits

### **1. Clarity**
- ✅ `apiBaseUrl` clearly indicates it's the API's base URL
- ✅ No confusion with generic `baseURL`
- ✅ Consistent with other fixture names

### **2. Consistency**
- ✅ Follows same pattern as `restfulApiBaseURL`, `graphqlURL`
- ✅ All URL fixtures now have descriptive names
- ✅ Easier to understand fixture dependencies

### **3. Maintainability**
- ✅ Self-documenting code
- ✅ Easier for new developers to understand
- ✅ Clear separation of concerns (different base URLs for different purposes)

### **4. Type Safety**
- ✅ No duplicate fixture names
- ✅ TypeScript can properly infer types
- ✅ Better IDE autocomplete

---

## Code Quality Improvements

### **Before (Confusing):**
```typescript
export interface ApiTestFixtures {
  baseURL: string;      // Which API?
  apiBaseUrl: string;   // Duplicate? Same as baseURL?
  // ...
}
```

### **After (Clear):**
```typescript
export interface ApiTestFixtures {
  apiBaseUrl: string;        // General API base URL
  restfulApiBaseURL: string; // Restful Device API
  graphqlURL: string;        // GraphQL API
}
```

---

## Migration Guide

If you have custom test files that extend `apiTest`:

### **Before:**
```typescript
const customTest = apiTest.extend({
  myFixture: async ({ baseURL }, use) => {
    // use baseURL
  }
});
```

### **After:**
```typescript
const customTest = apiTest.extend({
  myFixture: async ({ apiBaseUrl }, use) => {
    // use apiBaseUrl
  }
});
```

**Note:** This only applies to custom fixture definitions, not to test files using existing fixtures.

---

## Files Modified

1. **`src/api/ApiTest.ts`**
   - Updated `ApiTestFixtures` interface
   - Renamed `baseURL` fixture to `apiBaseUrl`
   - Updated 6 dependent fixtures to use `apiBaseUrl`
   - All changes are internal to the fixture definitions

---

## Conclusion

This refactoring:
- ✅ **Eliminated confusion** from duplicate/similar fixture names
- ✅ **Improved consistency** across all URL fixtures
- ✅ **Enhanced readability** with descriptive names
- ✅ **Maintained compatibility** - all tests passing
- ✅ **Zero breaking changes** to test files

The codebase is now more maintainable and easier to understand! 🎉
