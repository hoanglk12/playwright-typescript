import { ApiClient, AuthType } from '../../ApiClient';
import { ApiResponseWrapper } from '../../ApiResponse';
import {
  LoginRequest,
  AuthResponse,
  RefreshTokenRequest,
  AddProductRequest,
  UpdateProductRequest,
  AddCartRequest,
  UpdateCartRequest,
  AddUserRequest,
  UpdateUserRequest,
  ListQueryParams,
} from './models';

/**
 * DummyJSON API Service
 * Implementation of https://dummyjson.com/docs
 *
 * Note: add/update/delete endpoints on dummyjson are simulated — they return a plausible
 * response but do not persist server-side. Callers must assert only against the response
 * of the mutating call itself and must never re-fetch afterward to verify persistence.
 */
export class DummyJsonService extends ApiClient {
  private tokenKey = 'dummyjson-token';
  private readonly baseUrl: string;
  private readonly timeoutMs?: number;

  /**
   * Creates a new DummyJsonService
   * @param options - Configuration options including baseURL and timeout
   */
  constructor(options: { baseURL: string; timeout?: number }) {
    super(options);
    this.baseUrl = options.baseURL;
    this.timeoutMs = options.timeout;
  }

  /**
   * Authenticate with the API and get an access/refresh token pair
   * @param username - Username for authentication
   * @param password - Password for authentication
   * @param expiresInMins - Optional token expiry override
   * @returns Auth response with accessToken/refreshToken
   */
  async login(username: string, password: string, expiresInMins?: number): Promise<ApiResponseWrapper> {
    const body: LoginRequest = { username, password, ...(expiresInMins ? { expiresInMins } : {}) };
    const response = await this.post('/auth/login', body, { 'Content-Type': 'application/json' });
    const wrapper = new ApiResponseWrapper(response);

    if (wrapper.isSuccess()) {
      const data = await wrapper.json<AuthResponse>();
      if (data && data.accessToken) {
        ApiClient.storeToken(this.tokenKey, data.accessToken);
      }
    }

    return wrapper;
  }

  /**
   * Get the currently authenticated user
   *
   * Deviation from a plain no-arg signature: ApiClient.get() has no headers parameter,
   * so Authorization: Bearer cannot be attached through the inherited get(). An optional
   * explicit token is accepted so negative-path tests (invalid/missing token → 401) can
   * exercise this without depending on — or polluting — the static token store shared
   * across tests in the worker.
   * @param token - Optional explicit bearer token; defaults to the stored token from login()
   * @returns Response with authenticated user details, or 401 for an invalid/missing token
   */
  async getAuthenticatedUser(token?: string): Promise<ApiResponseWrapper> {
    const client = token
      ? new ApiClient({ baseURL: this.baseUrl, timeout: this.timeoutMs, authType: AuthType.BEARER, token })
      : await ApiClient.withStoredToken({ baseURL: this.baseUrl, timeout: this.timeoutMs }, this.tokenKey);

    if (token) {
      await client.init();
    }

    try {
      const wrapper = new ApiResponseWrapper(await client.get('/auth/me'));
      // Warm the JSON body cache before disposing the temporary client — ApiResponseWrapper
      // reads the response body lazily, and the underlying request context is about to be
      // torn down in the finally block below.
      await wrapper.json().catch(() => undefined);
      return wrapper;
    } finally {
      await client.dispose();
    }
  }

  /**
   * Refresh the access token using a refresh token
   * @param refreshToken - Refresh token to exchange
   * @param expiresInMins - Optional token expiry override
   * @returns Response with a new accessToken/refreshToken pair
   */
  async refreshAccessToken(refreshToken: string, expiresInMins?: number): Promise<ApiResponseWrapper> {
    const body: RefreshTokenRequest = { refreshToken, ...(expiresInMins ? { expiresInMins } : {}) };
    const response = await this.post('/auth/refresh', body, { 'Content-Type': 'application/json' });
    return new ApiResponseWrapper(response);
  }

  /**
   * Get all products
   * @param params - Optional pagination params (limit/skip)
   * @returns Response with products list and pagination metadata
   */
  async getAllProducts(params?: ListQueryParams): Promise<ApiResponseWrapper> {
    const response = await this.get('/products', params);
    return new ApiResponseWrapper(response);
  }

  /**
   * Get a product by ID
   * @param id - Product ID to retrieve
   * @returns Response with product details
   */
  async getProductById(id: number): Promise<ApiResponseWrapper> {
    const response = await this.get(`/products/${id}`);
    return new ApiResponseWrapper(response);
  }

  /**
   * Search products by query string
   * @param q - Search query
   * @returns Response with matching products
   */
  async searchProducts(q: string): Promise<ApiResponseWrapper> {
    const response = await this.get('/products/search', { q });
    return new ApiResponseWrapper(response);
  }

  /**
   * Add a new product (simulated — does not persist server-side)
   * @param data - Product data to create
   * @returns Response with the simulated created product
   */
  async addProduct(data: AddProductRequest): Promise<ApiResponseWrapper> {
    const response = await this.post('/products/add', data, { 'Content-Type': 'application/json' });
    return new ApiResponseWrapper(response);
  }

  /**
   * Update a product (simulated — does not persist server-side)
   * @param id - Product ID to update
   * @param data - Updated product data
   * @returns Response with the simulated updated product
   */
  async updateProduct(id: number, data: UpdateProductRequest): Promise<ApiResponseWrapper> {
    const response = await this.put(`/products/${id}`, data, { 'Content-Type': 'application/json' });
    return new ApiResponseWrapper(response);
  }

  /**
   * Delete a product (simulated — does not persist server-side)
   * @param id - Product ID to delete
   * @returns Response with isDeleted/deletedOn markers
   */
  async deleteProduct(id: number): Promise<ApiResponseWrapper> {
    const response = await this.delete(`/products/${id}`);
    return new ApiResponseWrapper(response);
  }

  /**
   * Get all carts
   * @returns Response with carts list and pagination metadata
   */
  async getAllCarts(): Promise<ApiResponseWrapper> {
    const response = await this.get('/carts');
    return new ApiResponseWrapper(response);
  }

  /**
   * Get a cart by ID
   * @param id - Cart ID to retrieve
   * @returns Response with cart details
   */
  async getCartById(id: number): Promise<ApiResponseWrapper> {
    const response = await this.get(`/carts/${id}`);
    return new ApiResponseWrapper(response);
  }

  /**
   * Get all carts belonging to a user
   * @param userId - User ID to filter by
   * @returns Response with the user's carts
   */
  async getCartsByUser(userId: number): Promise<ApiResponseWrapper> {
    const response = await this.get(`/carts/user/${userId}`);
    return new ApiResponseWrapper(response);
  }

  /**
   * Add a new cart (simulated — does not persist server-side)
   * @param data - Cart data to create
   * @returns Response with the simulated created cart
   */
  async addCart(data: AddCartRequest): Promise<ApiResponseWrapper> {
    const response = await this.post('/carts/add', data, { 'Content-Type': 'application/json' });
    return new ApiResponseWrapper(response);
  }

  /**
   * Update a cart (simulated — does not persist server-side)
   * @param id - Cart ID to update
   * @param data - Updated cart data
   * @returns Response with the simulated updated cart
   */
  async updateCart(id: number, data: UpdateCartRequest): Promise<ApiResponseWrapper> {
    const response = await this.put(`/carts/${id}`, data, { 'Content-Type': 'application/json' });
    return new ApiResponseWrapper(response);
  }

  /**
   * Delete a cart (simulated — does not persist server-side)
   * @param id - Cart ID to delete
   * @returns Response with isDeleted/deletedOn markers
   */
  async deleteCart(id: number): Promise<ApiResponseWrapper> {
    const response = await this.delete(`/carts/${id}`);
    return new ApiResponseWrapper(response);
  }

  /**
   * Get all users
   * @param params - Optional pagination params (limit/skip)
   * @returns Response with users list and pagination metadata
   */
  async getAllUsers(params?: ListQueryParams): Promise<ApiResponseWrapper> {
    const response = await this.get('/users', params);
    return new ApiResponseWrapper(response);
  }

  /**
   * Get a user by ID
   * @param id - User ID to retrieve
   * @returns Response with user details
   */
  async getUserById(id: number): Promise<ApiResponseWrapper> {
    const response = await this.get(`/users/${id}`);
    return new ApiResponseWrapper(response);
  }

  /**
   * Search users by query string
   * @param q - Search query
   * @returns Response with matching users
   */
  async searchUsers(q: string): Promise<ApiResponseWrapper> {
    const response = await this.get('/users/search', { q });
    return new ApiResponseWrapper(response);
  }

  /**
   * Add a new user (simulated — does not persist server-side)
   * @param data - User data to create
   * @returns Response with the simulated created user
   */
  async addUser(data: AddUserRequest): Promise<ApiResponseWrapper> {
    const response = await this.post('/users/add', data, { 'Content-Type': 'application/json' });
    return new ApiResponseWrapper(response);
  }

  /**
   * Update a user (simulated — does not persist server-side)
   * @param id - User ID to update
   * @param data - Updated user data
   * @returns Response with the simulated updated user
   */
  async updateUser(id: number, data: UpdateUserRequest): Promise<ApiResponseWrapper> {
    const response = await this.put(`/users/${id}`, data, { 'Content-Type': 'application/json' });
    return new ApiResponseWrapper(response);
  }

  /**
   * Delete a user (simulated — does not persist server-side)
   * @param id - User ID to delete
   * @returns Response with isDeleted/deletedOn markers
   */
  async deleteUser(id: number): Promise<ApiResponseWrapper> {
    const response = await this.delete(`/users/${id}`);
    return new ApiResponseWrapper(response);
  }
}
