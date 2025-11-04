# API Mocking Guide

Comprehensive guide to API mocking capabilities in the Playwright TypeScript framework.

## 📋 Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Core Components](#core-components)
4. [Basic Mocking](#basic-mocking)
5. [Advanced Mocking](#advanced-mocking)
6. [Mock Data Generators](#mock-data-generators)
7. [Service Layer Mocking](#service-layer-mocking)
8. [GraphQL Mocking](#graphql-mocking)
9. [Error Scenarios](#error-scenarios)
10. [Best Practices](#best-practices)
11. [Common Patterns](#common-patterns)
12. [Troubleshooting](#troubleshooting)

## Introduction

API mocking allows you to test your application's UI and behavior without relying on real backend APIs. This enables:

- **Faster Tests**: No network latency
- **Reliable Tests**: No external API dependencies
- **Offline Development**: Work without internet
- **Error Simulation**: Test edge cases easily
- **Cost Reduction**: Avoid API usage costs
- **Parallel Testing**: No rate limiting

## Getting Started

### Installation

All API mocking utilities are included in the framework. No additional installation required.

### Quick Example

```typescript
import { test, expect } from '@playwright/test';
import { ApiMockService } from '../src/api/ApiMockService';

test('mock user login', async ({ page }) => {
  const mockService = new ApiMockService(page);
  
  // Mock successful login
  await mockService.mockSuccessfulLogin('user@example.com');
  
  // Navigate and interact
  await page.goto('https://example.com/login');
  await page.fill('#email', 'user@example.com');
  await page.fill('#password', 'password');
  await page.click('#login-button');
  
  // Assert mocked response
  await expect(page.locator('.welcome-message')).toBeVisible();
});
```

## Core Components

### 1. ApiMockHelper

Low-level utility for mocking API responses.

**Location**: `src/utils/api-mock-helper.ts`

**Key Methods**:
- `mockSuccess()` - Mock successful responses
- `mockError()` - Mock error responses
- `mockDelayed()` - Mock slow networks
- `mockConditional()` - Conditional mocking
- `mockGraphQL()` - GraphQL mocking
- `mockPaginated()` - Paginated responses

### 2. ApiMockService

High-level service with pre-configured mocking scenarios.

**Location**: `src/api/ApiMockService.ts`

**Pre-built Methods**:
- User authentication mocks
- Product catalog mocks
- Shopping cart mocks
- Order management mocks
- Payment mocks
- Error scenario mocks

### 3. MockDataGenerators

Generate realistic mock data for testing.

**Location**: `src/data/api/mock-data.ts`

**Generators**:
- User data
- Product data
- Order data
- Cart data
- Address data
- Payment data
- Error responses

## Basic Mocking

### Mock Successful Response

```typescript
import { ApiMockHelper } from '../src/utils/api-mock-helper';
import { MockDataGenerators } from '../src/data/api/mock-data';

const mockHelper = new ApiMockHelper(page);

// Mock user data
await mockHelper.mockSuccess(
  '**/api/users/1',
  MockDataGenerators.mockUser({ id: 1, email: 'john@example.com' })
);

// Mock product data
await mockHelper.mockSuccess(
  '**/api/products/123',
  MockDataGenerators.mockProduct({ id: 123, name: 'Laptop' })
);

// Mock custom data
await mockHelper.mockSuccess(
  '**/api/custom',
  { data: 'Custom response', timestamp: Date.now() }
);
```

### Mock Error Response

```typescript
// Mock 404 Not Found
await mockHelper.mockNotFound(
  '**/api/users/999',
  'User not found'
);

// Mock 401 Unauthorized
await mockHelper.mockUnauthorized(
  '**/api/protected',
  'Authentication required'
);

// Mock generic error
await mockHelper.mockError(
  '**/api/error',
  'Something went wrong',
  500
);
```

### Mock Specific Status Codes

```typescript
// Mock 400 Bad Request
await mockHelper.mockError(
  '**/api/invalid',
  'Invalid request data',
  400
);

// Mock 403 Forbidden
await mockHelper.mockError(
  '**/api/admin',
  'Access denied',
  403
);

// Mock 429 Rate Limit
await mockHelper.mockRateLimitError(
  '**/api/search',
  60  // Retry after 60 seconds
);
```

## Advanced Mocking

### Delayed Responses (Slow Network)

```typescript
// Mock 3-second delay
await mockHelper.mockDelayed(
  '**/api/slow-endpoint',
  { data: 'Delayed response' },
  3000  // 3 seconds
);

// Test loading states
await page.goto('https://example.com/slow-page');
await expect(page.locator('.loading-spinner')).toBeVisible();

// Wait for delayed response
await expect(page.locator('.data')).toBeVisible({ timeout: 5000 });
```

### Conditional Mocking

```typescript
// Different responses based on request method
await mockHelper.mockConditional('**/api/users', [
  {
    condition: { method: 'GET' },
    response: {
      status: 200,
      body: MockDataGenerators.mockUserList(10)
    }
  },
  {
    condition: { method: 'POST' },
    response: {
      status: 201,
      body: { message: 'User created', id: 123 }
    }
  },
  {
    condition: { method: 'DELETE' },
    response: {
      status: 204,
      body: null
    }
  }
]);

// Conditional based on request headers
await mockHelper.mockConditional('**/api/data', [
  {
    condition: {
      method: 'GET',
      headers: { 'Authorization': 'Bearer valid-token' }
    },
    response: {
      status: 200,
      body: { data: 'Protected data' }
    }
  },
  {
    condition: { method: 'GET' },
    response: {
      status: 401,
      body: { error: 'Unauthorized' }
    }
  }
]);
```

### Paginated Responses

```typescript
// Generate large dataset
const products = MockDataGenerators.mockProductList(100);

// Mock pagination
await mockHelper.mockPaginated(
  '**/api/products',
  products,
  10  // 10 items per page
);

// Page 1: /api/products?page=1&limit=10 → items 0-9
// Page 2: /api/products?page=2&limit=10 → items 10-19
// etc.

// Navigate through pages
await page.goto('https://example.com/products?page=1');
await expect(page.locator('.product-item')).toHaveCount(10);

await page.click('.next-page');
await expect(page.locator('.product-item')).toHaveCount(10);
```

### Request/Response Interception

```typescript
// Intercept and modify request
await mockHelper.interceptRequest('**/api/submit', async (request) => {
  const postData = request.postDataJSON();
  
  // Add timestamp to every request
  return {
    ...postData,
    timestamp: Date.now(),
    clientVersion: '1.0.0'
  };
});

// Intercept and modify response
await mockHelper.interceptResponse('**/api/products', async (response) => {
  // Add cache flag to all products
  return {
    ...response,
    cached: true,
    cacheTime: Date.now()
  };
});
```

### Network Failure Simulation

```typescript
// Mock timeout
await mockHelper.mockTimeout('**/api/timeout');

// Mock network failure
await mockHelper.mockNetworkFailure(
  '**/api/unreachable',
  'failed'  // 'failed' | 'aborted' | 'timedout' | 'accessdenied'
);

// Test error handling
await page.goto('https://example.com/test');
await expect(page.locator('.error-message')).toContain('Network error');
```

## Mock Data Generators

### User Data

```typescript
import { MockDataGenerators } from '../src/data/api/mock-data';

// Single user
const user = MockDataGenerators.mockUser({
  email: 'custom@example.com',
  role: 'admin',
  firstName: 'John',
  lastName: 'Doe'
});

// User list
const users = MockDataGenerators.mockUserList(20);

// Admin user
const admin = MockDataGenerators.mockAdmin({
  email: 'admin@example.com'
});
```

### Product Data

```typescript
// Single product
const product = MockDataGenerators.mockProduct({
  name: 'Premium Laptop',
  price: 1299.99,
  stock: 50,
  category: 'Electronics'
});

// Product list
const products = MockDataGenerators.mockProductList(50);

// Out of stock product
const outOfStock = MockDataGenerators.mockOutOfStockProduct({
  name: 'Sold Out Item'
});
```

### Order Data

```typescript
// Single order
const order = MockDataGenerators.mockOrder({
  status: 'shipped',
  total: 599.99
});

// Order list
const orders = MockDataGenerators.mockOrderList(15);

// Order with specific items
const orderItems = MockDataGenerators.mockOrderItems(5);
const customOrder = MockDataGenerators.mockOrder({
  items: orderItems
});
```

### Cart Data

```typescript
// Cart with items
const cart = MockDataGenerators.mockCart();

// Empty cart
const emptyCart = MockDataGenerators.mockEmptyCart();

// Cart items
const cartItems = MockDataGenerators.mockCartItems(3);
```

### Address & Payment Data

```typescript
// Address
const address = MockDataGenerators.mockAddress({
  city: 'New York',
  state: 'NY',
  isDefault: true
});

// Address list
const addresses = MockDataGenerators.mockAddressList(3);

// Payment method
const paymentMethod = MockDataGenerators.mockPaymentMethod({
  brand: 'Visa',
  last4: '4242'
});

// Payment methods list
const paymentMethods = MockDataGenerators.mockPaymentMethodList(2);
```

### Error Responses

```typescript
// Validation error
const validationError = MockDataGenerators.mockValidationError([
  'email',
  'password'
]);

// Not found error
const notFoundError = MockDataGenerators.mockNotFoundError('Product');

// Unauthorized error
const unauthorizedError = MockDataGenerators.mockUnauthorizedError();

// Forbidden error
const forbiddenError = MockDataGenerators.mockForbiddenError();

// Server error
const serverError = MockDataGenerators.mockServerError();
```

### Authentication Data

```typescript
// Auth token
const token = MockDataGenerators.mockAuthToken({
  expiresIn: 7200
});

// Login response
const loginResponse = MockDataGenerators.mockLoginResponse({
  user: MockDataGenerators.mockUser({ email: 'test@example.com' })
});
```

## Service Layer Mocking

### User Authentication

```typescript
import { ApiMockService } from '../src/api/ApiMockService';

const mockService = new ApiMockService(page);

// Successful login
await mockService.mockSuccessfulLogin('user@example.com');

// Failed login
await mockService.mockFailedLogin();

// User registration
await mockService.mockUserRegistration();

// Get user profile
await mockService.mockGetUserProfile();

// Update profile
await mockService.mockUpdateUserProfile();
```

### Product Management

```typescript
// Product list with pagination
await mockService.mockProductList(50);

// Single product
await mockService.mockProductDetails(123);

// Product not found
await mockService.mockProductNotFound(999);

// Out of stock product
await mockService.mockOutOfStockProduct(456);

// Product search
await mockService.mockProductSearch('laptop', 10);
```

### Shopping Cart

```typescript
// Get cart (with items)
await mockService.mockGetCart(false);

// Get empty cart
await mockService.mockGetCart(true);

// Add to cart
await mockService.mockAddToCart();

// Update cart item
await mockService.mockUpdateCartItem();

// Remove from cart
await mockService.mockRemoveCartItem();

// Clear cart
await mockService.mockClearCart();
```

### Order Management

```typescript
// Order list
await mockService.mockOrderList(10);

// Order details
await mockService.mockOrderDetails(12345);

// Create order
await mockService.mockCreateOrder();

// Order creation failure
await mockService.mockOrderCreationFailure();

// Cancel order
await mockService.mockCancelOrder(12345);
```

### Address Management

```typescript
// Address list
await mockService.mockAddressList(3);

// Add address
await mockService.mockAddAddress();

// Update address
await mockService.mockUpdateAddress(1);

// Delete address
await mockService.mockDeleteAddress(1);
```

### Payment Processing

```typescript
// Payment methods
await mockService.mockPaymentMethodList(2);

// Add payment method
await mockService.mockAddPaymentMethod();

// Process payment
await mockService.mockProcessPayment();

// Payment failure
await mockService.mockPaymentFailure('Insufficient funds');
```

## GraphQL Mocking

### Mock GraphQL Query

```typescript
// Mock user query
await mockHelper.mockGraphQL(
  '**/graphql',
  'GetUser',
  {
    user: MockDataGenerators.mockUser({ id: 1 })
  }
);

// Mock product list query
await mockHelper.mockGraphQL(
  '**/graphql',
  'GetProducts',
  {
    products: MockDataGenerators.mockProductList(20)
  }
);
```

### Mock GraphQL Mutation

```typescript
// Mock create user mutation
await mockHelper.mockGraphQL(
  '**/graphql',
  'CreateUser',
  {
    createUser: {
      success: true,
      user: MockDataGenerators.mockUser(),
      message: 'User created successfully'
    }
  }
);

// Mock update product mutation
await mockHelper.mockGraphQL(
  '**/graphql',
  'UpdateProduct',
  {
    updateProduct: {
      success: true,
      product: MockDataGenerators.mockProduct()
    }
  }
);
```

### Mock GraphQL Errors

```typescript
// Simple error
await mockHelper.mockGraphQLError(
  '**/graphql',
  'GetUser',
  'User not found'
);

// Error with code
await mockHelper.mockGraphQLError(
  '**/graphql',
  'DeleteUser',
  'Permission denied',
  'FORBIDDEN'
);
```

### Using Service Layer for GraphQL

```typescript
// Mock GraphQL query
await mockService.mockGraphQLQuery('GetProducts', {
  products: MockDataGenerators.mockProductList(10)
});

// Mock GraphQL mutation
await mockService.mockGraphQLMutation('AddToCart', {
  addToCart: {
    success: true,
    cart: MockDataGenerators.mockCart()
  }
});

// Mock GraphQL error
await mockService.mockGraphQLError(
  'CreateOrder',
  'Payment processing failed',
  'PAYMENT_ERROR'
);
```

## Error Scenarios

### HTTP Error Codes

```typescript
// 400 Bad Request
await mockService.mockServerError('**/api/invalid');

// 401 Unauthorized
await mockService.mockUnauthorized('**/api/protected');

// 403 Forbidden
await mockService.mockForbidden('**/api/admin');

// 404 Not Found
await mockHelper.mockNotFound('**/api/users/999', 'User not found');

// 429 Rate Limit
await mockService.mockRateLimit('**/api/**');

// 500 Server Error
await mockService.mockServerError('**/api/**');
```

### Network Errors

```typescript
// Timeout
await mockService.mockTimeout('**/api/slow');

// Slow network
await mockService.mockSlowNetwork(
  '**/api/data',
  { data: 'response' },
  5000  // 5 second delay
);

// Network failure
await mockHelper.mockNetworkFailure('**/api/unreachable', 'failed');
```

### Validation Errors

```typescript
// Mock validation error
await mockHelper.mockSuccess('**/api/submit', 
  MockDataGenerators.mockValidationError(['email', 'password', 'name']),
  422
);
```

## Best Practices

### 1. Use Service Layer for Common Scenarios

```typescript
// ✅ Good: Use pre-built service methods
await mockService.mockSuccessfulLogin();
await mockService.mockProductList(20);
await mockService.mockAddToCart();

// ❌ Avoid: Manually mocking common scenarios
await mockHelper.mockSuccess('**/api/auth/login', { ... });
```

### 2. Leverage Mock Data Generators

```typescript
// ✅ Good: Use generators for realistic data
const users = MockDataGenerators.mockUserList(10);
await mockHelper.mockSuccess('**/api/users', users);

// ❌ Avoid: Hardcoding mock data
await mockHelper.mockSuccess('**/api/users', [
  { id: 1, name: 'User 1' },
  { id: 2, name: 'User 2' }
]);
```

### 3. Clear Mocks When Needed

```typescript
test('test with mocks', async ({ page }) => {
  const mockService = new ApiMockService(page);
  
  // Setup mocks
  await mockService.mockProductList(10);
  
  // Run test
  await page.goto('https://example.com/products');
  
  // Clear specific mock
  await mockService.clearMock('**/api/products');
  
  // Or clear all mocks
  await mockService.clearAllMocks();
});
```

### 4. Use Appropriate URL Patterns

```typescript
// ✅ Good: Specific patterns
await mockHelper.mockSuccess('**/api/users/1', userData);
await mockHelper.mockSuccess('**/api/products?category=electronics', products);

// ⚠️ Be careful with wildcards
await mockHelper.mockSuccess('**/api/**', data);  // Too broad
```

### 5. Test Both Success and Error Scenarios

```typescript
test.describe('User Profile', () => {
  test('should display user data on success', async ({ page }) => {
    await mockService.mockGetUserProfile();
    // Test success case
  });
  
  test('should handle user not found error', async ({ page }) => {
    await mockService.mockNotFound('**/api/users/me', 'User not found');
    // Test error case
  });
  
  test('should handle network timeout', async ({ page }) => {
    await mockService.mockTimeout('**/api/users/me');
    // Test timeout case
  });
});
```

### 6. Organize Mocks by Test Scope

```typescript
test.describe('Shopping Flow', () => {
  test.beforeEach(async ({ page }) => {
    const mockService = new ApiMockService(page);
    
    // Common mocks for all tests
    await mockService.mockSuccessfulLogin();
    await mockService.mockProductList(20);
  });
  
  test('add to cart', async ({ page }) => {
    const mockService = new ApiMockService(page);
    await mockService.mockAddToCart();
    // Test specific scenario
  });
  
  test('checkout', async ({ page }) => {
    const mockService = new ApiMockService(page);
    await mockService.mockCreateOrder();
    // Test specific scenario
  });
});
```

## Common Patterns

### Pattern 1: Mock Authentication Flow

```typescript
test('complete authentication flow', async ({ page }) => {
  const mockService = new ApiMockService(page);
  
  // 1. Mock failed login
  await mockService.mockFailedLogin();
  await page.goto('https://example.com/login');
  await page.fill('#email', 'wrong@example.com');
  await page.fill('#password', 'wrongpass');
  await page.click('#login');
  await expect(page.locator('.error')).toContain('Invalid credentials');
  
  // 2. Clear failed login mock
  await mockService.clearMock('**/api/auth/login');
  
  // 3. Mock successful login
  await mockService.mockSuccessfulLogin('correct@example.com');
  await page.fill('#email', 'correct@example.com');
  await page.fill('#password', 'correctpass');
  await page.click('#login');
  await expect(page.locator('.dashboard')).toBeVisible();
});
```

### Pattern 2: Mock E-commerce Journey

```typescript
test('complete purchase flow', async ({ page }) => {
  const mockService = new ApiMockService(page);
  
  // 1. Browse products
  await mockService.mockProductList(50);
  await page.goto('https://example.com/products');
  
  // 2. View product details
  await mockService.mockProductDetails(123);
  await page.click('.product-item:first-child');
  
  // 3. Add to cart
  await mockService.mockAddToCart();
  await page.click('#add-to-cart');
  
  // 4. View cart
  await mockService.mockGetCart(false);
  await page.click('.cart-icon');
  
  // 5. Checkout
  await mockService.mockCreateOrder();
  await page.click('#checkout');
  
  // 6. Verify order
  await expect(page.locator('.order-confirmation')).toBeVisible();
});
```

### Pattern 3: Mock Error Recovery

```typescript
test('handle and recover from errors', async ({ page }) => {
  const mockService = new ApiMockService(page);
  
  // 1. Mock timeout
  await mockService.mockTimeout('**/api/submit');
  await page.goto('https://example.com/form');
  await page.fill('#data', 'test');
  await page.click('#submit');
  await expect(page.locator('.timeout-error')).toBeVisible();
  
  // 2. User clicks retry
  await mockService.clearMock('**/api/submit');
  await mockService.mockSuccess('**/api/submit', { success: true });
  await page.click('#retry');
  await expect(page.locator('.success-message')).toBeVisible();
});
```

### Pattern 4: Mock Pagination

```typescript
test('navigate through paginated data', async ({ page }) => {
  const mockHelper = new ApiMockHelper(page);
  const allProducts = MockDataGenerators.mockProductList(100);
  
  // Mock pagination
  await mockHelper.mockPaginated('**/api/products', allProducts, 10);
  
  // Page 1
  await page.goto('https://example.com/products?page=1');
  await expect(page.locator('.product-item')).toHaveCount(10);
  await expect(page.locator('.page-number')).toContainText('1');
  
  // Page 2
  await page.click('.next-page');
  await expect(page.locator('.page-number')).toContainText('2');
  await expect(page.locator('.product-item')).toHaveCount(10);
  
  // Last page
  await page.click('.last-page');
  await expect(page.locator('.page-number')).toContainText('10');
  await expect(page.locator('.next-page')).toBeDisabled();
});
```

## Troubleshooting

### Mock Not Working

**Problem**: Mock is set up but real API is still being called.

**Solutions**:
1. Check URL pattern matches actual request
```typescript
// Debug: Log actual requests
page.on('request', request => {
  console.log('Request:', request.url());
});

// Adjust pattern to match
await mockHelper.mockSuccess('**/api/users', data);
```

2. Set up mock before navigation
```typescript
// ✅ Correct order
await mockService.mockProductList(10);
await page.goto('https://example.com/products');

// ❌ Wrong order
await page.goto('https://example.com/products');
await mockService.mockProductList(10);  // Too late!
```

### Multiple Mocks Conflicting

**Problem**: Multiple mocks on same endpoint causing issues.

**Solution**: Clear previous mocks
```typescript
await mockService.mockSuccess('**/api/users', data1);
// ... test ...

await mockService.clearMock('**/api/users');
await mockService.mockSuccess('**/api/users', data2);
// ... test ...
```

### Mock Data Not Realistic

**Problem**: Tests pass with mocks but fail with real API.

**Solution**: Use realistic mock data
```typescript
// ❌ Unrealistic mock
await mockHelper.mockSuccess('**/api/user', {
  id: 1,
  name: 'Test'
});

// ✅ Realistic mock
await mockHelper.mockSuccess('**/api/user', 
  MockDataGenerators.mockUser({
    email: 'real.email@example.com',
    phone: '+1555-123-4567'
  })
);
```

### GraphQL Mocks Not Matching

**Problem**: GraphQL mock not triggering.

**Solution**: Verify operation name matches exactly
```typescript
// Check actual operation name in network tab
await mockHelper.mockGraphQL(
  '**/graphql',
  'GetProducts',  // Must match exactly (case-sensitive)
  { products: [] }
);
```

### Performance Issues with Large Mocks

**Problem**: Tests slow with large mock datasets.

**Solution**: Use appropriate data sizes
```typescript
// ❌ Too much data
const products = MockDataGenerators.mockProductList(10000);

// ✅ Reasonable amount
const products = MockDataGenerators.mockProductList(50);

// ✅ Use pagination for large datasets
await mockHelper.mockPaginated('**/api/products', products, 20);
```

## Summary

API mocking is a powerful feature that enables:

- **Faster development**: Test without waiting for backend
- **Reliable tests**: No flaky tests from external APIs
- **Error testing**: Simulate hard-to-reproduce scenarios
- **Offline work**: Develop without internet
- **Cost savings**: Avoid API usage charges

### Quick Reference

```typescript
// Import utilities
import { ApiMockHelper } from '../src/utils/api-mock-helper';
import { ApiMockService } from '../src/api/ApiMockService';
import { MockDataGenerators } from '../src/data/api/mock-data';

// Basic mocking
const mockHelper = new ApiMockHelper(page);
await mockHelper.mockSuccess(url, data);
await mockHelper.mockError(url, message, status);

// Service layer
const mockService = new ApiMockService(page);
await mockService.mockSuccessfulLogin();
await mockService.mockProductList(20);
await mockService.mockAddToCart();

// Generate data
const user = MockDataGenerators.mockUser();
const products = MockDataGenerators.mockProductList(10);
const order = MockDataGenerators.mockOrder();

// Clean up
await mockService.clearMock(url);
await mockService.clearAllMocks();
```

For more examples, see `tests/api/api-mocking-examples.spec.ts`.
