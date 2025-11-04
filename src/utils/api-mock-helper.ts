import { Page, Route, Request } from '@playwright/test';

/**
 * API Mock Helper - Utilities for mocking API responses in Playwright tests
 * 
 * Provides comprehensive API mocking capabilities including:
 * - Success/Error response mocking
 * - Delayed responses for loading states
 * - Conditional mocking based on request data
 * - Response transformation and validation
 */

export interface MockResponse {
  status?: number;
  contentType?: string;
  headers?: Record<string, string>;
  body?: any;
  delay?: number;
}

export interface MockCondition {
  method?: string;
  headers?: Record<string, string>;
  bodyContains?: string | Record<string, any>;
}

export class ApiMockHelper {
  private page: Page;
  private mockRoutes: Map<string, Route> = new Map();

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Mock a successful API response
   * @param urlPattern - URL pattern to intercept (can be string or RegExp)
   * @param responseBody - Response body (will be JSON stringified if object)
   * @param status - HTTP status code (default: 200)
   */
  async mockSuccess(
    urlPattern: string | RegExp,
    responseBody: any,
    status: number = 200
  ): Promise<void> {
    await this.page.route(urlPattern, async (route) => {
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(responseBody),
      });
    });
  }

  /**
   * Mock an error API response
   * @param urlPattern - URL pattern to intercept
   * @param errorMessage - Error message
   * @param status - HTTP status code (default: 500)
   */
  async mockError(
    urlPattern: string | RegExp,
    errorMessage: string,
    status: number = 500
  ): Promise<void> {
    await this.page.route(urlPattern, async (route) => {
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify({
          error: errorMessage,
          timestamp: new Date().toISOString(),
        }),
      });
    });
  }

  /**
   * Mock a 404 Not Found response
   * @param urlPattern - URL pattern to intercept
   * @param message - Custom error message
   */
  async mockNotFound(
    urlPattern: string | RegExp,
    message: string = 'Resource not found'
  ): Promise<void> {
    await this.mockError(urlPattern, message, 404);
  }

  /**
   * Mock a 401 Unauthorized response
   * @param urlPattern - URL pattern to intercept
   * @param message - Custom error message
   */
  async mockUnauthorized(
    urlPattern: string | RegExp,
    message: string = 'Unauthorized access'
  ): Promise<void> {
    await this.mockError(urlPattern, message, 401);
  }

  /**
   * Mock a delayed response (simulate slow network)
   * @param urlPattern - URL pattern to intercept
   * @param responseBody - Response body
   * @param delayMs - Delay in milliseconds
   * @param status - HTTP status code
   */
  async mockDelayed(
    urlPattern: string | RegExp,
    responseBody: any,
    delayMs: number,
    status: number = 200
  ): Promise<void> {
    await this.page.route(urlPattern, async (route) => {
      await new Promise(resolve => setTimeout(resolve, delayMs));
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(responseBody),
      });
    });
  }

  /**
   * Mock different responses based on request data
   * @param urlPattern - URL pattern to intercept
   * @param conditions - Map of conditions to responses
   */
  async mockConditional(
    urlPattern: string | RegExp,
    conditions: Array<{
      condition: MockCondition;
      response: MockResponse;
    }>
  ): Promise<void> {
    await this.page.route(urlPattern, async (route, request) => {
      for (const { condition, response } of conditions) {
        if (this.matchesCondition(request, condition)) {
          await this.fulfillResponse(route, response);
          return;
        }
      }
      // Default: continue with original request
      await route.continue();
    });
  }

  /**
   * Mock GraphQL API responses
   * @param urlPattern - GraphQL endpoint pattern
   * @param operationName - GraphQL operation name
   * @param responseData - Response data
   */
  async mockGraphQL(
    urlPattern: string | RegExp,
    operationName: string,
    responseData: any
  ): Promise<void> {
    await this.page.route(urlPattern, async (route, request) => {
      const postData = request.postDataJSON();
      
      if (postData?.operationName === operationName) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: responseData,
          }),
        });
      } else {
        await route.continue();
      }
    });
  }

  /**
   * Mock GraphQL error responses
   * @param urlPattern - GraphQL endpoint pattern
   * @param operationName - GraphQL operation name
   * @param errorMessage - Error message
   * @param errorCode - Error code
   */
  async mockGraphQLError(
    urlPattern: string | RegExp,
    operationName: string,
    errorMessage: string,
    errorCode?: string
  ): Promise<void> {
    await this.page.route(urlPattern, async (route, request) => {
      const postData = request.postDataJSON();
      
      if (postData?.operationName === operationName) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            errors: [{
              message: errorMessage,
              extensions: errorCode ? { code: errorCode } : undefined,
            }],
          }),
        });
      } else {
        await route.continue();
      }
    });
  }

  /**
   * Mock paginated API responses
   * @param urlPattern - URL pattern to intercept
   * @param allData - Complete dataset
   * @param pageSize - Items per page
   */
  async mockPaginated(
    urlPattern: string | RegExp,
    allData: any[],
    pageSize: number = 10
  ): Promise<void> {
    await this.page.route(urlPattern, async (route, request) => {
      const url = new URL(request.url());
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || pageSize.toString());
      
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const pageData = allData.slice(startIndex, endIndex);
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: pageData,
          pagination: {
            page,
            limit,
            total: allData.length,
            totalPages: Math.ceil(allData.length / limit),
            hasNext: endIndex < allData.length,
            hasPrev: page > 1,
          },
        }),
      });
    });
  }

  /**
   * Mock file upload responses
   * @param urlPattern - Upload endpoint pattern
   * @param uploadResponse - Response after upload
   */
  async mockFileUpload(
    urlPattern: string | RegExp,
    uploadResponse: any
  ): Promise<void> {
    await this.page.route(urlPattern, async (route, request) => {
      if (request.method() === 'POST' || request.method() === 'PUT') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(uploadResponse),
        });
      } else {
        await route.continue();
      }
    });
  }

  /**
   * Mock rate limit error
   * @param urlPattern - URL pattern to intercept
   * @param retryAfter - Seconds to wait before retry
   */
  async mockRateLimitError(
    urlPattern: string | RegExp,
    retryAfter: number = 60
  ): Promise<void> {
    await this.page.route(urlPattern, async (route) => {
      await route.fulfill({
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': '0',
        },
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Too many requests',
          retryAfter,
        }),
      });
    });
  }

  /**
   * Mock network timeout
   * @param urlPattern - URL pattern to intercept
   */
  async mockTimeout(urlPattern: string | RegExp): Promise<void> {
    await this.page.route(urlPattern, async (route) => {
      await route.abort('timedout');
    });
  }

  /**
   * Mock network failure
   * @param urlPattern - URL pattern to intercept
   * @param errorType - Type of network error
   */
  async mockNetworkFailure(
    urlPattern: string | RegExp,
    errorType: 'failed' | 'aborted' | 'timedout' | 'accessdenied' = 'failed'
  ): Promise<void> {
    await this.page.route(urlPattern, async (route) => {
      await route.abort(errorType);
    });
  }

  /**
   * Intercept and modify request before sending
   * @param urlPattern - URL pattern to intercept
   * @param modifier - Function to modify request
   */
  async interceptRequest(
    urlPattern: string | RegExp,
    modifier: (request: Request) => Promise<any>
  ): Promise<void> {
    await this.page.route(urlPattern, async (route, request) => {
      const modifiedData = await modifier(request);
      
      if (modifiedData) {
        await route.continue({
          postData: typeof modifiedData === 'string' 
            ? modifiedData 
            : JSON.stringify(modifiedData),
        });
      } else {
        await route.continue();
      }
    });
  }

  /**
   * Intercept and modify response before returning to page
   * @param urlPattern - URL pattern to intercept
   * @param modifier - Function to modify response
   */
  async interceptResponse(
    urlPattern: string | RegExp,
    modifier: (response: any) => Promise<any>
  ): Promise<void> {
    await this.page.route(urlPattern, async (route, request) => {
      const response = await this.page.request.fetch(request);
      const originalBody = await response.json();
      const modifiedBody = await modifier(originalBody);
      
      await route.fulfill({
        status: response.status(),
        headers: response.headers(),
        contentType: 'application/json',
        body: JSON.stringify(modifiedBody),
      });
    });
  }

  /**
   * Remove all mocked routes
   */
  async clearAllMocks(): Promise<void> {
    await this.page.unrouteAll({ behavior: 'ignoreErrors' });
    this.mockRoutes.clear();
  }

  /**
   * Remove specific mocked route
   * @param urlPattern - URL pattern to remove
   */
  async clearMock(urlPattern: string | RegExp): Promise<void> {
    await this.page.unroute(urlPattern);
  }

  /**
   * Wait for API call to be made
   * @param urlPattern - URL pattern to wait for
   * @param timeout - Timeout in milliseconds
   */
  async waitForApiCall(
    urlPattern: string | RegExp,
    timeout: number = 30000
  ): Promise<Request> {
    return await this.page.waitForRequest(urlPattern, { timeout });
  }

  /**
   * Wait for API response
   * @param urlPattern - URL pattern to wait for
   * @param timeout - Timeout in milliseconds
   */
  async waitForApiResponse(
    urlPattern: string | RegExp,
    timeout: number = 30000
  ): Promise<any> {
    const response = await this.page.waitForResponse(urlPattern, { timeout });
    return await response.json();
  }

  // Private helper methods

  private matchesCondition(request: Request, condition: MockCondition): boolean {
    // Check method
    if (condition.method && request.method() !== condition.method) {
      return false;
    }

    // Check headers
    if (condition.headers) {
      for (const [key, value] of Object.entries(condition.headers)) {
        if (request.headers()[key.toLowerCase()] !== value) {
          return false;
        }
      }
    }

    // Check body contains
    if (condition.bodyContains) {
      try {
        const postData = request.postDataJSON();
        const contains = typeof condition.bodyContains === 'string'
          ? JSON.stringify(postData).includes(condition.bodyContains)
          : this.objectContains(postData, condition.bodyContains);
        
        if (!contains) return false;
      } catch {
        return false;
      }
    }

    return true;
  }

  private objectContains(obj: any, search: Record<string, any>): boolean {
    for (const [key, value] of Object.entries(search)) {
      if (obj[key] !== value) return false;
    }
    return true;
  }

  private async fulfillResponse(route: Route, response: MockResponse): Promise<void> {
    if (response.delay) {
      await new Promise(resolve => setTimeout(resolve, response.delay));
    }

    await route.fulfill({
      status: response.status || 200,
      contentType: response.contentType || 'application/json',
      headers: response.headers,
      body: typeof response.body === 'string' 
        ? response.body 
        : JSON.stringify(response.body),
    });
  }
}

/**
 * Quick helper functions for common mocking scenarios
 */
export class MockHelpers {
  /**
   * Create a mock user object
   */
  static createMockUser(overrides: Partial<any> = {}) {
    return {
      id: Math.floor(Math.random() * 10000),
      name: 'John Doe',
      email: 'john.doe@example.com',
      role: 'user',
      createdAt: new Date().toISOString(),
      ...overrides,
    };
  }

  /**
   * Create a mock product object
   */
  static createMockProduct(overrides: Partial<any> = {}) {
    return {
      id: Math.floor(Math.random() * 10000),
      name: 'Sample Product',
      price: 99.99,
      currency: 'USD',
      stock: 100,
      inStock: true,
      ...overrides,
    };
  }

  /**
   * Create a mock order object
   */
  static createMockOrder(overrides: Partial<any> = {}) {
    return {
      id: Math.floor(Math.random() * 10000),
      orderNumber: `ORD-${Date.now()}`,
      status: 'pending',
      total: 199.99,
      currency: 'USD',
      createdAt: new Date().toISOString(),
      ...overrides,
    };
  }

  /**
   * Create a list of mock items
   */
  static createMockList<T>(
    factory: () => T,
    count: number = 10
  ): T[] {
    return Array.from({ length: count }, factory);
  }
}
