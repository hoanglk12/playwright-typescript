import { ApiClient } from './ApiClient';
import { ApiResponseWrapper } from './ApiResponse';

/**
 * Extended API client with response wrapper utilities
 */
export class ApiClientExt extends ApiClient {
  /**
   * Send a GET request and return wrapped response
   * @param url - URL path to request
   * @param queryParams - Query parameters to include
   * @returns API response wrapper
   */
  async getWithWrapper(url: string, queryParams?: Record<string, any>): Promise<ApiResponseWrapper> {
    const response = await this.get(url, queryParams);
    return new ApiResponseWrapper(response);
  }

  /**
   * Send a POST request and return wrapped response
   * @param url - URL path to request
   * @param data - Request body data
   * @param headers - Additional headers
   * @returns API response wrapper
   */
  async postWithWrapper(url: string, data?: any, headers?: Record<string, string>): Promise<ApiResponseWrapper> {
    const response = await this.post(url, data, headers);
    return new ApiResponseWrapper(response);
  }

  /**
   * Send a PUT request and return wrapped response
   * @param url - URL path to request
   * @param data - Request body data
   * @param headers - Additional headers
   * @returns API response wrapper
   */
  async putWithWrapper(url: string, data?: any, headers?: Record<string, string>): Promise<ApiResponseWrapper> {
    const response = await this.put(url, data, headers);
    return new ApiResponseWrapper(response);
  }

  /**
   * Send a PATCH request and return wrapped response
   * @param url - URL path to request
   * @param data - Request body data
   * @param headers - Additional headers
   * @returns API response wrapper
   */
  async patchWithWrapper(url: string, data?: any, headers?: Record<string, string>): Promise<ApiResponseWrapper> {
    const response = await this.patch(url, data, headers);
    return new ApiResponseWrapper(response);
  }

  /**
   * Send a DELETE request and return wrapped response
   * @param url - URL path to request
   * @param data - Request body data
   * @returns API response wrapper
   */
  async deleteWithWrapper(url: string, data?: any): Promise<ApiResponseWrapper> {
    const response = await this.delete(url, data);
    return new ApiResponseWrapper(response);
  }
}
