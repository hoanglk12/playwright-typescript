import { Page } from '@playwright/test';
import { ApiMockHelper } from '../utils/api-mock-helper';
import { MockDataGenerators } from '../data/api/mock-data';

/**
 * API Mock Service
 * 
 * Centralized service for managing API mocks across tests
 * Provides pre-configured mocking scenarios for common use cases
 */
export class ApiMockService {
  private mockHelper: ApiMockHelper;
  private page: Page;

  constructor(page: Page) {
    this.page = page;
    this.mockHelper = new ApiMockHelper(page);
  }

  // ==================== USER API MOCKS ====================

  /**
   * Mock successful user login
   */
  async mockSuccessfulLogin(email: string = 'test@example.com'): Promise<void> {
    await this.mockHelper.mockSuccess(
      '**/api/auth/login',
      MockDataGenerators.mockLoginResponse({
        user: MockDataGenerators.mockUser({ email }),
      })
    );
  }

  /**
   * Mock failed login (invalid credentials)
   */
  async mockFailedLogin(): Promise<void> {
    await this.mockHelper.mockError(
      '**/api/auth/login',
      'Invalid email or password',
      401
    );
  }

  /**
   * Mock user registration
   */
  async mockUserRegistration(): Promise<void> {
    await this.mockHelper.mockSuccess(
      '**/api/auth/register',
      {
        message: 'Registration successful',
        user: MockDataGenerators.mockUser(),
        token: MockDataGenerators.mockAuthToken(),
      },
      201
    );
  }

  /**
   * Mock get user profile
   */
  async mockGetUserProfile(): Promise<void> {
    await this.mockHelper.mockSuccess(
      '**/api/users/me',
      MockDataGenerators.mockUser()
    );
  }

  /**
   * Mock update user profile
   */
  async mockUpdateUserProfile(): Promise<void> {
    await this.mockHelper.mockSuccess(
      '**/api/users/me',
      {
        message: 'Profile updated successfully',
        user: MockDataGenerators.mockUser(),
      }
    );
  }

  // ==================== PRODUCT API MOCKS ====================

  /**
   * Mock product list with pagination
   */
  async mockProductList(count: number = 20): Promise<void> {
    const products = MockDataGenerators.mockProductList(count);
    await this.mockHelper.mockPaginated('**/api/products', products, 10);
  }

  /**
   * Mock single product details
   */
  async mockProductDetails(productId?: number): Promise<void> {
    const product = MockDataGenerators.mockProduct(productId ? { id: productId } : {});
    await this.mockHelper.mockSuccess(
      `**/api/products/${productId || '*'}`,
      product
    );
  }

  /**
   * Mock product not found
   */
  async mockProductNotFound(productId: number): Promise<void> {
    await this.mockHelper.mockNotFound(
      `**/api/products/${productId}`,
      'Product not found'
    );
  }

  /**
   * Mock out of stock product
   */
  async mockOutOfStockProduct(productId: number): Promise<void> {
    await this.mockHelper.mockSuccess(
      `**/api/products/${productId}`,
      MockDataGenerators.mockOutOfStockProduct({ id: productId })
    );
  }

  /**
   * Mock product search
   */
  async mockProductSearch(query: string, results: number = 5): Promise<void> {
    const products = MockDataGenerators.mockProductList(results);
    await this.mockHelper.mockSuccess(
      `**/api/products/search?q=${query}*`,
      {
        query,
        results: products,
        totalResults: results,
      }
    );
  }

  // ==================== CART API MOCKS ====================

  /**
   * Mock get cart
   */
  async mockGetCart(isEmpty: boolean = false): Promise<void> {
    const cart = isEmpty 
      ? MockDataGenerators.mockEmptyCart()
      : MockDataGenerators.mockCart();
    
    await this.mockHelper.mockSuccess('**/api/cart', cart);
  }

  /**
   * Mock add to cart
   */
  async mockAddToCart(): Promise<void> {
    await this.mockHelper.mockSuccess(
      '**/api/cart/items',
      {
        message: 'Item added to cart',
        cart: MockDataGenerators.mockCart(),
      },
      201
    );
  }

  /**
   * Mock update cart item quantity
   */
  async mockUpdateCartItem(): Promise<void> {
    await this.mockHelper.mockSuccess(
      '**/api/cart/items/*',
      {
        message: 'Cart updated',
        cart: MockDataGenerators.mockCart(),
      }
    );
  }

  /**
   * Mock remove cart item
   */
  async mockRemoveCartItem(): Promise<void> {
    await this.mockHelper.mockSuccess(
      '**/api/cart/items/*',
      {
        message: 'Item removed from cart',
        cart: MockDataGenerators.mockCart(),
      }
    );
  }

  /**
   * Mock clear cart
   */
  async mockClearCart(): Promise<void> {
    await this.mockHelper.mockSuccess(
      '**/api/cart',
      {
        message: 'Cart cleared',
        cart: MockDataGenerators.mockEmptyCart(),
      }
    );
  }

  // ==================== ORDER API MOCKS ====================

  /**
   * Mock order list
   */
  async mockOrderList(count: number = 10): Promise<void> {
    const orders = MockDataGenerators.mockOrderList(count);
    await this.mockHelper.mockPaginated('**/api/orders', orders, 10);
  }

  /**
   * Mock order details
   */
  async mockOrderDetails(orderId?: number): Promise<void> {
    const order = MockDataGenerators.mockOrder(orderId ? { id: orderId } : {});
    await this.mockHelper.mockSuccess(
      `**/api/orders/${orderId || '*'}`,
      order
    );
  }

  /**
   * Mock create order
   */
  async mockCreateOrder(): Promise<void> {
    await this.mockHelper.mockSuccess(
      '**/api/orders',
      {
        message: 'Order created successfully',
        order: MockDataGenerators.mockOrder(),
      },
      201
    );
  }

  /**
   * Mock order creation failure (payment failed)
   */
  async mockOrderCreationFailure(): Promise<void> {
    await this.mockHelper.mockError(
      '**/api/orders',
      'Payment processing failed',
      402
    );
  }

  /**
   * Mock cancel order
   */
  async mockCancelOrder(orderId: number): Promise<void> {
    await this.mockHelper.mockSuccess(
      `**/api/orders/${orderId}/cancel`,
      {
        message: 'Order cancelled successfully',
        order: MockDataGenerators.mockOrder({
          id: orderId,
          status: 'cancelled',
        }),
      }
    );
  }

  // ==================== ADDRESS API MOCKS ====================

  /**
   * Mock address list
   */
  async mockAddressList(count: number = 3): Promise<void> {
    await this.mockHelper.mockSuccess(
      '**/api/addresses',
      MockDataGenerators.mockAddressList(count)
    );
  }

  /**
   * Mock add address
   */
  async mockAddAddress(): Promise<void> {
    await this.mockHelper.mockSuccess(
      '**/api/addresses',
      {
        message: 'Address added successfully',
        address: MockDataGenerators.mockAddress(),
      },
      201
    );
  }

  /**
   * Mock update address
   */
  async mockUpdateAddress(addressId: number): Promise<void> {
    await this.mockHelper.mockSuccess(
      `**/api/addresses/${addressId}`,
      {
        message: 'Address updated successfully',
        address: MockDataGenerators.mockAddress({ id: addressId }),
      }
    );
  }

  /**
   * Mock delete address
   */
  async mockDeleteAddress(addressId: number): Promise<void> {
    await this.mockHelper.mockSuccess(
      `**/api/addresses/${addressId}`,
      {
        message: 'Address deleted successfully',
      }
    );
  }

  // ==================== PAYMENT API MOCKS ====================

  /**
   * Mock payment method list
   */
  async mockPaymentMethodList(count: number = 2): Promise<void> {
    await this.mockHelper.mockSuccess(
      '**/api/payment-methods',
      MockDataGenerators.mockPaymentMethodList(count)
    );
  }

  /**
   * Mock add payment method
   */
  async mockAddPaymentMethod(): Promise<void> {
    await this.mockHelper.mockSuccess(
      '**/api/payment-methods',
      {
        message: 'Payment method added successfully',
        paymentMethod: MockDataGenerators.mockPaymentMethod(),
      },
      201
    );
  }

  /**
   * Mock process payment
   */
  async mockProcessPayment(): Promise<void> {
    await this.mockHelper.mockSuccess(
      '**/api/payments/process',
      {
        success: true,
        transactionId: `TXN${Date.now()}`,
        message: 'Payment processed successfully',
      }
    );
  }

  /**
   * Mock payment failure
   */
  async mockPaymentFailure(reason: string = 'Insufficient funds'): Promise<void> {
    await this.mockHelper.mockError(
      '**/api/payments/process',
      reason,
      402
    );
  }

  // ==================== ERROR SCENARIOS ====================

  /**
   * Mock unauthorized access
   */
  async mockUnauthorized(urlPattern: string | RegExp = '**/api/**'): Promise<void> {
    await this.mockHelper.mockUnauthorized(
      urlPattern,
      'Authentication required. Please log in.'
    );
  }

  /**
   * Mock forbidden access
   */
  async mockForbidden(urlPattern: string | RegExp = '**/api/**'): Promise<void> {
    await this.mockHelper.mockError(
      urlPattern,
      'You do not have permission to perform this action',
      403
    );
  }

  /**
   * Mock rate limit error
   */
  async mockRateLimit(urlPattern: string | RegExp = '**/api/**'): Promise<void> {
    await this.mockHelper.mockRateLimitError(urlPattern, 60);
  }

  /**
   * Mock server error
   */
  async mockServerError(urlPattern: string | RegExp = '**/api/**'): Promise<void> {
    await this.mockHelper.mockError(
      urlPattern,
      'Internal server error occurred',
      500
    );
  }

  /**
   * Mock network timeout
   */
  async mockTimeout(urlPattern: string | RegExp = '**/api/**'): Promise<void> {
    await this.mockHelper.mockTimeout(urlPattern);
  }

  /**
   * Mock slow network (delayed response)
   */
  async mockSlowNetwork(
    urlPattern: string | RegExp,
    responseData: any,
    delayMs: number = 5000
  ): Promise<void> {
    await this.mockHelper.mockDelayed(urlPattern, responseData, delayMs);
  }

  // ==================== GRAPHQL MOCKS ====================

  /**
   * Mock GraphQL query
   */
  async mockGraphQLQuery(
    operationName: string,
    responseData: any
  ): Promise<void> {
    await this.mockHelper.mockGraphQL(
      '**/graphql',
      operationName,
      responseData
    );
  }

  /**
   * Mock GraphQL mutation
   */
  async mockGraphQLMutation(
    operationName: string,
    responseData: any
  ): Promise<void> {
    await this.mockHelper.mockGraphQL(
      '**/graphql',
      operationName,
      responseData
    );
  }

  /**
   * Mock GraphQL error
   */
  async mockGraphQLError(
    operationName: string,
    errorMessage: string,
    errorCode?: string
  ): Promise<void> {
    await this.mockHelper.mockGraphQLError(
      '**/graphql',
      operationName,
      errorMessage,
      errorCode
    );
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Clear all mocks
   */
  async clearAllMocks(): Promise<void> {
    await this.mockHelper.clearAllMocks();
  }

  /**
   * Clear specific mock
   */
  async clearMock(urlPattern: string | RegExp): Promise<void> {
    await this.mockHelper.clearMock(urlPattern);
  }

  /**
   * Wait for API call
   */
  async waitForApiCall(urlPattern: string | RegExp): Promise<any> {
    return await this.mockHelper.waitForApiCall(urlPattern);
  }

  /**
   * Wait for API response
   */
  async waitForApiResponse(urlPattern: string | RegExp): Promise<any> {
    return await this.mockHelper.waitForApiResponse(urlPattern);
  }

  /**
   * Get direct access to mock helper for advanced scenarios
   */
  getMockHelper(): ApiMockHelper {
    return this.mockHelper;
  }
}
