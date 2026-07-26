import { APIRequestContext, APIResponse, request } from '@playwright/test';

export enum AuthType {
  NONE = 'none',
  BASIC = 'basic',
  BEARER = 'bearer',
  API_KEY = 'api_key',
  CUSTOM = 'custom'
}

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

export class ApiClient {
  private context!: APIRequestContext;
  private clientOptions: ApiClientOptions;
  private static tokenStore: Record<string, string> = {};

  constructor(options: ApiClientOptions) {
    this.clientOptions = options;
  }

  async init(): Promise<void> {
    const headers: Record<string, string> = {};

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
        break;
    }

    // Additive merge — lets BEARER/BASIC/API_KEY auth coexist with customHeaders (e.g. Store: nz)
    if (this.clientOptions.customHeaders) {
      Object.assign(headers, this.clientOptions.customHeaders);
    }

    this.context = await request.newContext({
      baseURL: this.clientOptions.baseURL,
      extraHTTPHeaders: headers,
      timeout: this.clientOptions.timeout || 30000,
      // Ignore HTTPS errors for self-signed certificates
      ignoreHTTPSErrors: true
    });
  }

  async dispose(): Promise<void> {
    if (this.context) {
      await this.context.dispose();
    }
  }

  static storeToken(key: string, token: string): void {
    ApiClient.tokenStore[key] = token;
  }

  static getToken(key: string): string | undefined {
    return ApiClient.tokenStore[key];
  }

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

  async get(url: string, queryParams?: Record<string, any>): Promise<APIResponse> {
    return this.context.get(url, { params: queryParams });
  }

  async post(url: string, data?: unknown, headers?: Record<string, string>): Promise<APIResponse> {
    return this.context.post(url, {
      data,
      headers
    });
  }

  async put(url: string, data?: unknown, headers?: Record<string, string>): Promise<APIResponse> {
    return this.context.put(url, {
      data,
      headers
    });
  }

  async patch(url: string, data?: unknown, headers?: Record<string, string>): Promise<APIResponse> {
    return this.context.patch(url, {
      data,
      headers
    });
  }

  async delete(url: string, data?: unknown): Promise<APIResponse> {
    return this.context.delete(url, { data });
  }

  async head(url: string): Promise<APIResponse> {
    return this.context.head(url);
  }
  async optionsRequest(url: string): Promise<APIResponse> {
    return this.context.fetch(url, { method: 'OPTIONS' });
  }
}
