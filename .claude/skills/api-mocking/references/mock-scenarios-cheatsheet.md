# API Mock Scenarios — Quick Reference

`ApiMockService` is only for UI tests (`tests/frontsite/`, `tests/admin/`, `tests/ecommerce/`).
Never mock in `tests/api/` — those tests hit real endpoints.

```ts
import { ApiMockService } from '../../src/api/ApiMockService';
// in test:
const mockService = new ApiMockService(page);
```

## Auth

```ts
mockService.mockSuccessfulLogin('user@example.com')  // POST **/api/auth/login → 200
mockService.mockFailedLogin()                         // POST **/api/auth/login → 401
mockService.mockUserRegistration()                    // POST **/api/auth/register → 201
mockService.mockGetUserProfile()                      // GET  **/api/users/me → 200
mockService.mockUpdateUserProfile()                   // PUT  **/api/users/me → 200
```

## Products

```ts
mockService.mockProductList(20)           // paginated list, 20 items
mockService.mockProductDetails(42)        // single product id=42
mockService.mockProductNotFound(99)       // 404 for id=99
mockService.mockOutOfStockProduct(42)     // stock=0
mockService.mockProductSearch('shoes', 5) // 5 search results
```

## Cart

```ts
mockService.mockGetCart()         // cart with items
mockService.mockGetCart(true)     // empty cart
mockService.mockAddToCart()       // POST → 201
mockService.mockUpdateCartItem()  // PUT  → 200
mockService.mockRemoveCartItem()  // DELETE → 200
mockService.mockClearCart()       // DELETE → 200
```

## Orders

```ts
mockService.mockOrderList(10)
mockService.mockOrderDetails(7)
mockService.mockCreateOrder()
mockService.mockOrderCreationFailure()  // 402 Payment failed
mockService.mockCancelOrder(7)
```

## Address & Payment

```ts
mockService.mockAddressList(3)
mockService.mockAddAddress()
mockService.mockUpdateAddress(5)
mockService.mockDeleteAddress(5)
mockService.mockPaymentMethodList(2)
mockService.mockAddPaymentMethod()
mockService.mockProcessPayment()
mockService.mockPaymentFailure('Insufficient funds')
```

## Errors

```ts
mockService.mockUnauthorized('**/api/orders/**')     // 401
mockService.mockForbidden('**/api/admin/**')          // 403
mockService.mockRateLimit('**/api/**')                // 429 + Retry-After
mockService.mockServerError('**/api/checkout')        // 500
mockService.mockTimeout('**/api/slow-endpoint')       // never resolves
mockService.mockSlowNetwork('**/api/data', data, 5000) // 5 s delay
```

## GraphQL

```ts
mockService.mockGraphQLQuery('GetUserProfile', { userProfile: { id: '1', name: 'Mock' } })
mockService.mockGraphQLMutation('CreateOrder', { order: { id: '42', status: 'pending' } })
mockService.mockGraphQLError('GetProtectedData', 'Unauthorized', 'UNAUTHENTICATED')
```
GraphQL mocks match on `operationName` — always name your operations.

## Low-level (`ApiMockHelper`)

```ts
const helper = mockService.getMockHelper();
helper.mockSuccess('**/api/custom', { result: 'ok' }, 201)
helper.mockError('**/api/fail', 'Something went wrong', 400)
helper.mockNotFound('**/api/resource/99', 'Not found')
helper.mockUnauthorized('**/api/secure', 'Please log in')
helper.mockRateLimitError('**/api/search', 60)
helper.mockTimeout('**/api/slow')
helper.mockDelayed('**/api/data', { items: [] }, 3000)
helper.mockPaginated('**/api/products', productArray, 10)
helper.mockGraphQL('**/graphql', 'OpName', { data: { ... } })
helper.mockGraphQLError('**/graphql', 'OpName', 'Error msg', 'CODE')
```

## Lifecycle

```ts
// Wait for an intercepted request body
const body = await mockService.waitForApiCall('**/api/checkout')

// Wait for a response
const data = await mockService.waitForApiResponse('**/api/orders')

// Clear one mock
await mockService.clearMock('**/api/products')

// Clear all mocks
await mockService.clearAllMocks()
```

## Cleanup pattern (beforeEach / afterEach)

```ts
let mockService: ApiMockService;
test.beforeEach(async ({ page }) => { mockService = new ApiMockService(page); });
test.afterEach(async () => { await mockService.clearAllMocks(); });
```
Single-test mocks are cleaned up automatically by Playwright — no explicit cleanup needed.
