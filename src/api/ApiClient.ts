import { APIRequestContext, APIResponse, request } from '@playwright/test';

/**
 * Authorization types supported by the API client
 */
export enum AuthType {
  NONE = 'none',
  BASIC = 'basic',
  BEARER = 'bearer',
  API_KEY = 'api_key',
  CUSTOM = 'custom'
}

/**
 * Options for API client configuration
 */
export interface ApiClientOptions {
  baseURL: string;
  authType?: AuthType;
  username?: string;
  password?: string;
  token?: string;
  apiKey?: string;
  apiKeyHeaderName?: string;
  customHeaders?: Record<string, string>;
  timeout?: number;
}

/**
 * API Client to handle REST API requests
 */
export class ApiClient {
  private context!: APIRequestContext;
  private clientOptions: ApiClientOptions;
  private static tokenStore: Record<string, string> = {};

  /**
   * Creates a new API client instance
   * @param options - Configuration options for the client
   */
  constructor(options: ApiClientOptions) {
    this.clientOptions = options;
  }

  /**
   * Initialize the API request context
   */  async init(): Promise<void> {
    const headers: Record<string, string> = {};
    
    // Apply authorization headers based on auth type
    switch (this.clientOptions.authType) {
      case AuthType.BASIC:
        if (this.clientOptions.username && this.clientOptions.password) {
          const credentials = Buffer.from(`${this.clientOptions.username}:${this.clientOptions.password}`).toString('base64');
          headers['Authorization'] = `Basic ${credentials}`;
        }
        break;
      case AuthType.BEARER:
        if (this.clientOptions.token) {
          headers['Authorization'] = `Bearer ${this.clientOptions.token}`;
        }
        break;
      case AuthType.API_KEY:
        if (this.clientOptions.apiKey && this.clientOptions.apiKeyHeaderName) {
          headers[this.clientOptions.apiKeyHeaderName] = this.clientOptions.apiKey;
        }
        break;
      case AuthType.CUSTOM:
        if (this.clientOptions.customHeaders) {
          Object.assign(headers, this.clientOptions.customHeaders);
        }
        break;
    }

    // Create the API request context
    this.context = await request.newContext({
      baseURL: this.clientOptions.baseURL,
      extraHTTPHeaders: headers,
      timeout: this.clientOptions.timeout || 30000,
      // Ignore HTTPS errors for self-signed certificates
      ignoreHTTPSErrors: true
    });
  }

  /**
   * Dispose of the API request context
   */
  async dispose(): Promise<void> {
    if (this.context) {
      await this.context.dispose();
    }
  }

  /**
   * Store an authentication token for later use
   * @param key - Key to store the token under
   * @param token - Token value to store
   */
  static storeToken(key: string, token: string): void {
    ApiClient.tokenStore[key] = token;
  }

  /**
   * Get a stored authentication token
   * @param key - Key of the token to retrieve
   * @returns The stored token or undefined if not found
   */
  static getToken(key: string): string | undefined {
    return ApiClient.tokenStore[key];
  }

  /**
   * Create a new client using a stored token
   * @param options - Base options for the client
   * @param tokenKey - Key of the token to use
   * @returns A new ApiClient instance with the token applied
   */
  static async withStoredToken(options: ApiClientOptions, tokenKey: string): Promise<ApiClient> {
    const token = ApiClient.getToken(tokenKey);
    if (!token) {
      throw new Error(`No token found for key: ${tokenKey}`);
    }
    
    const clientOptions = {
      ...options,
      authType: AuthType.BEARER,
      token
    };
    
    const client = new ApiClient(clientOptions);
    await client.init();
    return client;
  }

  /**
   * Send a GET request
   * @param url - URL path to request
   * @param queryParams - Query parameters to include
   * @returns API response
   */
  async get(url: string, queryParams?: Record<string, any>): Promise<APIResponse> {
    return this.context.get(url, { params: queryParams });
  }

  /**
   * Send a POST request
   * @param url - URL path to request
   * @param data - Request body data
   * @param headers - Additional headers
   * @returns API response
   */
  async post(url: string, data?: any, headers?: Record<string, string>): Promise<APIResponse> {
    return this.context.post(url, {
      data,
      headers
    });
  }

  /**
   * Send a PUT request
   * @param url - URL path to request
   * @param data - Request body data
   * @param headers - Additional headers
   * @returns API response
   */
  async put(url: string, data?: any, headers?: Record<string, string>): Promise<APIResponse> {
    return this.context.put(url, {
      data,
      headers
    });
  }

  /**
   * Send a PATCH request
   * @param url - URL path to request
   * @param data - Request body data
   * @param headers - Additional headers
   * @returns API response
   */
  async patch(url: string, data?: any, headers?: Record<string, string>): Promise<APIResponse> {
    return this.context.patch(url, {
      data,
      headers
    });
  }

  /**
   * Send a DELETE request
   * @param url - URL path to request
   * @param data - Request body data
   * @returns API response
   */
  async delete(url: string, data?: any): Promise<APIResponse> {
    return this.context.delete(url, { data });
  }

  /**
   * Send a HEAD request
   * @param url - URL path to request
   * @returns API response
   */
  async head(url: string): Promise<APIResponse> {
    return this.context.head(url);
  }
  /**
   * Send an OPTIONS request
   * @param url - URL path to request
   * @returns API response
   */
  async optionsRequest(url: string): Promise<APIResponse> {
    return this.context.fetch(url, { method: 'OPTIONS' });
  }
}
