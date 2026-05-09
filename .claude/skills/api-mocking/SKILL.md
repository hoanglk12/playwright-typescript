---
name: "api-mocking"
description: Use when mocking, intercepting, or simulating API requests and responses in Playwright tests, including static mocks, error simulation, and integration with ApiMockService and ApiMockHelper.
---

# API Mocking

This project has two distinct mocking contexts. Know which one you need before writing any code.

---

## Two Mocking Contexts

### Context A — UI Tests (browser-level network interception)

Used in `tests/frontsite/`, `tests/admin/`, `tests/ecommerce/`. The browser makes HTTP requests; you intercept them via Playwright's `route` API through the `NetworkHelper` or `ApiMockService`.

```ts
import { test, expect } from '@config/base-test';
import { ApiMockService } from '../../src/api/ApiMockService';

test('TC_01 - Page renders with mocked login', async ({ page, homePage }) => {
  const mockService = new ApiMockService(page);

  await mockService.mockSuccessfulLogin('user@example.com');
  // page now intercepted — any POST to **/api/auth/login returns mock data

  await homePage.navigateToPage();
  // assertions on UI that consumed the mocked response
});
```

### Context B — API Tests (direct HTTP calls)

Used in `tests/api/`. You call real endpoints via `ApiClient`/`ApiClientExt`/service fixtures. **Do not mock in API tests** — they test real server behaviour. Use `test.env` or `NODE_ENV=testing` to point at the test environment.

---

## `ApiMockService` — High-Level Scenarios

`ApiMockService` (`src/api/ApiMockService.ts`) wraps `ApiMockHelper` with pre-configured scenarios. Instantiate it with the `page` fixture.

```ts
const mockService = new ApiMockService(page);
```

### Auth Mocks

| Method | URL Pattern | Status |
|---|---|---|
| `mockSuccessfulLogin(email?)` | `**/api/auth/login` | 200 |
| `mockFailedLogin()` | `**/api/auth/login` | 401 |
| `mockUserRegistration()` | `**/api/auth/register` | 201 |
| `mockGetUserProfile()` | `**/api/users/me` | 200 |
| `mockUpdateUserProfile()` | `**/api/users/me` | 200 |

### Product Mocks

```ts
await mockService.mockProductList(20);           // paginated list of 20 products
await mockService.mockProductDetails(42);        // single product ID=42
await mockService.mockProductNotFound(99);       // 404 for product 99
await mockService.mockOutOfStockProduct(42);     // product 42 with stock=0
await mockService.mockProductSearch('shoes', 5); // 5 search results
```

### Cart Mocks

```ts
await mockService.mockGetCart();           // cart with items
await mockService.mockGetCart(true);       // empty cart
await mockService.mockAddToCart();         // POST → 201
await mockService.mockUpdateCartItem();    // PUT → 200
await mockService.mockRemoveCartItem();    // DELETE → 200
await mockService.mockClearCart();         // DELETE → 200
```

### Order Mocks

```ts
await mockService.mockOrderList(10);
await mockService.mockOrderDetails(7);
await mockService.mockCreateOrder();
await mockService.mockOrderCreationFailure();  // 402 Payment failed
await mockService.mockCancelOrder(7);
```

### Address & Payment Mocks

```ts
await mockService.mockAddressList(3);
await mockService.mockAddAddress();
await mockService.mockUpdateAddress(5);
await mockService.mockDeleteAddress(5);
await mockService.mockPaymentMethodList(2);
await mockService.mockAddPaymentMethod();
await mockService.mockProcessPayment();
await mockService.mockPaymentFailure('Insufficient funds');
```

### Error Scenarios

```ts
await mockService.mockUnauthorized('**/api/orders/**');  // 401 on all order endpoints
await mockService.mockForbidden('**/api/admin/**');       // 403
await mockService.mockRateLimit('**/api/**');             // 429 + Retry-After header
await mockService.mockServerError('**/api/checkout');     // 500
await mockService.mockTimeout('**/api/slow-endpoint');    // request never resolves
await mockService.mockSlowNetwork('**/api/data', responseData, 5000);  // 5 s delay
```

### GraphQL Mocks

GraphQL mocks match on the `operationName` field in the POST body — always name your GraphQL operations.

```ts
// Mock a successful query response
await mockService.mockGraphQLQuery('GetUserProfile', {
  userProfile: { id: '1', name: 'Mock User', role: 'admin' }
});

// Mock a successful mutation response
await mockService.mockGraphQLMutation('CreateOrder', {
  order: { id: '42', status: 'pending', total: 150.00 }
});

// Mock a GraphQL error (with optional extension code)
await mockService.mockGraphQLError('GetProtectedData', 'Unauthorized', 'UNAUTHENTICATED');
```

---

## `ApiMockHelper` — Low-Level Control

Access via `mockService.getMockHelper()` or construct directly for custom scenarios not covered by `ApiMockService`.

```ts
import { ApiMockHelper } from '../../src/utils/api-mock-helper';

const helper = new ApiMockHelper(page);
// or:
const helper = mockService.getMockHelper();
```

### Core Methods

```ts
// Success response with custom body and status
await helper.mockSuccess('**/api/custom', { result: 'ok' }, 201);

// Error response
await helper.mockError('**/api/fail', 'Something went wrong', 400);

// 404 Not Found
await helper.mockNotFound('**/api/resource/99', 'Resource not found');

// 401 Unauthorized
await helper.mockUnauthorized('**/api/secure', 'Please log in');

// 429 Rate Limit with retry-after seconds
await helper.mockRateLimitError('**/api/search', 60);

// Request never responds (simulates timeout)
await helper.mockTimeout('**/api/slow');

// Delayed response (simulates slow network)
await helper.mockDelayed('**/api/data', { items: [] }, 3000);

// Paginated list response
await helper.mockPaginated('**/api/products', productArray, 10); // 10 per page

// GraphQL operation mock
await helper.mockGraphQL('**/graphql', 'OperationName', { data: { ... } });

// GraphQL error mock
await helper.mockGraphQLError('**/graphql', 'OperationName', 'Error message', 'ERROR_CODE');
```

### Cleanup and Waiting

```ts
// Remove all mocks (call in afterEach)
await mockService.clearAllMocks();
// or:
await helper.clearAllMocks();

// Remove a specific mock
await mockService.clearMock('**/api/products');

// Wait for a specific request to be intercepted
const requestBody = await mockService.waitForApiCall('**/api/checkout');

// Wait for a specific response to be sent
const responseData = await mockService.waitForApiResponse('**/api/orders');
```

---

## Cleanup Pattern

Always clear mocks in `test.afterEach` when registering mocks in a shared `beforeEach`:

```ts
test.describe('Checkout Flow with Mocks @frontsite @smoke', () => {
  let mockService: ApiMockService;

  test.beforeEach(async ({ page }) => {
    mockService = new ApiMockService(page);
    await mockService.mockGetCart();
    await mockService.mockProcessPayment();
  });

  test.afterEach(async () => {
    await mockService.clearAllMocks();
  });

  test('TC_01 - Should complete checkout', async ({ page }) => {
    // test body
  });
});
```

For mocks set inside a single test, Playwright automatically removes all routes after the test ends — no explicit cleanup needed.

---

## NetworkHelper (in Page Objects)

For UI-level route interception within page object methods, use `this.network` (the `NetworkHelper` instance on `BasePage`):

```ts
// In a page object method:
async interceptProductRequests(): Promise<void> {
  await this.network.interceptRequests('/api/products');
}

async waitForProductResponse(): Promise<void> {
  await this.network.waitForResponse('/api/products');
}
```

Do NOT use `ApiMockService` inside page objects — it takes a `Page` and is only for test files.

---

## Common Patterns

### Test that handles both mocked and real responses

```ts
test('TC_01 - Cart shows empty state', async ({ page, cartPage }) => {
  const mockService = new ApiMockService(page);
  await mockService.mockGetCart(true); // empty cart

  await cartPage.navigateTo();
  expect(await cartPage.isEmptyStateVisible()).toBe(true);
});
```

### Simulate auth failure mid-session

```ts
test('TC_02 - Should redirect to login on 401', async ({ page, dashboardPage }) => {
  const mockService = new ApiMockService(page);
  await page.goto('/dashboard');

  // Trigger auth expiry
  await mockService.mockUnauthorized('**/api/user/profile');
  await dashboardPage.clickRefreshProfile();

  await expect(page).toHaveURL('/login');
});
```

### Mock and assert the request body

```ts
test('TC_03 - Checkout sends correct payload', async ({ page, checkoutPage }) => {
  const mockService = new ApiMockService(page);
  await mockService.mockCreateOrder();

  const [requestBody] = await Promise.all([
    mockService.waitForApiCall('**/api/orders'),
    checkoutPage.clickPlaceOrder()
  ]);

  expect(requestBody.items).toHaveLength(2);
  expect(requestBody.paymentMethod).toBe('card');
});
```

---

## Common Mistakes

| Wrong | Correct |
|---|---|
| Adding mocks in API tests (`tests/api/`) | API tests use real endpoints — no mocking |
| Using `page.route()` directly for GraphQL | Use `mockService.mockGraphQLQuery` — it handles operationName matching |
| Forgetting to `clearAllMocks()` | Add `afterEach` cleanup when mocks are set in `beforeEach` |
| Constructing `ApiMockService` in a page object | Only use `ApiMockService` in test files |
| Not naming GraphQL operations | Unnamed operations cannot be selectively mocked |
