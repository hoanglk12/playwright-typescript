# GraphQL Error Handling in Tests

## Testing GraphQL Errors

When testing GraphQL APIs, error responses have a specific structure. Here's how to properly validate error scenarios:

### GraphQL Error Response Structure

```json
{
  "errors": [
    {
      "message": "\"hoangplatest3@mail.com--\" is not a valid email address.",
      "locations": [{ "line": 13, "column": 3 }],
      "path": ["createCustomer"],
      "extensions": { "category": "graphql-input" },
      "code": null
    }
  ],
  "data": {
    "createCustomer": null
  }
}
```

### Key Points

1. **Errors and Data Coexist**: GraphQL responses can have both `errors` and `data` fields
2. **Data is Null on Error**: When there's a validation error, the specific field (`createCustomer`) is `null`
3. **Errors is an Array**: Even for single errors, it's always an array

### Correct Way to Test Errors

```typescript
test('PLA_CreateAccount - error message shown when input invalid data', async ({ createGraphQLClient }) => {
  const graphqlClient = await createGraphQLClient();

  const mutation = `...`; // Your mutation
  
  const variables = {
    email: 'hoangplatest3@mail.com--', // Invalid email format
    // ... other variables
  };

  const response = await graphqlClient.mutateWrapped(mutation, variables);

  // Get the full GraphQL response (includes both errors and data)
  const graphqlResponse = await response.getGraphQLResponse();
  
  // ✅ Verify errors exist
  expect(graphqlResponse.errors).toBeDefined();
  expect(graphqlResponse.errors).toHaveLength(1);
  
  // ✅ Verify error message (use ! for non-null assertion after checking)
  expect(graphqlResponse.errors![0].message).toBe('"hoangplatest3@mail.com--" is not a valid email address.');
  expect(graphqlResponse.errors![0].extensions?.category).toBe('graphql-input');
  
  // ✅ Verify data is null for the failed operation
  expect(graphqlResponse.data.createCustomer).toBeNull();
});
```

### Common Mistakes to Avoid

#### ❌ Wrong: Using assertNoErrors()
```typescript
// This will fail because there ARE errors
await response.assertNoErrors(); // ❌ Fails
```

#### ❌ Wrong: Using getData() without checking errors
```typescript
// This tries to access data that might be null
const data = await response.getData(); // ❌ Might throw
expect(data.createCustomer.customer.id).toBeTruthy(); // ❌ createCustomer is null
```

#### ❌ Wrong: Using assertDataField on error path
```typescript
// GraphQL errors are not in the data field
await response.assertDataField('errors[0].message', '...'); // ❌ Wrong path
```

### Available Methods

From `GraphQLResponseWrapper`:

1. **`getGraphQLResponse()`** - Returns full response with errors and data
   ```typescript
   const response = await wrapper.getGraphQLResponse();
   // { errors?: [...], data: {...} }
   ```

2. **`getErrors()`** - Returns only the errors array
   ```typescript
   const errors = await wrapper.getErrors();
   // [{ message: '...', extensions: {...} }]
   ```

3. **`getData()`** - Returns only the data (throws if errors exist)
   ```typescript
   const data = await wrapper.getData();
   // { createCustomer: { customer: {...} } }
   ```

4. **`assertNoErrors()`** - Asserts no errors exist
   ```typescript
   await wrapper.assertNoErrors(); // Use for success cases only
   ```

### Test Pattern for Error Scenarios

```typescript
test('Should validate invalid input', async ({ createGraphQLClient }) => {
  const client = await createGraphQLClient();
  
  // 1. Execute with invalid data
  const response = await client.mutateWrapped(mutation, invalidVariables);
  
  // 2. Get full response
  const graphqlResponse = await response.getGraphQLResponse();
  
  // 3. Assert errors exist
  expect(graphqlResponse.errors).toBeDefined();
  expect(graphqlResponse.errors).toHaveLength(1);
  
  // 4. Verify error details
  const error = graphqlResponse.errors![0];
  expect(error.message).toContain('expected error text');
  expect(error.extensions?.category).toBe('graphql-input');
  
  // 5. Verify data is null
  expect(graphqlResponse.data.createCustomer).toBeNull();
});
```

### Test Pattern for Success Scenarios

```typescript
test('Should create account successfully', async ({ createGraphQLClient }) => {
  const client = await createGraphQLClient();
  
  // 1. Execute with valid data
  const response = await client.mutateWrapped(mutation, validVariables);
  
  // 2. Assert no errors
  await response.assertNoErrors();
  await response.assertHasData();
  
  // 3. Get data
  const data = await response.getData();
  
  // 4. Verify data
  expect(data.createCustomer.customer.id).toBeTruthy();
  expect(data.createCustomer.customer.email).toBe(expectedEmail);
});
```

## Test Results

All 4 tests passing:

```
✓ PLA_CreateAccount - error message shown when input invalid data
  ✅ Error validation passed: Invalid email format detected
  
✓ PLA_CreateAccount - should create a new customer account
  ✅ Created customer ID: 578373
  
✓ PLA_SignIn - should generate customer token for valid credentials
  Customer token generated (first 20 chars): eyJraWQiOiIxIiwiYWxn...
  
✓ PLA_GetCustomerDetails - should retrieve customer details with valid token
  ID: 578373
  Name: Hoang PLA1
  Email: platest1759937977363@mail.com

4 passed (5.4s)
```

## Summary

- ✅ **Error Testing**: Use `getGraphQLResponse()` to access both errors and data
- ✅ **Success Testing**: Use `assertNoErrors()` and `getData()` for clean data access
- ✅ **Type Safety**: Use non-null assertion (`!`) after verifying arrays exist
- ✅ **Clear Validation**: Always check error structure, message, and null data
