import { APIResponse } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * API Response wrapper to simplify working with Playwright APIResponse objects
 */
export class ApiResponseWrapper {
  private response: APIResponse;
  private responseBody: any;

  /**
   * Creates an API response wrapper
   * @param response - The Playwright APIResponse to wrap
   */
  constructor(response: APIResponse) {
    this.response = response;
  }

  /**
   * Get the original Playwright APIResponse
   * @returns the original response object
   */
  public getOriginalResponse(): APIResponse {
    return this.response;
  }

  /**
   * Get the status code
   * @returns the HTTP status code
   */
  public statusCode(): number {
    return this.response.status();
  }

  /**
   * Get all headers
   * @returns response headers as Record<string, string>
   */
  public headers(): Record<string, string> {
    return this.response.headers();
  }

  /**
   * Get a specific header value
   * @param name - Header name (case-insensitive)
   * @returns header value or undefined if not present
   */
  public header(name: string): string | undefined {
    return this.response.headers()[name.toLowerCase()];
  }

  /**
   * Check if response status is in the 2xx range
   * @returns true if status is 200-299
   */
  public isSuccess(): boolean {
    const status = this.response.status();
    return status >= 200 && status <= 299;
  }

  /**
   * Check if response status is in the 4xx range
   * @returns true if status is 400-499
   */
  public isClientError(): boolean {
    const status = this.response.status();
    return status >= 400 && status <= 499;
  }

  /**
   * Check if response status is in the 5xx range
   * @returns true if status is 500-599
   */
  public isServerError(): boolean {
    const status = this.response.status();
    return status >= 500 && status <= 599;
  }

  /**
   * Get response body as JSON
   * @returns parsed JSON body
   */
  public async json<T = any>(): Promise<T> {
    if (!this.responseBody) {
      this.responseBody = await this.response.json();
    }
    return this.responseBody as T;
  }

  /**
   * Get response body as text
   * @returns response body as string
   */
  public async text(): Promise<string> {
    return await this.response.text();
  }

  /**
   * Extract a value from the JSON response using a path
   * @param path - Path to the value (dot notation, e.g., 'user.name' or array index 'users.0.name')
   * @returns the value at the specified path
   */
  public async extract<T = any>(path: string): Promise<T> {
    const body = await this.json();
    return this.extractFromObject(body, path);
  }

  private extractFromObject(obj: any, path: string): any {
    return path.split('.').reduce((prev, curr) => {
      return prev && prev[curr];
    }, obj);
  }

  /**
   * Assert that the response status code equals the expected value
   * @param expectedStatus - Expected HTTP status code
   */
  public async assertStatus(expectedStatus: number): Promise<this> {
    expect(this.response.status()).toBe(expectedStatus);
    return this;
  }

  /**
   * Assert that the response body JSON contains the expected properties and values
   * @param expected - Expected object (partial)
   */
  public async assertJson(expected: Record<string, any>): Promise<this> {
    const body = await this.json();
    expect(body).toMatchObject(expected);
    return this;
  }

  /**
   * Assert that a specific path in the JSON body equals the expected value
   * @param path - Path to the property (dot notation)
   * @param value - Expected value
   */
  public async assertJsonPath(path: string, value: any): Promise<this> {
    const actual = await this.extract(path);
    expect(actual).toEqual(value);
    return this;
  }

  /**
   * Assert that a specific path in the JSON body contains the expected value
   * @param path - Path to the property (dot notation)
   * @param value - Expected value
   */
  public async assertJsonPathContains(path: string, value: any): Promise<this> {
    const actual = await this.extract(path);
    if (Array.isArray(actual)) {
      expect(actual).toContainEqual(value);
    } else if (typeof actual === 'string') {
      expect(actual).toContain(String(value));
    } else {
      expect(actual).toMatchObject(value);
    }
    return this;
  }

  /**
   * Assert that a header exists with the expected value
   * @param name - Header name
   * @param value - Expected header value
   */
  public async assertHeader(name: string, value: string): Promise<this> {
    const headerValue = this.header(name);
    expect(headerValue).toBe(value);
    return this;
  }

  /**
   * Assert that the response contains a header
   * @param name - Header name
   */
  public async assertHasHeader(name: string): Promise<this> {
    const headerValue = this.header(name);
    expect(headerValue).toBeDefined();
    return this;
  }
}
