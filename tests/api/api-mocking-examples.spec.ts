import { test, expect } from '@playwright/test';
import { ApiMockHelper } from '../../src/utils/api-mock-helper';
import { ApiMockService } from '../../src/api/ApiMockService';
import { MockDataGenerators } from '../../src/data/api/mock-data';

test.describe('API Mocking Examples', () => {
  
  test.describe('Basic Response Mocking', () => {
    
    test('should mock successful API response', async ({ page }) => {
      const mockHelper = new ApiMockHelper(page);
      
      // Mock successful user data
      await mockHelper.mockSuccess(
        '**/api/users/1',
        MockDataGenerators.mockUser({ id: 1, name: 'John Doe' })
      );
      
      // Navigate to page that calls the API
      await page.goto('https://jsonplaceholder.typicode.com/users/1');
      
      // Verify mocked response appears on page
      const content = await page.textContent('body');
      expect(content).toContain('John Doe');
    });

    test('should mock error response', async ({ page }) => {
      const mockHelper = new ApiMockHelper(page);
      
      // Mock 404 error
      await mockHelper.mockNotFound(
        '**/api/users/999',
        'User not found'
      );
      
      await page.goto('https://jsonplaceholder.typicode.com/users/999');
      
      const content = await page.textContent('body');
      expect(content).toContain('User not found');
    });

    test('should mock unauthorized error', async ({ page }) => {
      const mockHelper = new ApiMockHelper(page);
      
      // Mock 401 unauthorized
      await mockHelper.mockUnauthorized(
        '**/api/protected-resource',
        'Please log in to access this resource'
      );
      
      await page.goto('https://jsonplaceholder.typicode.com/posts/1');
      
      // Verify unauthorized response
      const content = await page.textContent('body');
      expect(content).toBeDefined();
    });
  });

  test.describe('Service Layer Mocking', () => {
    
    test('should mock user login flow', async ({ page }) => {
      const mockService = new ApiMockService(page);
      
      // Mock successful login
      await mockService.mockSuccessfulLogin('test@example.com');
      
      // Navigate to login page and submit
      await page.goto('https://example.com/login');
      
      // Your login interaction code here
      // await page.fill('#email', 'test@example.com');
      // await page.fill('#password', 'password123');
      // await page.click('#login-button');
      
      // Verify login success
      // expect(await page.textContent('.welcome-message')).toContain('Welcome');
    });

    test('should mock failed login', async ({ page }) => {
      const mockService = new ApiMockService(page);
      
      // Mock failed login
      await mockService.mockFailedLogin();
      
      await page.goto('https://example.com/login');
      
      // Login interaction would trigger the mock
      // Verify error message appears
    });

    test('should mock product list with pagination', async ({ page }) => {
      const mockService = new ApiMockService(page);
      
      // Mock paginated product list
      await mockService.mockProductList(50);
      
      await page.goto('https://example.com/products');
      
      // Verify products are displayed
      // Navigate through pages to test pagination
    });
  });

  test.describe('Shopping Cart Mocking', () => {
    
    test('should mock add to cart', async ({ page }) => {
      const mockService = new ApiMockService(page);
      
      // Mock empty cart initially
      await mockService.mockGetCart(true);
      
      // Mock add to cart success
      await mockService.mockAddToCart();
      
      await page.goto('https://example.com/products/1');
      
      // Click add to cart button
      // await page.click('#add-to-cart');
      
      // Verify cart updated
      // expect(await page.textContent('.cart-count')).toBe('1');
    });

    test('should mock cart update', async ({ page }) => {
      const mockService = new ApiMockService(page);
      
      // Mock cart with items
      await mockService.mockGetCart(false);
      
      // Mock update cart item
      await mockService.mockUpdateCartItem();
      
      await page.goto('https://example.com/cart');
      
      // Update quantity
      // await page.selectOption('.quantity-select', '3');
      
      // Verify cart updated
    });

    test('should mock remove from cart', async ({ page }) => {
      const mockService = new ApiMockService(page);
      
      // Mock cart with items
      await mockService.mockGetCart(false);
      
      // Mock remove item
      await mockService.mockRemoveCartItem();
      
      await page.goto('https://example.com/cart');
      
      // Remove item
      // await page.click('.remove-item');
      
      // Verify item removed
    });
  });

  test.describe('Order Management Mocking', () => {
    
    test('should mock create order', async ({ page }) => {
      const mockService = new ApiMockService(page);
      
      // Mock order creation
      await mockService.mockCreateOrder();
      
      await page.goto('https://example.com/checkout');
      
      // Complete checkout
      // await page.click('#place-order');
      
      // Verify order confirmation
      // expect(await page.textContent('.order-number')).toMatch(/ORD-\d+/);
    });

    test('should mock order creation failure', async ({ page }) => {
      const mockService = new ApiMockService(page);
      
      // Mock payment failure
      await mockService.mockOrderCreationFailure();
      
      await page.goto('https://example.com/checkout');
      
      // Attempt checkout
      // await page.click('#place-order');
      
      // Verify error message
      // expect(await page.textContent('.error-message')).toContain('Payment processing failed');
    });

    test('should mock order list', async ({ page }) => {
      const mockService = new ApiMockService(page);
      
      // Mock order history
      await mockService.mockOrderList(10);
      
      await page.goto('https://example.com/orders');
      
      // Verify orders displayed
      // const orderCount = await page.locator('.order-item').count();
      // expect(orderCount).toBeGreaterThan(0);
    });
  });

  test.describe('Advanced Mocking Scenarios', () => {
    
    test('should mock delayed response (slow network)', async ({ page }) => {
      const mockHelper = new ApiMockHelper(page);
      
      // Mock slow API (3 second delay)
      await mockHelper.mockDelayed(
        '**/api/slow-endpoint',
        { data: 'Delayed response' },
        3000
      );
      
      const startTime = Date.now();
      await page.goto('https://example.com/slow-page');
      const endTime = Date.now();
      
      // Verify delay occurred
      expect(endTime - startTime).toBeGreaterThan(2500);
    });

    test('should mock conditional responses', async ({ page }) => {
      const mockHelper = new ApiMockHelper(page);
      
      // Mock different responses based on request
      await mockHelper.mockConditional('**/api/users', [
        {
          condition: { method: 'GET' },
          response: {
            status: 200,
            body: MockDataGenerators.mockUserList(10),
          },
        },
        {
          condition: { method: 'POST' },
          response: {
            status: 201,
            body: { message: 'User created' },
          },
        },
      ]);
      
      await page.goto('https://example.com/users');
      
      // Test GET request shows list
      // Test POST request creates user
    });

    test('should mock paginated data', async ({ page }) => {
      const mockHelper = new ApiMockHelper(page);
      const products = MockDataGenerators.mockProductList(100);
      
      // Mock paginated endpoint
      await mockHelper.mockPaginated(
        '**/api/products',
        products,
        10
      );
      
      await page.goto('https://example.com/products?page=1&limit=10');
      
      // Verify first page
      // Navigate to page 2
      // await page.click('.next-page');
      
      // Verify second page loaded
    });

    test('should mock rate limit error', async ({ page }) => {
      const mockHelper = new ApiMockHelper(page);
      
      // Mock rate limit
      await mockHelper.mockRateLimitError('**/api/search', 60);
      
      await page.goto('https://example.com/search?q=test');
      
      // Verify rate limit message
      // expect(await page.textContent('.error')).toContain('Too many requests');
    });

    test('should mock network timeout', async ({ page }) => {
      const mockHelper = new ApiMockHelper(page);
      
      // Mock timeout
      await mockHelper.mockTimeout('**/api/timeout-endpoint');
      
      await page.goto('https://example.com/timeout-test');
      
      // Verify timeout error handling
    });
  });

  test.describe('GraphQL Mocking', () => {
    
    test('should mock GraphQL query', async ({ page }) => {
      const mockHelper = new ApiMockHelper(page);
      
      // Mock GraphQL user query
      await mockHelper.mockGraphQL(
        '**/graphql',
        'GetUser',
        {
          user: MockDataGenerators.mockUser({ id: 1, name: 'GraphQL User' }),
        }
      );
      
      await page.goto('https://example.com/graphql-test');
      
      // Verify GraphQL response
    });

    test('should mock GraphQL mutation', async ({ page }) => {
      const mockHelper = new ApiMockHelper(page);
      
      // Mock GraphQL create user mutation
      await mockHelper.mockGraphQL(
        '**/graphql',
        'CreateUser',
        {
          createUser: {
            success: true,
            user: MockDataGenerators.mockUser(),
          },
        }
      );
      
      await page.goto('https://example.com/create-user');
      
      // Trigger mutation
      // Verify success
    });

    test('should mock GraphQL error', async ({ page }) => {
      const mockHelper = new ApiMockHelper(page);
      
      // Mock GraphQL error
      await mockHelper.mockGraphQLError(
        '**/graphql',
        'GetUser',
        'User not found',
        'USER_NOT_FOUND'
      );
      
      await page.goto('https://example.com/user/999');
      
      // Verify error handling
    });
  });

  test.describe('Request/Response Interception', () => {
    
    test('should intercept and modify request', async ({ page }) => {
      const mockHelper = new ApiMockHelper(page);
      
      // Intercept and add authentication header
      await mockHelper.interceptRequest('**/api/**', async (request) => {
        const postData = request.postDataJSON() || {};
        return {
          ...postData,
          timestamp: Date.now(),
        };
      });
      
      await page.goto('https://example.com/api-test');
      
      // Verify modified request
    });

    test('should intercept and modify response', async ({ page }) => {
      const mockHelper = new ApiMockHelper(page);
      
      // Intercept and modify response data
      await mockHelper.interceptResponse('**/api/products', async (response) => {
        return {
          ...response,
          modified: true,
          timestamp: Date.now(),
        };
      });
      
      await page.goto('https://jsonplaceholder.typicode.com/posts');
      
      // Verify modified response
    });
  });

  test.describe('File Upload Mocking', () => {
    
    test('should mock file upload', async ({ page }) => {
      const mockHelper = new ApiMockHelper(page);
      
      // Mock file upload success
      await mockHelper.mockFileUpload('**/api/upload', {
        success: true,
        fileUrl: 'https://example.com/uploads/file.jpg',
        fileId: 12345,
      });
      
      await page.goto('https://example.com/upload');
      
      // Upload file
      // await page.setInputFiles('#file-input', 'path/to/file.jpg');
      // await page.click('#upload-button');
      
      // Verify upload success
      // expect(await page.textContent('.success-message')).toContain('Upload successful');
    });
  });

  test.describe('Error Scenario Testing', () => {
    
    test('should handle various HTTP errors', async ({ page }) => {
      const mockService = new ApiMockService(page);
      
      // Test 401 Unauthorized
      await mockService.mockUnauthorized('**/api/protected');
      await page.goto('https://example.com/protected');
      // Verify redirect to login or error message
      
      // Clear previous mock
      await mockService.clearMock('**/api/protected');
      
      // Test 403 Forbidden
      await mockService.mockForbidden('**/api/admin');
      await page.goto('https://example.com/admin');
      // Verify permission denied message
      
      // Clear previous mock
      await mockService.clearMock('**/api/admin');
      
      // Test 500 Server Error
      await mockService.mockServerError('**/api/error');
      await page.goto('https://example.com/error-test');
      // Verify error handling
    });
  });

  test.describe('Mock Data Generators', () => {
    
    test('should generate mock user data', async ({ page }) => {
      const user = MockDataGenerators.mockUser({
        firstName: 'Custom',
        lastName: 'User',
        email: 'custom@example.com',
      });
      
      expect(user.firstName).toBe('Custom');
      expect(user.lastName).toBe('User');
      expect(user.email).toBe('custom@example.com');
      expect(user.id).toBeGreaterThan(0);
      expect(user.createdAt).toBeDefined();
    });

    test('should generate mock product list', async ({ page }) => {
      const products = MockDataGenerators.mockProductList(25);
      
      expect(products).toHaveLength(25);
      expect(products[0]).toHaveProperty('id');
      expect(products[0]).toHaveProperty('name');
      expect(products[0]).toHaveProperty('price');
      expect(products[0]).toHaveProperty('stock');
    });

    test('should generate mock order', async ({ page }) => {
      const order = MockDataGenerators.mockOrder();
      
      expect(order.orderNumber).toMatch(/ORD-\d+-[A-Z0-9]+/);
      expect(order.items.length).toBeGreaterThan(0);
      expect(order.total).toBeGreaterThan(0);
      expect(order.subtotal).toBeGreaterThan(0);
    });

    test('should generate paginated response', async ({ page }) => {
      const allProducts = MockDataGenerators.mockProductList(50);
      const paginatedResponse = MockDataGenerators.mockPaginatedResponse(
        allProducts,
        2,
        10
      );
      
      expect(paginatedResponse.data).toHaveLength(10);
      expect(paginatedResponse.pagination.page).toBe(2);
      expect(paginatedResponse.pagination.totalPages).toBe(5);
      expect(paginatedResponse.pagination.hasNext).toBe(true);
      expect(paginatedResponse.pagination.hasPrev).toBe(true);
    });
  });

  test.describe('Cleanup and Utilities', () => {
    
    test('should clear all mocks', async ({ page }) => {
      const mockService = new ApiMockService(page);
      
      // Add multiple mocks
      await mockService.mockProductList(10);
      await mockService.mockGetCart(false);
      await mockService.mockOrderList(5);
      
      // Clear all mocks
      await mockService.clearAllMocks();
      
      // Now real API calls will go through
      await page.goto('https://jsonplaceholder.typicode.com/posts');
    });

    test('should wait for API call', async ({ page }) => {
      const mockService = new ApiMockService(page);
      
      // Setup mock
      await mockService.mockProductList(10);
      
      // Navigate to page
      const apiCallPromise = mockService.waitForApiCall('**/api/products');
      await page.goto('https://example.com/products');
      
      // Wait for API call to complete
      const request = await apiCallPromise;
      expect(request).toBeDefined();
    });

    test('should wait for API response', async ({ page }) => {
      const mockService = new ApiMockService(page);
      
      // Setup mock
      await mockService.mockProductDetails(123);
      
      // Navigate and wait for response
      const responsePromise = mockService.waitForApiResponse('**/api/products/123');
      await page.goto('https://example.com/products/123');
      
      const responseData = await responsePromise;
      expect(responseData).toHaveProperty('id');
      expect(responseData).toHaveProperty('name');
    });
  });
});
