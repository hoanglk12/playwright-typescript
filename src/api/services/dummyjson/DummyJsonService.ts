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

  constructor(options: { baseURL: string; timeout?: number }) {
    super(options);
    this.baseUrl = options.baseURL;
    this.timeoutMs = options.timeout;
  }

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
   * Deviation from a plain no-arg signature: ApiClient.get() has no headers parameter,
   * so Authorization: Bearer cannot be attached through the inherited get(). An optional
   * explicit token is accepted so negative-path tests (invalid/missing token → 401) can
   * exercise this without depending on — or polluting — the static token store shared
   * across tests in the worker.
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

  async refreshAccessToken(refreshToken: string, expiresInMins?: number): Promise<ApiResponseWrapper> {
    const body: RefreshTokenRequest = { refreshToken, ...(expiresInMins ? { expiresInMins } : {}) };
    const response = await this.post('/auth/refresh', body, { 'Content-Type': 'application/json' });
    return new ApiResponseWrapper(response);
  }

  async getAllProducts(params?: ListQueryParams): Promise<ApiResponseWrapper> {
    const response = await this.get('/products', params);
    return new ApiResponseWrapper(response);
  }

  async getProductById(id: number): Promise<ApiResponseWrapper> {
    const response = await this.get(`/products/${id}`);
    return new ApiResponseWrapper(response);
  }

  async searchProducts(q: string): Promise<ApiResponseWrapper> {
    const response = await this.get('/products/search', { q });
    return new ApiResponseWrapper(response);
  }

  async addProduct(data: AddProductRequest): Promise<ApiResponseWrapper> {
    const response = await this.post('/products/add', data, { 'Content-Type': 'application/json' });
    return new ApiResponseWrapper(response);
  }

  async updateProduct(id: number, data: UpdateProductRequest): Promise<ApiResponseWrapper> {
    const response = await this.put(`/products/${id}`, data, { 'Content-Type': 'application/json' });
    return new ApiResponseWrapper(response);
  }

  async deleteProduct(id: number): Promise<ApiResponseWrapper> {
    const response = await this.delete(`/products/${id}`);
    return new ApiResponseWrapper(response);
  }

  async getAllCarts(): Promise<ApiResponseWrapper> {
    const response = await this.get('/carts');
    return new ApiResponseWrapper(response);
  }

  async getCartById(id: number): Promise<ApiResponseWrapper> {
    const response = await this.get(`/carts/${id}`);
    return new ApiResponseWrapper(response);
  }

  async getCartsByUser(userId: number): Promise<ApiResponseWrapper> {
    const response = await this.get(`/carts/user/${userId}`);
    return new ApiResponseWrapper(response);
  }

  async addCart(data: AddCartRequest): Promise<ApiResponseWrapper> {
    const response = await this.post('/carts/add', data, { 'Content-Type': 'application/json' });
    return new ApiResponseWrapper(response);
  }

  async updateCart(id: number, data: UpdateCartRequest): Promise<ApiResponseWrapper> {
    const response = await this.put(`/carts/${id}`, data, { 'Content-Type': 'application/json' });
    return new ApiResponseWrapper(response);
  }

  async deleteCart(id: number): Promise<ApiResponseWrapper> {
    const response = await this.delete(`/carts/${id}`);
    return new ApiResponseWrapper(response);
  }

  async getAllUsers(params?: ListQueryParams): Promise<ApiResponseWrapper> {
    const response = await this.get('/users', params);
    return new ApiResponseWrapper(response);
  }

  async getUserById(id: number): Promise<ApiResponseWrapper> {
    const response = await this.get(`/users/${id}`);
    return new ApiResponseWrapper(response);
  }

  async searchUsers(q: string): Promise<ApiResponseWrapper> {
    const response = await this.get('/users/search', { q });
    return new ApiResponseWrapper(response);
  }

  async addUser(data: AddUserRequest): Promise<ApiResponseWrapper> {
    const response = await this.post('/users/add', data, { 'Content-Type': 'application/json' });
    return new ApiResponseWrapper(response);
  }

  async updateUser(id: number, data: UpdateUserRequest): Promise<ApiResponseWrapper> {
    const response = await this.put(`/users/${id}`, data, { 'Content-Type': 'application/json' });
    return new ApiResponseWrapper(response);
  }

  async deleteUser(id: number): Promise<ApiResponseWrapper> {
    const response = await this.delete(`/users/${id}`);
    return new ApiResponseWrapper(response);
  }
}
